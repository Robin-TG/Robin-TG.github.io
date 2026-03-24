// ================================
// CONFIG (EMBEDDING MODEL)
// ================================
const EMBED_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

let embedder = null;
let intentVectors = null;
let loadingPromise = null;

// ================================
// Load Transformers.js
// ================================
async function ensureTransformersLoaded() {
  if (window.transformers) return;

  const mod = await import(
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers'
  );

  window.transformers = mod;

  transformers.env.allowLocalModels = false;
  transformers.env.useBrowserCache = true;
  transformers.env.useFS = false;
}

// ================================
// INIT ROUTER
// ================================
const INTENTS = {
  WEB_SEARCH: [
    "weather forecast tomorrow",
    "weather next week",
    "latest news today",
    "current bitcoin price",
    "football match result",
    "latest sports news",
    "flight status today",
    "time in Tokyo",
    "restaurants near me"
  ],
  LLM_QUESTION: [
    "explain a concept",
    "how something works",
    "why something happens",
    "difference between two things",
    "write an example",
    "summarize this text",
    "you know about",
    "want to know about"
  ]
};

async function initRouter() {
  if (embedder) return embedder;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await ensureTransformersLoaded();

    embedder = await transformers.pipeline(
      "feature-extraction",
      EMBED_MODEL,
      {
        dtype: "q4",
        progress_callback: (p) => console.log("Loading router:", p)
      }
    );

    intentVectors = {};

    for (const type in INTENTS) {
      intentVectors[type] = [];

      for (const example of INTENTS[type]) {
        intentVectors[type].push(await embed(example));
      }
    }

    console.log("+ Router ready");
    return embedder;
  })();

  return loadingPromise;
}

// ================================
// Voice Input
// ================================
const voiceBtn = document.getElementById('voice-input');

let recognition = null;
let recognizing = false;
let finalTranscript = '';

function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();

  rec.lang = 'en-US';
  rec.continuous = false;
  rec.interimResults = true;

  rec.onstart = () => {
    recognizing = true;
    finalTranscript = '';
    voiceBtn.classList.add('recording');
  };

  rec.onresult = (event) => {
    let interim = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = (event.results[i][0].transcript ?? '').toString();

      if (event.results[i].isFinal) {
        finalTranscript += t + ' ';
      } else {
        interim += t;
      }
    }

    const inputEl = document.getElementById('user-input');
    inputEl.value = (finalTranscript + interim).trim();

    if (interim) {
      inputEl.classList.add('interim');
    } else {
      inputEl.classList.remove('interim');
    }
  };

  rec.onerror = (e) => {
    console.error("Speech error:", e);
    recognizing = false;
    voiceBtn.classList.remove('recording');
    voiceBtn.disabled = false;
  };

  rec.onend = () => {
    recognizing = false;
    voiceBtn.classList.remove('recording');
    voiceBtn.disabled = false;

    const finalText = finalTranscript.trim();

    if (finalText) {
      const inputEl = document.getElementById('user-input');
      inputEl.value = finalText;
      inputEl.classList.remove('interim');

      // delay avoids race condition with UI + recognition
      setTimeout(() => sendMessage(), 50);
    }
  };

  return rec;
}

// Initialize once
if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
  recognition = initSpeech();

  voiceBtn.onclick = () => {
    if (!recognition) {
      recognition = initSpeech();
    }

    if (recognizing) {
      recognition.stop();
      return;
    }

    try {
      voiceBtn.disabled = true;
      recognition.start();
    } catch (e) {
      console.warn("Restarting recognition...");
      recognition = initSpeech();
      recognition.start();
    }
  };
} else {
  voiceBtn.disabled = true;
}

// ================================
// EMBEDDING
// ================================
async function embed(text) {
  const out = await embedder(text, {
    pooling: "mean",
    normalize: true
  });
  return out.data;
}

// ================================
// COSINE SIMILARITY
// ================================
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ================================
// CLASSIFIER
// ================================
async function classify(input) {
  await initRouter();

  const vec = await embed(input);

  let bestType = null;
  let bestScore = -1;

  for (const type in intentVectors) {
    for (const ref of intentVectors[type]) {
      const s = cosine(vec, ref);
      if (s > bestScore) {
        bestScore = s;
        bestType = type;
      }
    }
  }

console.log(bestScore);
  if (bestType === "WEB_SEARCH" && bestScore > 0.52) {
    return `[WEB_SEARCH] "${clean(input)}"`;
  }

  return `[LLM_QUESTION] "${condense(input)}"`;
}

// ================================
// TEXT CLEANING
// ================================

