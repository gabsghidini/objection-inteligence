import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveSession } from '@google/genai';
import { encode } from './utils/audioUtils';

import { Header } from './components/Header';
import { Recorder } from './components/Recorder';
import { AnalysisDisplay } from './components/AnalysisDisplay';
import type { AppState, TranscriptionEntry, AppMode, AudioSource } from './types';
import { ANALYSIS_PROMPT } from './constants';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove "data:*/*;base64," prefix
            resolve(result.split(',')[1]);
        };
        reader.onerror = (error) => reject(error);
    });
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            return 'API key not valid. Please ensure your API key is set correctly.';
        }
        if (error.message.includes('fetch failed')) {
            return 'Network error. Please check your internet connection and try again.';
        }
        if (error.message.includes('429')) {
            return 'Too many requests. Please wait a moment before trying again.';
        }
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    console.error("Unknown error type:", error);
    return 'An unknown error occurred. Please check the console for more details.';
};


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [transcription, setTranscription] = useState<TranscriptionEntry[]>([]);
  const [analysis, setAnalysis] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('train');
  
  const micSessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const displaySessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const turnCompleteRef = useRef(true);

  const audioProcessorsRef = useRef<(() => void)[]>([]);
  const audioStreamRef = useRef<{ micStream?: MediaStream, displayStream?: MediaStream }>({});

  const createAudioProcessorForSession = (stream: MediaStream, sessionPromise: React.MutableRefObject<Promise<LiveSession> | null>) => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
            }
            const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromise.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
            });
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        // Return a cleanup function
        return () => {
            source.disconnect();
            processor.disconnect();
            audioContext.close();
        };
    } catch (err) {
        console.error('Error setting up audio processor:', err);
        setError(getErrorMessage(err));
        setAppState('error');
        return () => {};
    }
  }


  const startRecording = async (source: AudioSource) => {
    try {
      setAppState('initializing');
      setError(null);
      setTranscription([]);
      setAnalysis('');
      turnCompleteRef.current = true;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      // Practice mode with a single session
      if (source === 'microphone') {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = { micStream };

        const connectConfig = {
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
              responseModalities: [Modality.AUDIO],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction: 'You are a potential customer in a sales call. Be inquisitive, raise some concerns, but be open to the solution presented. Keep your responses concise.',
          },
          callbacks: {
            onopen: () => {
              const cleanup = createAudioProcessorForSession(micStream, micSessionPromiseRef);
              audioProcessorsRef.current.push(cleanup);
              setAppState('recording');
            },
            onmessage: (message) => {
              if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                setTranscription(prev => {
                  const lastEntry = prev[prev.length - 1];
                  if (turnCompleteRef.current || !lastEntry || lastEntry.speaker !== 'Vendedor') {
                    turnCompleteRef.current = false;
                    return [...prev, { speaker: 'Vendedor' as const, text }];
                  } else {
                    const newTranscription = [...prev];
                    newTranscription[newTranscription.length - 1] = { ...lastEntry, text: lastEntry.text + text };
                    return newTranscription;
                  }
                });
              }
              if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                setTranscription(prev => {
                  const lastEntry = prev[prev.length - 1];
                  if (turnCompleteRef.current || !lastEntry || lastEntry.speaker !== 'Cliente') {
                    turnCompleteRef.current = false;
                    return [...prev, { speaker: 'Cliente' as const, text }];
                  } else {
                    const newTranscription = [...prev];
                    newTranscription[newTranscription.length - 1] = { ...lastEntry, text: lastEntry.text + text };
                    return newTranscription;
                  }
                });
              }
              if (message.serverContent?.turnComplete) {
                turnCompleteRef.current = true;
              }
            },
            onclose: () => setAppState('transcribed'),
            onerror: (e) => {
              console.error('Live session error:', e);
              setError('An API error occurred during the live session.');
              setAppState('error');
            },
          },
        };
        micSessionPromiseRef.current = ai.live.connect(connectConfig);

      } else { // Live Call Analysis mode with two parallel sessions
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        audioStreamRef.current = { micStream, displayStream };
        
        setAppState('recording');

        // --- Vendedor (Microphone) Session ---
        const micConnectConfig = {
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
              responseModalities: [], // No audio response needed
              inputAudioTranscription: {},
              systemInstruction: 'You are a silent transcription service.',
          },
          callbacks: {
            onopen: () => {
              const cleanup = createAudioProcessorForSession(micStream, micSessionPromiseRef);
              audioProcessorsRef.current.push(cleanup);
            },
            onmessage: (message) => {
              if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                setTranscription(prev => {
                  const lastEntry = prev[prev.length - 1];
                  if (lastEntry?.speaker === 'Vendedor') {
                    const newTranscription = [...prev];
                    newTranscription[newTranscription.length - 1] = { ...lastEntry, text: lastEntry.text + text };
                    return newTranscription;
                  }
                  return [...prev, { speaker: 'Vendedor' as const, text }];
                });
              }
            },
            onclose: () => {}, // Main stop handles state
            onerror: (e) => {
              console.error('Mic session error:', e);
              setError('An API error occurred on the microphone channel.');
              setAppState('error');
            },
          },
        };
        micSessionPromiseRef.current = ai.live.connect(micConnectConfig);

        // --- Cliente (Display Audio) Session ---
        if (displayStream.getAudioTracks().length > 0) {
            const displayConnectConfig = {
                ...micConnectConfig, // Reuse config base
                callbacks: {
                    onopen: () => {
                        const cleanup = createAudioProcessorForSession(displayStream, displaySessionPromiseRef);
                        audioProcessorsRef.current.push(cleanup);
                    },
                    onmessage: (message) => {
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            setTranscription(prev => {
                                const lastEntry = prev[prev.length - 1];
                                if (lastEntry?.speaker === 'Cliente') {
                                    const newTranscription = [...prev];
                                    newTranscription[newTranscription.length - 1] = { ...lastEntry, text: lastEntry.text + text };
                                    return newTranscription;
                                }
                                return [...prev, { speaker: 'Cliente' as const, text }];
                            });
                        }
                    },
                    onclose: () => {},
                    onerror: (e) => {
                        console.error('Display audio session error:', e);
                        setError('An API error occurred on the system audio channel.');
                        setAppState('error');
                    },
                }
            };
            displaySessionPromiseRef.current = ai.live.connect(displayConnectConfig);
        } else {
            console.warn("Selected display source has no audio track.");
        }
      }
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
      setAppState('error');
    }
  };

  const stopRecording = useCallback(async () => {
    setAppState('finalizing');

    audioStreamRef.current.micStream?.getTracks().forEach(track => track.stop());
    audioStreamRef.current.displayStream?.getTracks().forEach(track => track.stop());
    audioStreamRef.current = {};
    
    audioProcessorsRef.current.forEach(cleanup => cleanup());
    audioProcessorsRef.current = [];

    const closeSession = async (sessionPromise: React.MutableRefObject<Promise<LiveSession> | null>) => {
        if (sessionPromise.current) {
            try {
                const session = await sessionPromise.current;
                session.close();
            } catch (err) {
                console.error('Error closing a session:', err);
            } finally {
                sessionPromise.current = null;
            }
        }
    };

    await Promise.all([
        closeSession(micSessionPromiseRef),
        closeSession(displaySessionPromiseRef)
    ]);
    
    setAppState('transcribed');

  }, []);

  const handleAnalysis = useCallback(async () => {
    if (transcription.length === 0) {
      setAnalysis('No transcription was recorded to analyze.');
      setAppState('complete');
      return;
    }

    setAppState('analyzing');
    try {
        const formattedTranscription = transcription
          .filter(t => t.text)
          .map(({ speaker, text }) => `${speaker}: ${text}`)
          .join('\n');
          
        const promptWithTranscription = `${ANALYSIS_PROMPT}\n\nAqui está a transcrição da call para analisar:\n\n${formattedTranscription}`;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: promptWithTranscription,
        });

        setAnalysis(response.text);
        setAppState('complete');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(getErrorMessage(err));
      setAppState('error');
    }
  }, [transcription]);

  const handleFileUpload = async (file: File) => {
    setAppState('uploading');
    setError(null);
    setTranscription([]);
    setAnalysis('');

    try {
      const base64Media = await fileToBase64(file);
      const mediaPart = {
        inlineData: {
          mimeType: file.type,
          data: base64Media,
        },
      };
      const textPart = {
        text: `Primeiro, transcreva o áudio do arquivo de mídia (áudio ou vídeo) fornecido. Em seguida, execute uma análise de vendas detalhada na transcrição usando o seguinte modelo. NÃO analise o prompt em si, apenas o conteúdo transcrito.\n\n${ANALYSIS_PROMPT}`
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: { parts: [mediaPart, textPart] },
      });
      
      setAnalysis(response.text);
      setAppState('complete');

    } catch (err) {
      console.error('File analysis error:', err);
      const message = getErrorMessage(err);
      if (message.startsWith('An unknown error')) {
        setError('Failed to analyze the media file. It might be corrupted or in an unsupported format.');
      } else {
        setError(message);
      }
      setAppState('error');
    }
  };
  
  const resetApp = () => {
    setAppState('idle');
    setError(null);
    setTranscription([]);
    setAnalysis('');
    stopRecording(); 
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      <Header mode={mode} setMode={setMode} />
      <main className="flex-grow container mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3 flex-shrink-0">
          <Recorder
            appState={appState}
            transcription={transcription}
            error={error}
            onStart={startRecording}
            onStop={stopRecording}
            onReset={resetApp}
            onAnalyze={handleAnalysis}
            mode={mode}
            onFileUpload={handleFileUpload}
          />
        </div>
        <div className="lg:w-2/3 flex-grow">
          <AnalysisDisplay appState={appState} analysisResult={analysis} />
        </div>
      </main>
    </div>
  );
};

export default App;