import React, { useEffect, useRef, useState } from 'react';
import type { LiveSession } from '@google/genai';
import { AppState, TranscriptionEntry, AppMode } from '../types';
import { MicrophoneIcon, StopIcon, ActivityIcon, RefreshCwIcon, SendIcon, UploadCloudIcon, DownloadIcon } from './Icons';
import { encode } from '../utils/audioUtils';

interface RecorderProps {
  appState: AppState;
  transcription: TranscriptionEntry[];
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onAnalyze: () => void;
  onFileUpload: (file: File) => void;
  sessionPromise: Promise<LiveSession> | null;
  mode: AppMode;
}

export const Recorder: React.FC<RecorderProps> = ({
  appState,
  transcription,
  error,
  onStart,
  onStop,
  onReset,
  onAnalyze,
  onFileUpload,
  sessionPromise,
  mode
}) => {
  const transcriptionEndRef = useRef<HTMLDivElement>(null);
  const audioStreamRef = useRef<{ stream: MediaStream, source: MediaStreamAudioSourceNode, processor: ScriptProcessorNode } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };
  
  const handleAnalyzeFile = () => {
    if (selectedFile) {
        onFileUpload(selectedFile);
    }
  };

  const handleExportTranscription = () => {
    if (transcription.length === 0) return;

    const formattedTranscription = transcription
        .map(({ speaker, text }) => `${speaker}: ${text}`)
        .join('\n\n');

    const blob = new Blob([formattedTranscription], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `transcription-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  useEffect(() => {
    if (mode === 'train' && appState === 'recording' && sessionPromise) {
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
  }, [appState, sessionPromise, mode]);

  useEffect(() => {
    transcriptionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcription]);
  
  useEffect(() => {
    // Reset file input when switching modes or resetting
    if (appState === 'idle') {
        setSelectedFile(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  }, [appState, mode]);

  const isRecording = appState === 'recording';
  const isProcessing = ['initializing', 'finalizing', 'analyzing', 'uploading'].includes(appState);

  const getButton = () => {
    if (mode === 'analyze') {
      if (appState === 'complete' || appState === 'error' || appState === 'idle') {
        const action = selectedFile ? handleAnalyzeFile : () => fileInputRef.current?.click();
        const text = selectedFile ? `Analyze "${selectedFile.name}"` : 'Select Audio/Video File';
        const icon = selectedFile ? <SendIcon className="h-5 w-5 mr-2"/> : <UploadCloudIcon className="h-5 w-5 mr-2" />;
        const bgColor = selectedFile ? 'bg-purple-600 hover:bg-purple-700' : 'bg-cyan-600 hover:bg-cyan-700';
        const ringColor = selectedFile ? 'focus:ring-purple-500' : 'focus:ring-cyan-500';
         if(appState !== 'idle') {
          return (
             <button onClick={onReset} className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-900 transition-colors duration-200">
                <RefreshCwIcon className="h-5 w-5 mr-2" />
                Start New Analysis
            </button>
          )
        }
        return (
            <button onClick={action} className={`w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white ${bgColor} focus:outline-none focus:ring-2 focus:ring-offset-2 ${ringColor} focus:ring-offset-gray-900 transition-colors duration-200 truncate`}>
                {icon}
                <span className="truncate">{text}</span>
            </button>
        );
      }
       return (
        <button disabled={true} className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gray-600 cursor-not-allowed">
            <ActivityIcon className="h-5 w-5 mr-2 animate-spin" />
            Processing...
        </button>
       )
    }

    // Train mode
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

    if (appState === 'transcribed') {
      return (
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <button onClick={onAnalyze} className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 focus:ring-offset-gray-900 transition-colors duration-200">
            <SendIcon className="h-5 w-5 mr-2" />
            Analyze Call
          </button>
          <button onClick={handleExportTranscription} className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:ring-offset-gray-900 transition-colors duration-200">
            <DownloadIcon className="h-5 w-5 mr-2" />
            Export .txt
          </button>
        </div>
      )
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
  
  const getTranscriptionContent = () => {
    if (mode === 'analyze') {
        return (
             <div className="text-gray-500 text-center pt-8">
                <p>Upload an audio or video file to be transcribed and analyzed.</p>
            </div>
        )
    }
    
    // Train mode
    if (transcription.length === 0 && !isRecording) {
        return (
            <div className="text-gray-500 text-center pt-8">
            <p>Transcription will appear here...</p>
          </div>
        )
    }
    if (isRecording && transcription.length === 0) {
        return (
            <div className="flex items-center text-cyan-400">
                <ActivityIcon className="h-4 w-4 mr-2 animate-pulse"/>
                <span>Listening...</span>
            </div>
        )
    }
    return (
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
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6 flex flex-col h-full max-h-[85vh]">
      <div className="flex-shrink-0 mb-4">
        {getButton()}
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept="audio/*,video/*" 
            className="hidden" 
        />
      </div>
      {error && <div className="bg-red-900/50 text-red-300 p-3 rounded-md mb-4 text-sm">{error}</div>}
      <div className="flex-grow bg-gray-900 rounded-md p-4 overflow-y-auto min-h-[200px]">
        <h3 className="text-lg font-semibold text-gray-300 mb-3 border-b border-gray-700 pb-2">
            {mode === 'train' ? 'Live Transcription' : 'File Analysis'}
        </h3>
        {getTranscriptionContent()}
      </div>
    </div>
  );
};