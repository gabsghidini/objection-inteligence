
// The Gemini Live API sends a stream of raw PCM audio data.
// We need to handle the encoding of audio data manually before sending.
// NOTE: We do not need decoding functions for this app as we are relying on transcription, not playback.

/**
 * Encodes a Uint8Array of bytes into a Base64 string.
 * @param bytes The raw bytes to encode.
 * @returns A Base64 encoded string.
 */
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
