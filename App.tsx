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
  const [audioSource, setAudioSource] = useState<AudioSource | null>(null);


  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const turnCompleteRef = useRef(true);
  const audioStreamRef = useRef<{ 
      micStream?: MediaStream, 
      displayStream?: MediaStream, 
      processor?: ScriptProcessorNode, 
      source?: MediaStreamAudioSourceNode | ScriptProcessorNode,
      audioContext?: AudioContext,
    } | null>(null);


  const setupAndStartSession = (stream: MediaStream) => {
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
            sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
            });
        };

        source.connect(processor);
        processor.connect(audioContext.destination); // This is necessary for the processor to start
        audioStreamRef.current = { ...audioStreamRef.current, audioContext, source, processor };

    } catch (err) {
        console.error('Error setting up audio session:', err);
        setError(getErrorMessage(err));
        setAppState('error');
    }
  }


  const startRecording = async (source: AudioSource) => {
    try {
      setAppState('initializing');
      setError(null);
      setTranscription([]);
      setAnalysis('');
      setAudioSource(source);
      turnCompleteRef.current = true;

      let combinedStream: MediaStream;
      
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = { micStream };
      
      if (source === 'systemAndMicrophone') {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        audioStreamRef.current.displayStream = displayStream;

        const audioContext = new AudioContext({ sampleRate: 16000 });
        const micSource = audioContext.createMediaStreamSource(micStream);
        const dest = audioContext.createMediaStreamDestination();

        micSource.connect(dest);

        // Check if the display stream has an audio track
        if (displayStream.getAudioTracks().length > 0) {
            const displaySource = audioContext.createMediaStreamSource(displayStream);
            displaySource.connect(dest);
        } else {
            console.warn("Selected display source has no audio track.");
        }
        combinedStream = dest.stream;

      } else {
        combinedStream = micStream;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      const isLiveAnalysis = source === 'systemAndMicrophone';
      const connectConfig = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            ...(isLiveAnalysis
                ? {
                    systemInstruction: 'You are a silent transcription service. Do not generate any spoken response.',
                  }
                : {
                    outputAudioTranscription: {},
                    systemInstruction: 'You are a potential customer in a sales call. Be inquisitive, raise some concerns, but be open to the solution presented. Keep your responses concise.',
                  }),
        },
        callbacks: {
          onopen: () => {
            setupAndStartSession(combinedStream);
            setAppState('recording');
          },
          onmessage: (message) => {
            if (isLiveAnalysis) {
                if (message.serverContent?.inputTranscription) {
                    const text = message.serverContent.inputTranscription.text;
                    setTranscription(prev => {
                      const lastEntry = prev[prev.length - 1];
                      if (!lastEntry || lastEntry.speaker !== 'Raw') {
                        return [...prev, { speaker: 'Raw' as const, text }];
                      } else {
                        const newTranscription = [...prev];
                        newTranscription[newTranscription.length - 1] = { ...lastEntry, text: lastEntry.text + text };
                        return newTranscription;
                      }
                    });
                }
            } else {
                // Practice mode with distinct speakers
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
            }
            if (message.serverContent?.turnComplete) {
              turnCompleteRef.current = true;
            }
          },
          onclose: () => {
            setAppState('transcribed');
          },
          onerror: (e) => {
            console.error('Live session error:', e);
            setError('An API error occurred during the live session. The connection may have been lost or the API key may be invalid.');
            setAppState('error');
          },
        },
      };

      sessionPromiseRef.current = ai.live.connect(connectConfig);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
      setAppState('error');
    }
  };

  const stopRecording = useCallback(async () => {
    setAppState('finalizing');

    // Stop all media tracks
    if (audioStreamRef.current) {
        audioStreamRef.current.micStream?.getTracks().forEach(track => track.stop());
        audioStreamRef.current.displayStream?.getTracks().forEach(track => track.stop());
        audioStreamRef.current.processor?.disconnect();
        audioStreamRef.current.source?.disconnect();
        audioStreamRef.current.audioContext?.close();
        audioStreamRef.current = null;
    }

    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
        sessionPromiseRef.current = null;
      } catch (err) {
        console.error('Error stopping session:', err);
        setError(getErrorMessage(err));
        setAppState('error');
      }
    }
  }, []);

  const handleAnalysis = useCallback(async () => {
    if (transcription.length === 0) {
      setAnalysis('No transcription was recorded to analyze.');
      setAppState('complete');
      return;
    }

    setAppState('analyzing');
    try {
      let promptWithTranscription = '';
      
      if (audioSource === 'systemAndMicrophone') {
        const rawTranscription = transcription.map(t => t.text).join('');
        const diarizationInstruction = `
          Primeiro, analise a transcrição bruta a seguir e identifique os dois locutores. O 'Vendedor' é a pessoa que conduz a chamada de vendas (capturada pelo microfone). O 'Cliente' é o prospect (capturado pelo áudio do sistema). Reformate a transcrição, rotulando claramente cada fala como 'Vendedor:' ou 'Cliente:'.
          Depois de reformatar a transcrição com os locutores corretos, execute a análise de vendas completa usando o modelo fornecido.
        `;
        promptWithTranscription = `${ANALYSIS_PROMPT}\n\n${diarizationInstruction}\n\nAqui está a transcrição bruta da call para analisar:\n\n${rawTranscription}`;
      } else {
        const formattedTranscription = transcription
          .filter(t => t.text)
          .map(({ speaker, text }) => `${speaker}: ${text}`)
          .join('\n');
        promptWithTranscription = `${ANALYSIS_PROMPT}\n\nAqui está a transcrição da call para analisar:\n\n${formattedTranscription}`;
      }


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
  }, [transcription, audioSource]);

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
    setAudioSource(null);
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close()).catch(console.error);
        sessionPromiseRef.current = null;
    }
    if (audioStreamRef.current) {
        audioStreamRef.current.micStream?.getTracks().forEach(track => track.stop());
        audioStreamRef.current.displayStream?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
    }
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