import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveSession } from '@google/genai';

import { Header } from './components/Header';
import { Recorder } from './components/Recorder';
import { AnalysisDisplay } from './components/AnalysisDisplay';
import type { AppState, TranscriptionEntry, AppMode } from './types';
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

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const turnCompleteRef = useRef(true);

  const startRecording = async () => {
    try {
      setAppState('initializing');
      setError(null);
      setTranscription([]);
      setAnalysis('');
      turnCompleteRef.current = true;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            'You are a potential customer in a sales call. Be inquisitive, raise some concerns, but be open to the solution presented. Keep your responses concise.',
        },
        callbacks: {
          onopen: () => setAppState('recording'),
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
          onclose: () => {
            setAppState('transcribed');
          },
          onerror: (e) => {
            console.error('Live session error:', e);
            setError('An API error occurred during the live session. The connection may have been lost or the API key may be invalid.');
            setAppState('error');
          },
        },
      });
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
      setAppState('error');
    }
  };

  const stopRecording = useCallback(async () => {
    if (sessionPromiseRef.current) {
      try {
        setAppState('finalizing');
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
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close()).catch(console.error);
        sessionPromiseRef.current = null;
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
            sessionPromise={sessionPromiseRef.current}
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