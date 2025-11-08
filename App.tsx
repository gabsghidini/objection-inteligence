
import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveSession } from '@google/genai';

import { Header } from './components/Header';
import { Recorder } from './components/Recorder';
import { AnalysisDisplay } from './components/AnalysisDisplay';
import type { AppState, TranscriptionEntry } from './types';
import { ANALYSIS_PROMPT } from './constants';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [transcription, setTranscription] = useState<TranscriptionEntry[]>([]);
  const [analysis, setAnalysis] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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
                  newTranscription[newTranscription.length - 1] = { ...lastEntry, text };
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
                  newTranscription[newTranscription.length - 1] = { ...lastEntry, text };
                  return newTranscription;
                }
              });
            }

            if (message.serverContent?.turnComplete) {
              turnCompleteRef.current = true;
            }
          },
          onclose: () => {
            setAppState('analyzing');
            handleAnalysis();
          },
          onerror: (e) => {
            console.error(e);
            setError('An API error occurred during the session. Please try again.');
            setAppState('error');
          },
        },
      });
    } catch (err) {
      console.error(err);
      setError('Failed to start recording. Please check microphone permissions and API key.');
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
        setError('Failed to stop the session gracefully.');
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
      setError('Failed to generate analysis. The model may have returned an error.');
      setAppState('error');
    }
  }, [transcription]);
  
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
      <Header />
      <main className="flex-grow container mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3 flex-shrink-0">
          <Recorder
            appState={appState}
            transcription={transcription}
            error={error}
            onStart={startRecording}
            onStop={stopRecording}
            onReset={resetApp}
            sessionPromise={sessionPromiseRef.current}
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
