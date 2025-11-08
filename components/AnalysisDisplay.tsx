import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { AppState } from '../types';
import { BotIcon, FileTextIcon, ActivityIcon } from './Icons';

interface AnalysisDisplayProps {
  appState: AppState;
  analysisResult: string;
}

export const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ appState, analysisResult }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: number | undefined;
    if (appState === 'analyzing' || appState === 'uploading') {
      setProgress(10); // Start with a small amount of progress
      interval = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval);
            return prev;
          }
          // Non-linear progression
          const increment = (100 - prev) / 15 * Math.random();
          return Math.min(prev + increment, 95);
        });
      }, 500);
    } else {
        setProgress(0);
    }
    return () => {
        if (interval) {
            clearInterval(interval);
        }
    };
  }, [appState]);


  const renderContent = () => {
    switch (appState) {
      case 'idle':
        return (
          <div className="text-center text-gray-500 flex flex-col items-center justify-center h-full">
            <BotIcon className="h-16 w-16 mb-4 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-400">Welcome to Sales AI</h2>
            <p>Start a recording or upload an audio/video file to get your analysis.</p>
          </div>
        );
      case 'uploading':
        return (
          <div className="text-center text-cyan-400 flex flex-col items-center justify-center h-full space-y-4">
            <ActivityIcon className="h-16 w-16 mb-4 animate-spin"/>
            <h2 className="text-xl font-semibold">Uploading & Analyzing Media...</h2>
            <p className="text-gray-400 max-w-md">Our AI is transcribing and processing your file. This may take a moment.</p>
            <div className="w-full max-w-md pt-4">
                <div className="w-full bg-gray-700 rounded-full h-4 relative">
                    <div 
                        className="bg-cyan-500 h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-center text-xs font-bold text-white" 
                        style={{ width: `${progress}%` }}>
                       {`${Math.round(progress)}%`}
                    </div>
                </div>
            </div>
          </div>
        );
      case 'analyzing':
        return (
          <div className="text-center text-cyan-400 flex flex-col items-center justify-center h-full space-y-4">
            <ActivityIcon className="h-16 w-16 mb-4 animate-spin"/>
            <h2 className="text-xl font-semibold">Analyzing Call...</h2>
            <p className="text-gray-400 max-w-md">Our AI is processing the transcription to generate insights.</p>
            <div className="w-full max-w-md pt-4">
                 <div className="w-full bg-gray-700 rounded-full h-4 relative">
                    <div 
                        className="bg-cyan-500 h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-center text-xs font-bold text-white" 
                        style={{ width: `${progress}%` }}>
                       {`${Math.round(progress)}%`}
                    </div>
                </div>
            </div>
          </div>
        );
       case 'complete':
        // For this environment, we will trust the output from the Gemini API.
        // In a production app, you should sanitize this HTML to prevent XSS attacks.
        const dirtyHtml = marked.parse(analysisResult) as string;
        return (
          <div
            className="prose prose-invert prose-p:text-gray-300 prose-headings:text-cyan-400 prose-strong:text-white prose-blockquote:border-cyan-500 prose-blockquote:text-gray-400 prose-table:border-gray-600 prose-th:text-gray-200 prose-tr:border-gray-700 prose-td:text-gray-300 max-w-none"
            dangerouslySetInnerHTML={{ __html: dirtyHtml }}
          />
        );
      case 'error':
        return (
            <div className="text-center text-red-400 flex flex-col items-center justify-center h-full">
                <BotIcon className="h-16 w-16 mb-4 text-red-500" />
                <h2 className="text-xl font-semibold">An Error Occurred</h2>
                <p>Please check the left panel for details and try starting a new analysis.</p>
            </div>
        )
      case 'transcribed':
        return (
            <div className="text-center text-gray-500 flex flex-col items-center justify-center h-full">
              <FileTextIcon className="h-16 w-16 mb-4 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-400">Transcription Complete</h2>
              <p>Click "Analyze Call" to submit for analysis.</p>
            </div>
          );
      default:
        return (
          <div className="text-center text-gray-500 flex flex-col items-center justify-center h-full">
            <FileTextIcon className="h-16 w-16 mb-4 text-gray-600" />
            <p>Your analysis will be displayed here.</p>
          </div>
        );
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6 lg:p-8 h-full max-h-[85vh] overflow-y-auto">
      {renderContent()}
    </div>
  );
};