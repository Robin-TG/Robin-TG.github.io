import type { VoiceInfo } from './types.js';

declare global {
  interface Window {
    speechSynthesis: SpeechSynthesis;
  }
}

export function getVoices(): VoiceInfo[] {
  if (!window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices().map((v) => ({
    name: v.name,
    lang: v.lang,
    uri: v.voiceURI,
    default: v.default,
  }));
}

export function speak(text: string, voiceUri: string): void {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.voiceURI === voiceUri);
  if (voice) {
    utterance.voice = voice;
  }
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
