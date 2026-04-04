import type { InitialConversations, SpeechSettings } from './types.js';

const CONV_KEY = 'sieveConversations';
const CURRENT_IDX_KEY = 'sieveCurrentConvIdx';
const SILENCE_TIMEOUT_KEY = 'sieveSilenceTimeoutMs';
const SPEECH_SETTINGS_KEY = 'sieveSpeechSettings';

export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  enabled: false,
  voiceUri: '',
};

export function loadSilenceTimeout(): number {
  const val = localStorage.getItem(SILENCE_TIMEOUT_KEY);
  return val !== null ? parseInt(val, 10) : 2500;
}

export function saveSilenceTimeout(ms: number): void {
  localStorage.setItem(SILENCE_TIMEOUT_KEY, String(ms));
}

export function loadConversations(): import('./types.js').Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(CONV_KEY) ?? '') || [];
  } catch {
    return [];
  }
}

export function saveConversations(convs: import('./types.js').Conversation[]): void {
  localStorage.setItem(CONV_KEY, JSON.stringify(convs));
}

export function getCurrentConvIdx(): number | null {
  const val = localStorage.getItem(CURRENT_IDX_KEY);
  return val !== null ? parseInt(val, 10) : null;
}

export function setCurrentConvIdx(idx: number): void {
  localStorage.setItem(CURRENT_IDX_KEY, String(idx));
}

export function ensureInitialConversations(): InitialConversations {
  let conversations = loadConversations();
  if (conversations.length === 0) {
    conversations.push({ id: Date.now(), messages: [] });
    saveConversations(conversations);
  }
  let currentConvIdx = getCurrentConvIdx();
  if (currentConvIdx === null || currentConvIdx >= conversations.length) {
    currentConvIdx = 0;
    setCurrentConvIdx(currentConvIdx);
  }
  return { conversations, currentConvIdx };
}

export function loadSpeechSettings(): SpeechSettings {
  try {
    const stored = localStorage.getItem(SPEECH_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SPEECH_SETTINGS };
}

export function saveSpeechSettings(settings: SpeechSettings): void {
  localStorage.setItem(SPEECH_SETTINGS_KEY, JSON.stringify(settings));
}
