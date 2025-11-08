
export type AppState = 'idle' | 'initializing' | 'recording' | 'finalizing' | 'analyzing' | 'complete' | 'error';

export interface TranscriptionEntry {
  speaker: 'Vendedor' | 'Cliente';
  text: string;
}
