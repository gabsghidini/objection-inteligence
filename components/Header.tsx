
import React from 'react';
import { BrainCircuitIcon } from './Icons';

export const Header: React.FC = () => {
  return (
    <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 shadow-lg sticky top-0 z-10">
      <div className="container mx-auto px-4 lg:px-8 py-4 flex items-center">
        <BrainCircuitIcon className="h-8 w-8 text-cyan-400 mr-3" />
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Sales Vibe & Objection Intelligence
        </h1>
      </div>
    </header>
  );
};
