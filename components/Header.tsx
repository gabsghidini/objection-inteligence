import React from 'react';
import { BrainCircuitIcon } from './Icons';
import type { AppMode } from '../types';

interface HeaderProps {
    mode: AppMode;
    setMode: (mode: AppMode) => void;
}

export const Header: React.FC<HeaderProps> = ({ mode, setMode }) => {
  return (
    <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 shadow-lg sticky top-0 z-10">
      <div className="container mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center">
            <BrainCircuitIcon className="h-8 w-8 text-cyan-400 mr-3" />
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Sales Vibe & Objection Intelligence
            </h1>
        </div>
        <div className="flex items-center space-x-2 bg-gray-800 p-1 rounded-lg">
            <button 
                onClick={() => setMode('train')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${mode === 'train' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
                Train Mode
            </button>
            <button 
                onClick={() => setMode('analyze')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${mode === 'analyze' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
                Analyze Mode
            </button>
        </div>
      </div>
    </header>
  );
};