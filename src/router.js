import { clean, condense } from './routeText.js';

const EMBED_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

const INTENTS = {
  WEB_SEARCH: [
    'weather forecast tomorrow',
    'weather next week',
    'latest news today',
    'current bitcoin price',
    'football match result',
    'latest sports news',
    'flight status today',
    'time in Tokyo',
    'restaurants near me',
  ],
  LLM_QUESTION: [
    'explain a concept',
    'how something works',
    'why something happens',
    'difference between two things',
    'write an example',
    'summarize this text',
    'you know about',
    'want to know about',
  ],
};

let embedder = null;
let intentVectors = null;
let loadingPromise = null;

/** Set from React so progress survives Strict Mode (pipeline callback is created once). */
let routerProgressHandler = null;

export function setRouterProgressHandler(fn) {
  routerProgressHandler = typeof fn === 'function' ? fn : null;
}

export function percentFromRouterProgress(p) {
  if (p == null || typeof p !== 'object') return null;
  if (p.status === 'initiate') return 0;
  if (typeof p.progress === 'number' && Number.isFinite(p.progress)) {
    const x = p.progress;
    return Math.round(x <= 1 ? x * 100 : Math.min(100, x));
  }
  if (typeof p.loaded === 'number' && typeof p.total === 'number' && p.total > 0) {
    return Math.min(100, Math.round((p.loaded / p.total) * 100));
  }
  return null;
}

async function ensureTransformersLoaded() {
  if (typeof window !== 'undefined' && window.transformers) return;

  const mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers');

  window.transformers = mod;
  const { env } = mod;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.useFS = false;
}

export async function initRouter() {
  if (embedder) return embedder;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await ensureTransformersLoaded();
    const { pipeline } = window.transformers;

    embedder = await pipeline('feature-extraction', EMBED_MODEL, {
      dtype: 'q4',
      progress_callback: (p) => {
        console.log('Loading router:', p);
        routerProgressHandler?.(p);
      },
    });

    intentVectors = {};

    for (const type in INTENTS) {
      intentVectors[type] = [];
      for (const example of INTENTS[type]) {
        intentVectors[type].push(await embed(example));
      }
    }

    console.log('+ Router ready');
    return embedder;
  })();

  return loadingPromise;
}

async function embed(text) {
  const out = await embedder(text, {
    pooling: 'mean',
    normalize: true,
  });
  return out.data;
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function classify(input) {
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
  if (bestType === 'WEB_SEARCH' && bestScore > 0.52) {
    const q = clean(input);
    const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    window.open(url, '_blank');
    return `[WEB_SEARCH] "${clean(input)}"`;
  }

  return `[LLM_QUESTION] "${condense(input)}"`;
}
