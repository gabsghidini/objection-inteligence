export type AppMode = 'train' | 'analyze';
export type AppState = 'idle' | 'initializing' | 'recording' | 'finalizing' | 'transcribed' | 'analyzing' | 'complete' | 'error' | 'uploading';

export interface TranscriptionEntry {
  speaker: 'Vendedor' | 'Cliente';
  text: string;
}