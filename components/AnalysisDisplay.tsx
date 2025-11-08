
import React from 'react';
import { AppState } from '../types';
import { BotIcon, FileTextIcon, ActivityIcon } from './Icons';

interface AnalysisDisplayProps {
  appState: AppState;
  analysisResult: string;
}

const SkeletonLoader: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/3"></div>
        <div className="space-y-3">
            <div className="h-4 bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-700 rounded w-full"></div>
        </div>
        <div className="h-6 bg-gray-700 rounded w-1/4 mt-8"></div>
        <div className="space-y-3">
            <div className="h-4 bg-gray-700 rounded w-4/5"></div>
            <div className="h-4 bg-gray-700 rounded w-full"></div>
        </div>
    </div>
);


export const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ appState, analysisResult }) => {
  const renderContent = () => {
    switch (appState) {
      case 'idle':
        return (
          <div className="text-center text-gray-500 flex flex-col items-center justify-center h-full">
            <BotIcon className="h-16 w-16 mb-4 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-400">Welcome to Sales AI</h2>
            <p>Start a recording to get your sales call analysis.</p>
          </div>
        );
      case 'analyzing':
        return (
          <div className="text-center text-cyan-400 flex flex-col items-center justify-center h-full">
            <ActivityIcon className="h-16 w-16 mb-4 animate-spin"/>
            <h2 className="text-xl font-semibold">Analyzing Call...</h2>
            <p className="text-gray-400">Our AI is processing the transcription to generate insights.</p>
          </div>
        );
       case 'complete':
        return (
          <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-cyan-400 prose-strong:text-white prose-blockquote:border-cyan-500 prose-blockquote:text-gray-400 max-w-none">
             {analysisResult.split('\n').map((line, i) => {
                if(line.startsWith('✅')) {
                    return <h2 key={i} className="text-2xl font-bold mt-8 mb-4 border-b border-gray-700 pb-2">{line.replace('✅ ', '')}</h2>
                }
                if(line.startsWith('Dimensão')) { // Quick and dirty table header
                    return <pre key={i} className="bg-gray-900/50 p-2 rounded-md font-mono text-sm whitespace-pre-wrap">{line}</pre>
                }
                if(line.startsWith('Objeção:')) {
                    return <h3 key={i} className="text-xl font-semibold mt-6 mb-2">{line}</h3>
                }
                if(line.startsWith('•')) {
                    return <p key={i} className="ml-4">{line}</p>
                }
                return <p key={i}>{line}</p>
             })}
          </div>
        );
      case 'error':
        return (
            <div className="text-center text-red-400 flex flex-col items-center justify-center h-full">
                <BotIcon className="h-16 w-16 mb-4 text-red-500" />
                <h2 className="text-xl font-semibold">An Error Occurred</h2>
                <p>Please try starting a new analysis.</p>
            </div>
        )
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
