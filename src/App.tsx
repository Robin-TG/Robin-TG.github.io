import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
import {
  classify,
  initRouter,
  extractFileProgress,
  setRouterProgressHandler,
  type FileProgress,
} from './router.js';
import {
  ensureInitialConversations,
  saveConversations,
  setCurrentConvIdx as persistCurrentIdx,
  loadSilenceTimeout,
  saveSilenceTimeout,
} from './storage.js';
import type { Conversation, Message } from './types.js';

const SPEECH_ERROR_HINTS: Record<string, string> = {
  network:
    'Voice needs an internet connection. This browser sends audio to Google speech services. Check your network, VPN, corporate firewall, or try another connection.',
  'not-allowed': 'Microphone access was denied. Allow the microphone for this site in your browser settings.',
  'service-not-allowed': 'Speech recognition is blocked for this page (browser or device policy).',
  'no-speech': 'No speech was detected. Try again and speak closer to the microphone.',
  'audio-capture': 'No microphone was found or it could not be opened.',
};

interface UseChatScrollReturn {
  ref: RefObject<HTMLDivElement | null>;
}

function useChatScroll(deps: unknown[]): UseChatScrollReturn {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, deps);
  return ref;
}

export default function App() {
  const initial = useMemo(() => ensureInitialConversations(), []);
  const [conversations, setConversations] = useState<Conversation[]>(initial.conversations);
  const [currentConvIdx, setCurrentConvIdx] = useState(initial.currentConvIdx);
  const [userInput, setUserInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [routerReady, setRouterReady] = useState(false);
  const [fileProgresses, setFileProgresses] = useState<FileProgress[]>([]);
  const [inputsLocked, setInputsLocked] = useState(true);
  const [isClassifying, setIsClassifying] = useState(false);
  const [interimSpeech, setInterimSpeech] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [silenceTimeoutMs, setSilenceTimeoutMs] = useState(loadSilenceTimeout());
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [sidebarTop, setSidebarTop] = useState(0);
  const silenceTimeoutRef = useRef<number>(silenceTimeoutMs);
  const headerRef = useRef<HTMLDivElement>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recognizingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conv = conversations[currentConvIdx];
  const messages: Message[] = conv?.messages ?? [];

  const chatRef = useChatScroll([messages, isClassifying, currentConvIdx]);

  const applyConversations = useCallback((next: Conversation[], idx: number) => {
    saveConversations(next);
    persistCurrentIdx(idx);
    setConversations(next);
    setCurrentConvIdx(idx);
  }, []);

  useLayoutEffect(() => {
    setRouterProgressHandler((p) => {
      const { file, percent } = extractFileProgress(p);
      if (file) {
        setFileProgresses((prev) => {
          const existingIdx = prev.findIndex((fp) => fp.file === file);
          if (existingIdx >= 0) {
            if (prev[existingIdx].complete) return prev;
            const updated = [...prev];
            updated[existingIdx] = { file, percent, complete: percent >= 100 };
            return updated;
          }
          return [...prev, { file, percent, complete: percent >= 100 }];
        });
      }
    });
    return () => setRouterProgressHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initRouter();
        if (!cancelled) {
          setRouterReady(true);
          setInputsLocked(false);
        }
      } catch (e) {
        console.error('Failed to load model', e);
        if (!cancelled) setInputsLocked(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sendMessageWithText = useCallback(
    async (rawText: string) => {
      const text = (rawText ?? '').trim();
      if (!text || inputsLocked || isClassifying) return;

      const convIdx = currentConvIdx;

      setConversations((prev) => {
        const next = prev.map((c, i) =>
          i === convIdx ? { ...c, messages: [...c.messages, { sender: 'user' as const, text }] } : c
        );
        saveConversations(next);
        return next;
      });
      setUserInput('');
      setIsClassifying(true);

      try {
        const result = await classify(text);
        setConversations((prev) => {
          const next = prev.map((c, i) =>
            i === convIdx ? { ...c, messages: [...c.messages, { sender: 'ai' as const, text: result }] } : c
          );
          saveConversations(next);
          return next;
        });
      } catch (err) {
        console.error(err);
        setConversations((prev) => {
          const next = prev.map((c, i) =>
            i === convIdx ? { ...c, messages: [...c.messages, { sender: 'ai' as const, text: 'Error.' }] } : c
          );
          saveConversations(next);
          return next;
        });
      } finally {
        setIsClassifying(false);
        textareaRef.current?.focus();
      }
    },
    [inputsLocked, isClassifying, currentConvIdx]
  );

  const sendMessageWithTextRef = useRef(sendMessageWithText);
  sendMessageWithTextRef.current = sendMessageWithText;

  const sendMessage = useCallback(() => {
    sendMessageWithText(userInput);
  }, [userInput, sendMessageWithText]);

  const initSpeech = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const clearSilenceTimer = () => {
      if (silenceTimerRef.current != null) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    const scheduleAutoStopOnSilence = (currentRec: SpeechRecognition) => {
      clearSilenceTimer();
      silenceTimerRef.current = window.setTimeout(() => {
        silenceTimerRef.current = null;
        if (!recognizingRef.current) return;
        if (recognitionRef.current !== currentRec) return;
        try {
          currentRec.stop();
        } catch {
          /* ignore */
        }
      }, silenceTimeoutRef.current);
    };

    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    const replaceWithFreshInstance = () => {
      recognitionRef.current = initSpeech();
    };

    rec.onstart = () => {
      clearSilenceTimer();
      recognizingRef.current = true;
      setIsRecording(true);
      setSpeechError(null);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = (event.results[i][0].transcript ?? '').toString();
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += `${t} `;
        } else {
          interim += t;
        }
      }
      const combined = `${finalTranscriptRef.current}${interim}`.trim();
      setUserInput(combined);
      setInterimSpeech(Boolean(interim));
      scheduleAutoStopOnSilence(rec);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      clearSilenceTimer();
      recognizingRef.current = false;
      setIsRecording(false);
      setInterimSpeech(false);
      if (e.error !== 'aborted') {
        const hint = SPEECH_ERROR_HINTS[e.error];
        if (hint) {
          setSpeechError(hint);
        } else {
          setSpeechError('Voice input failed. You can type your message instead.');
        }
        if (e.error === 'network') {
          console.warn(
            'Speech recognition: network error (browser STT uses remote servers).',
            e.error
          );
        } else {
          console.error('Speech error:', e.error, e);
        }
      }
      replaceWithFreshInstance();
    };

    rec.onend = () => {
      clearSilenceTimer();
      recognizingRef.current = false;
      setIsRecording(false);
      setInterimSpeech(false);
      const finalText = finalTranscriptRef.current.trim();
      if (finalText) {
        setUserInput(finalText);
        setTimeout(() => sendMessageWithTextRef.current(finalText), 50);
      }
      finalTranscriptRef.current = '';
      replaceWithFreshInstance();
    };

    return rec;
  }, []);

  useEffect(() => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setVoiceSupported(false);
      return;
    }
    recognitionRef.current = initSpeech();
    return () => {
      if (silenceTimerRef.current != null) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      recognizingRef.current = false;
      if (rec) {
        try {
          rec.onend = null;
          rec.onerror = null;
          rec.onresult = null;
          rec.onstart = null;
          rec.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, [initSpeech]);

  const toggleVoice = useCallback(() => {
    let rec = recognitionRef.current;
    if (!rec) {
      rec = initSpeech();
      recognitionRef.current = rec;
    }
    if (!rec) return;

    if (recognizingRef.current) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      return;
    }

    setSpeechError(null);
    finalTranscriptRef.current = '';
    try {
      rec.start();
    } catch (e) {
      console.warn('Restarting recognition...', e);
      recognitionRef.current = initSpeech();
      try {
        recognitionRef.current?.start();
      } catch (e2) {
        console.error('Speech start failed', e2);
      }
    }
  }, [initSpeech]);

  const newConversation = useCallback(() => {
    const emptyIdx = conversations.findIndex((c) => c.messages.length === 0);
    if (emptyIdx !== -1) {
      const next = conversations.map((c, i) => (i === emptyIdx ? { ...c, id: Date.now() } : c));
      applyConversations(next, emptyIdx);
    } else {
      const next = [...conversations, { id: Date.now(), messages: [] }];
      applyConversations(next, next.length - 1);
    }
    setUserInput('');
    textareaRef.current?.focus();
  }, [conversations, applyConversations]);

  const selectConversation = useCallback((idx: number) => {
    persistCurrentIdx(idx);
    setCurrentConvIdx(idx);
    if (isMobile) setSidebarOpen(false);
    textareaRef.current?.focus();
  }, [isMobile]);

  const deleteConversation = useCallback(() => {
    if (currentConvIdx < 0 || currentConvIdx >= conversations.length) return;
    const next = conversations.filter((_, i) => i !== currentConvIdx);
    if (next.length === 0) {
      next.push({ id: Date.now(), messages: [] });
    }
    let idx = currentConvIdx;
    if (idx >= next.length) idx = next.length - 1;
    applyConversations(next, idx);
    if (isMobile) setSidebarOpen(false);
  }, [conversations, currentConvIdx, applyConversations, isMobile]);

  const deleteAllConversations = useCallback(() => {
    if (!confirm('Delete all conversations?')) return;
    applyConversations([{ id: Date.now(), messages: [] }], 0);
  }, [applyConversations]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((o) => {
      if (!o && isMobile && headerRef.current) {
        const rect = headerRef.current.getBoundingClientRect();
        setSidebarTop(rect.bottom + 10);
      }
      return !o;
    });
  }, [isMobile]);

  const toggleSettings = useCallback(() => {
    setSettingsOpen((o) => !o);
  }, []);

  const handleSilenceTimeoutChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 500 && val <= 10000) {
      setSilenceTimeoutMs(val);
      silenceTimeoutRef.current = val;
      saveSilenceTimeout(val);
    }
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const disabled = inputsLocked;

  return (
    <>
      {!routerReady && (
        <div className="loading-overlay">
          <span>Loading model...</span>
          {fileProgresses.map((fp, i) => (
            <div key={i} className="loading-file">
              <span className="loading-filename">{fp.file || 'Loading...'}</span>
              <progress max={100} value={fp.percent} />
            </div>
          ))}
        </div>
      )}

      <div className="container">
        <div className={`container-layout${sidebarOpen ? ' container-layout--with-panel' : ''}`}>
          <div className="container-main">
            <header ref={headerRef}>
              <h1>Green Sieve</h1>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  id="new-conversation"
                  className="btn"
                  disabled={disabled}
                  onClick={newConversation}
                >
                  New Conversation
                </button>
                <button
                  type="button"
                  id="conversations-btn"
                  className="btn"
                  disabled={disabled}
                  onClick={toggleSidebar}
                >
                  Conversations
                </button>
                <button
                  type="button"
                  id="settings-btn"
                  className="btn btn-icon"
                  title="Settings"
                  disabled={disabled}
                  onClick={toggleSettings}
                >
                  <span>&#9881;</span>
                </button>
              </div>
            </header>

            <div className="main-content">
              <div className="chat-container">
                <div ref={chatRef} id="chat-history" className="chat-history">
                  {messages.map((msg, i) => (
                    <div key={`${conv?.id}-${i}`} className={`message ${msg.sender}`}>
                      {msg.text}
                    </div>
                  ))}
                  {isClassifying && <div className="message ai">...</div>}
                </div>

                <div className="input-area">
                  <div className="input-controls">
                    <button
                      type="button"
                      id="voice-input"
                      className={`btn btn-icon${isRecording ? ' recording' : ''}`}
                      title="Voice: click to start; stops and sends after a long pause, or click again to stop now"
                      disabled={disabled || !voiceSupported}
                      onClick={toggleVoice}
                    >
                      <span>🎤</span>
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      id="image-selector"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={() => {}}
                    />
                    <button
                      type="button"
                      id="select-image"
                      className="btn btn-icon"
                      title="Select Image"
                      disabled={disabled}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <span>🖼️</span>
                    </button>
                  </div>

                  {speechError && (
                    <div className="speech-hint" role="status">
                      <p>{speechError}</p>
                      <button type="button" className="btn speech-hint-dismiss" onClick={() => setSpeechError(null)}>
                        Dismiss
                      </button>
                    </div>
                  )}

                  <div className="text-input-container">
                    <textarea
                      ref={textareaRef}
                      id="user-input"
                      className={`user-input${interimSpeech ? ' interim' : ''}`}
                      placeholder="Type your message here..."
                      value={userInput}
                      disabled={disabled}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={onKeyDown}
                    />
                    <button
                      type="button"
                      id="send-button"
                      className="btn send-button"
                      disabled={disabled}
                      onClick={sendMessage}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {sidebarOpen && (
            <aside
              id="conversations-sidebar"
              className="conversations-sidebar"
              style={isMobile ? { top: sidebarTop } : undefined}
              aria-label="Conversations"
            >
              <h3>Conversations</h3>
              <ul id="conversations-list">
                {conversations.map((c, idx) => (
                  <li
                    key={c.id}
                    className={idx === currentConvIdx ? 'selected' : ''}
                    onClick={() => selectConversation(idx)}
                  >
                    {c.messages.length ? `${c.messages[0].text.substring(0, 20)}...` : 'Empty'}
                  </li>
                ))}
              </ul>
              <div className="sidebar-actions">
                <button type="button" id="delete-conv" className="btn" onClick={deleteConversation}>
                  Delete Selected
                </button>
                <button type="button" id="delete-all" className="btn" onClick={deleteAllConversations}>
                  Delete All
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>

      {settingsOpen && (
        <div className="modal-overlay" onClick={toggleSettings}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>
            <div className="settings-field">
              <label htmlFor="silence-timeout">
                Speech silence timeout (ms)
                <input
                  type="number"
                  id="silence-timeout"
                  min={500}
                  max={10000}
                  step={100}
                  value={silenceTimeoutMs}
                  onChange={handleSilenceTimeoutChange}
                />
              </label>
              <p className="settings-hint">
                How long to wait after you stop speaking before sending the voice message.
                Range: 500-10000 ms.
              </p>
            </div>
            <button type="button" className="btn" onClick={toggleSettings}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
