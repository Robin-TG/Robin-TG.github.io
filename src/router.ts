import { clean, condense } from './routeText.js';

const EMBED_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

type IntentType = 'WEB_SEARCH' | 'LLM_QUESTION';

interface IntentVectors {
  WEB_SEARCH: Float32Array[];
  LLM_QUESTION: Float32Array[];
}

const INTENTS: Record<IntentType, string[]> = {
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

interface TransformerPipeline {
  (text: string, options?: Record<string, unknown>): Promise<{
    data: Float32Array;
  }>;
}

interface TransformersModule {
  pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<TransformerPipeline>;
  env: {
    allowLocalModels: boolean;
    useBrowserCache: boolean;
    useFS: boolean;
  };
}

declare global {
  interface Window {
    transformers?: TransformersModule;
  }
}

let embedder: TransformerPipeline | null = null;
let intentVectors: IntentVectors | null = null;
let loadingPromise: Promise<TransformerPipeline | null> | null = null;

type RouterProgressHandler = ((p: unknown) => void) | null;

let routerProgressHandler: RouterProgressHandler = null;

export function setRouterProgressHandler(fn: RouterProgressHandler): void {
  routerProgressHandler = typeof fn === 'function' ? fn : null;
}

export interface FileProgress {
  file?: string;
  percent: number;
  complete?: boolean;
}

export function percentFromRouterProgress(p: unknown): number | null {
  if (p == null || typeof p !== 'object') return null;
  const obj = p as Record<string, unknown>;
  if (obj.status === 'initiate') return 0;
  if (typeof obj.progress === 'number' && Number.isFinite(obj.progress)) {
    const x = obj.progress;
    return Math.round(x <= 1 ? x * 100 : Math.min(100, x));
  }
  if (typeof obj.loaded === 'number' && typeof obj.total === 'number' && obj.total > 0) {
    return Math.min(100, Math.round((obj.loaded / obj.total) * 100));
  }
  return null;
}

export function extractFileProgress(p: unknown): FileProgress {
  if (p == null || typeof p !== 'object') return { percent: 0 };
  const obj = p as Record<string, unknown>;
  const percent = percentFromRouterProgress(p) ?? 0;
  const file = typeof obj.file === 'string' ? obj.file : undefined;
  return { file, percent };
}

async function ensureTransformersLoaded(): Promise<void> {
  if (typeof window !== 'undefined' && window.transformers) return;

  const mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers');

  window.transformers = mod;
  const { env } = mod;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.useFS = false;
}

export async function initRouter(): Promise<TransformerPipeline> {
  if (embedder) return embedder;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await ensureTransformersLoaded();
    const { pipeline } = window.transformers!;

    embedder = await pipeline('feature-extraction', EMBED_MODEL, {
      dtype: 'q4',
      progress_callback: (p: unknown) => {
        console.log('Loading router:', p);
        routerProgressHandler?.(p);
      },
    });

    intentVectors = {
      WEB_SEARCH: [],
      LLM_QUESTION: [],
    };

    for (const type of Object.keys(INTENTS) as IntentType[]) {
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

async function embed(text: string): Promise<Float32Array> {
  const out = await embedder!(text, {
    pooling: 'mean',
    normalize: true,
  });
  return out.data;
}

function cosine(a: Float32Array, b: Float32Array): number {
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

export async function classify(input: string): Promise<string> {
  await initRouter();

  const vec = await embed(input);
  let bestType: IntentType | null = null;
  let bestScore = -1;

  for (const type of Object.keys(intentVectors!) as IntentType[]) {
    for (const ref of intentVectors![type]) {
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
