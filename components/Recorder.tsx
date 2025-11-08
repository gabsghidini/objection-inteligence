
import React, { useEffect, useRef } from 'react';
import type { LiveSession } from '@google/genai';
import { AppState, TranscriptionEntry } from '../types';
import { MicrophoneIcon, StopIcon, ActivityIcon, RefreshCwIcon } from './Icons';
import { encode } from '../utils/audioUtils';

interface RecorderProps {
  appState: AppState;
  transcription: TranscriptionEntry[];
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  sessionPromise: Promise<LiveSession> | null;
}

export const Recorder: React.FC<RecorderProps> = ({
  appState,
  transcription,
  error,
  onStart,
  onStop,
  onReset,
  sessionPromise,
}) => {
  const transcriptionEndRef = useRef<HTMLDivElement>(null);
  const audioStreamRef = useRef<{ stream: MediaStream, source: MediaStreamAudioSourceNode, processor: ScriptProcessorNode } | null>(null);

  useEffect(() => {
    if (appState === 'recording' && sessionPromise) {
      const startMicrophone = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
            sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
            });
          };

          source.connect(processor);
          processor.connect(audioContext.destination);
          audioStreamRef.current = { stream, source, processor };
        } catch (err) {
            console.error('Microphone access denied:', err);
        }
      };
      startMicrophone();
    }

    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.processor.disconnect();
        audioStreamRef.current.source.disconnect();
        audioStreamRef.current.stream.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    };
  }, [appState, sessionPromise]);

  useEffect(() => {
    transcriptionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcription]);

  const isRecording = appState === 'recording';
  const isProcessing = ['initializing', 'finalizing', 'analyzing'].includes(appState);

  const getButton = () => {
    if (appState === 'idle' || appState === 'complete' || appState === 'error') {
      const action = (appState === 'idle') ? onStart : onReset;
      const text = (appState === 'idle') ? 'Start Recording' : 'Start New Analysis';
      const icon = (appState === 'idle') ? <MicrophoneIcon className="h-5 w-5 mr-2" /> : <RefreshCwIcon className="h-5 w-5 mr-2" />;
      return (
        <button onClick={action} className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-900 transition-colors duration-200">
          {icon}
          {text}
        </button>
      );
    }

    return (
        <button onClick={onStop} disabled={isProcessing} className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-900 transition-colors duration-200 disabled:bg-red-800 disabled:cursor-not-allowed">
          {isProcessing ? (
            <ActivityIcon className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <StopIcon className="h-5 w-5 mr-2" />
          )}
          {isRecording ? 'Stop Recording' : 'Processing...'}
        </button>
    )
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6 flex flex-col h-full max-h-[85vh]">
      <div className="flex-shrink-0 mb-4">
        {getButton()}
      </div>
      {error && <div className="bg-red-900/50 text-red-300 p-3 rounded-md mb-4 text-sm">{error}</div>}
      <div className="flex-grow bg-gray-900 rounded-md p-4 overflow-y-auto min-h-[200px]">
        <h3 className="text-lg font-semibold text-gray-300 mb-3 border-b border-gray-700 pb-2">Live Transcription</h3>
        {transcription.length === 0 && !isRecording && (
          <div className="text-gray-500 text-center pt-8">
            <p>Transcription will appear here...</p>
          </div>
        )}
        {isRecording && transcription.length === 0 && (
            <div className="flex items-center text-cyan-400">
                <ActivityIcon className="h-4 w-4 mr-2 animate-pulse"/>
                <span>Listening...</span>
            </div>
        )}
        <div className="space-y-4">
          {transcription.map((entry, index) => (
            <div key={index} className={`flex flex-col ${entry.speaker === 'Vendedor' ? 'items-start' : 'items-end'}`}>
              <div className={`rounded-lg px-3 py-2 max-w-sm ${entry.speaker === 'Vendedor' ? 'bg-blue-900/50 text-blue-200' : 'bg-gray-700 text-gray-300'}`}>
                <p className="font-bold text-xs mb-1">{entry.speaker}</p>
                <p className="text-sm">{entry.text}</p>
              </div>
            </div>
          ))}
          <div ref={transcriptionEndRef} />
        </div>
      </div>
    </div>
  );
};
