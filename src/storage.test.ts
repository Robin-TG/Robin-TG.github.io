import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureInitialConversations,
  getCurrentConvIdx,
  loadConversations,
  saveConversations,
  setCurrentConvIdx,
  loadSilenceTimeout,
  saveSilenceTimeout,
} from './storage.ts';

const CONV_KEY = 'sieveConversations';
const IDX_KEY = 'sieveCurrentConvIdx';
const SILENCE_KEY = 'sieveSilenceTimeoutMs';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loadConversations returns [] when missing', () => {
    expect(loadConversations()).toEqual([]);
  });

  it('loadConversations returns [] on invalid JSON', () => {
    localStorage.setItem(CONV_KEY, '{not json');
    expect(loadConversations()).toEqual([]);
  });

  it('saveConversations round-trips', () => {
    const convs = [{ id: 1, messages: [{ sender: 'user', text: 'hi' }] }];
    saveConversations(convs);
    expect(loadConversations()).toEqual(convs);
  });

  it('getCurrentConvIdx returns null when unset', () => {
    expect(getCurrentConvIdx()).toBeNull();
  });

  it('setCurrentConvIdx and getCurrentConvIdx round-trip', () => {
    setCurrentConvIdx(2);
    expect(getCurrentConvIdx()).toBe(2);
  });

  it('ensureInitialConversations seeds one conversation', () => {
    vi.spyOn(Date, 'now').mockReturnValue(99_000);
    const { conversations, currentConvIdx } = ensureInitialConversations();
    expect(conversations).toHaveLength(1);
    expect(conversations[0].messages).toEqual([]);
    expect(conversations[0].id).toBe(99_000);
    expect(currentConvIdx).toBe(0);
    expect(JSON.parse(localStorage.getItem(CONV_KEY) ?? '')).toHaveLength(1);
    expect(localStorage.getItem(IDX_KEY)).toBe('0');
    vi.restoreAllMocks();
  });

  it('ensureInitialConversations clamps invalid index', () => {
    const convs = [{ id: 1, messages: [] }];
    saveConversations(convs);
    localStorage.setItem(IDX_KEY, '99');
    const { currentConvIdx } = ensureInitialConversations();
    expect(currentConvIdx).toBe(0);
  });

  describe('silenceTimeout', () => {
    it('loadSilenceTimeout returns 2500 when unset', () => {
      expect(loadSilenceTimeout()).toBe(2500);
    });

    it('loadSilenceTimeout returns stored value', () => {
      localStorage.setItem(SILENCE_KEY, '3000');
      expect(loadSilenceTimeout()).toBe(3000);
    });

    it('loadSilenceTimeout returns NaN on invalid value', () => {
      localStorage.setItem(SILENCE_KEY, 'not-a-number');
      expect(loadSilenceTimeout()).toBeNaN();
    });

    it('saveSilenceTimeout stores the value', () => {
      saveSilenceTimeout(4000);
      expect(localStorage.getItem(SILENCE_KEY)).toBe('4000');
    });

    it('saveSilenceTimeout and loadSilenceTimeout round-trip', () => {
      saveSilenceTimeout(5000);
      expect(loadSilenceTimeout()).toBe(5000);
    });
  });
});