// WEB
function clean(text) {
  let t = text.toLowerCase();

  // normalize entities FIRST
  t = t
    .replace(/\bkl\b/g, "kuala lumpur")
    .replace(/\bbtc\b/g, "bitcoin");

  // remove full phrases
  t = t.replace(/\b(what is|what's|what are|tell me|show me|can you|please|you know|sort of)\b/gi, "");

  // remove weak / useless words
  t = t.replace(/\b(what|which|who|when|where|why|how)\b/gi, "");
  t = t.replace(/\b(is|are|was|were|be|been|being)\b/gi, "");
  t = t.replace(/\b(going|gonna|will|would|should|could)\b/gi, "");

  // remove time fluff (keep meaningful ones like "tomorrow")
  t = t.replace(/\b(right now|currently|at the moment)\b/gi, "");

  // normalize punctuation
  t = t.replace(/[^\p{L}\p{N}\s]/gu, " ");

  let tokens = t.split(/\s+/).filter(Boolean);

  // stronger stopwords
  const stop = new Set([
    "the","a","an","to","of","in","on","for","and","or","it","this","that"
  ]);

  tokens = tokens.filter(w => !stop.has(w));

  // intent-first ordering
  const priority = [
    "weather","forecast","price","stock","bitcoin",
    "news","score","result","time","date","flight","status",
    "sports", "football"
  ];

  tokens.sort((a, b) => {
    const pa = priority.includes(a) ? -1 : 0;
    const pb = priority.includes(b) ? -1 : 0;
    return pa - pb;
  });

  // dedupe
  tokens = [...new Set(tokens)];

  // limit length
  tokens = tokens.slice(0, 6);

  return tokens.join(" ");
}

// LLM
function condense(text) {
  let t = text.toLowerCase();

  // -------------------------
  // 1. Normalize entities FIRST
  // -------------------------
  t = t
    .replace(/\bkl\b/g, "kuala lumpur")
    .replace(/\bbtc\b/g, "bitcoin");

  // -------------------------
  // 2. Remove conversational fluff
  // -------------------------
  const phrases = [
    "can you",
    "could you",
    "would you",
    "please",
    "tell me",
    "i want to know",
    "do you know",
    "help me",
    "is it possible to"
  ];

  var regex = new RegExp(`\\b(${phrases.join("|")})\\b`, "gi");
  t = t.replace(regex, "");

  // -------------------------
  // 3. Remove weak verbs (but KEEP core verbs like "explain why")
  // -------------------------
  
    const verbs = [
    "give",
    "provide",
    "show",
    "list",
    "describe",
    "elaborate",
    "talk about"
  ];

  regex = new RegExp(`\\b(${verbs.join("|")})\\b`, "gi");
  t = t.replace(regex, "");
  
  // -------------------------
  // 4. Normalize question forms
  // -------------------------
  t = t.replace(/\bwhat is\b/g, "");
  t = t.replace(/\bhow does\b/g, "how");
  t = t.replace(/\bwhy does\b/g, "why");

  // -------------------------
  // 5. Remove filler / noise
  // -------------------------
    const filler = [
    "actually",
    "basically",
    "generally",
    "in detail",
    "a bit",
    "a little",
    "kind of",
    "sort of"
  ];

  regex = new RegExp(`\\b(${filler.join("|")})\\b`, "gi");
  t = t.replace(regex, "");


  // -------------------------
  // 6. Remove grammar glue
  // -------------------------
  t = t.replace(/\b(the|a|an|to|of|in|on|for|and|or|it|this|that)\b/gi, "");

  // -------------------------
  // 7. Normalize punctuation
  // -------------------------
  t = t.replace(/[^\p{L}\p{N}\s]/gu, " ");

  let tokens = t.split(/\s+/).filter(Boolean);

  // -------------------------
  // 8. Remove weak endings
  // -------------------------
  tokens = tokens.filter(w => !w.match(/^(is|are|was|were|be|been)$/));

  // -------------------------
  // 9. Deduplicate
  // -------------------------
  tokens = [...new Set(tokens)];

  // -------------------------
  // 10. Keep structure: preserve leading intent words
  // -------------------------
  const intentWords = ["why", "how", "difference", "compare"];

  tokens.sort((a, b) => {
    const pa = intentWords.includes(a) ? -1 : 0;
    const pb = intentWords.includes(b) ? -1 : 0;
    return pa - pb;
  });

  // -------------------------
  // 11. Limit length (LLM efficiency)
  // -------------------------
  // tokens = tokens.slice(0, 8);

  return tokens.join(" ");
}
// ================================
// UI Helpers
// ================================
function appendMessage(text, sender) {
  const chat = document.getElementById('chat-history');

  const el = document.createElement('div');
  el.classList.add('message', sender);
  el.textContent = (text ?? '').toString();

  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

// ================================
// Storage
// ================================
function loadConversations() {
  try {
    return JSON.parse(localStorage.getItem('sieveConversations')) || [];
  } catch {
    return [];
  }
}

function saveConversations(convs) {
  localStorage.setItem('sieveConversations', JSON.stringify(convs));
}

const currentConvIdxKey = 'sieveCurrentConvIdx';

function getCurrentConvIdx() {
  const val = localStorage.getItem(currentConvIdxKey);
  return val !== null ? parseInt(val, 10) : null;
}

function setCurrentConvIdx(idx) {
  localStorage.setItem(currentConvIdxKey, idx);
}

// ================================
// Send Message (ROUTER ONLY)
// ================================
async function sendMessage() {
  const inputEl = document.getElementById('user-input');
  const userInput = (inputEl.value ?? '').toString().trim();
  if (!userInput) return;

  appendMessage(userInput, 'user');
  inputEl.value = '';

  appendMessage('...', 'ai');

  try {
    const result = await classify(userInput);

    const chat = document.getElementById('chat-history');
    chat.lastChild.textContent = result;

  } catch (err) {
    console.error(err);
    const chat = document.getElementById('chat-history');
    chat.lastChild.textContent = 'Error.';
  }
}

// ================================
// Events
// ================================
document.getElementById('send-button').onclick = sendMessage;

document.getElementById('user-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});