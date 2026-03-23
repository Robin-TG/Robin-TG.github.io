// ================================
// CONFIG (MODEL)
// ================================
const MODEL_NAME = 
// "HuggingFaceTB/SmolLM2-360M-Instruct"; 
"HuggingFaceTB/SmolLM3-3B-ONNX";
// "onnx-community/Qwen2.5-0.5B-Instruct";
// 'Xenova/Qwen2.5-0.5B-Instruct'
//'Xenova/TinyLlama-1.1B-Chat-v1.0'; // -q4';

let generator = null;
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
  transformers.env.HF_TOKEN = null;
}

// ================================
// Load Model (SAFE)
// ================================
async function loadModel() {
  if (generator) return generator;

  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await ensureTransformersLoaded();

    const pipe = await transformers.pipeline(
      'text-generation',
      MODEL_NAME,
      {
        dtype: 'q4f16',
        device: 'webgpu',
        return_full_text: false,
        temperature: 0.2,
        progress_callback: (p) => console.log('Loading:', p),
      }
    );

    console.log('✅ Model loaded');
    generator = pipe;
    return generator;
  })();

  return loadingPromise;
}

// ================================
// Conversation State
// ================================
const currentConvIdxKey = 'sieveCurrentConvIdx';

function getCurrentConvIdx() {
  const val = localStorage.getItem(currentConvIdxKey);
  return val !== null ? parseInt(val, 10) : null;
}

function setCurrentConvIdx(idx) {
  localStorage.setItem(currentConvIdxKey, idx);
}

// ================================
// Prompt Builder
// ================================
function buildPrompt(history, userInput) {
  history = (history ?? '').toString();
  userInput = (userInput ?? '').toString();

  let oldprompt = `<|system|>
You are a helpful assistant.
</s>
`;

  if (history) oldprompt += history + '\n';

  oldprompt += `<|user|>
${userInput}
</s>
<|assistant|>
`;

let prompt = `<|im_start|>system
You are a routing classifier.

Task: classify the user message.

Output format (must match exactly):
TYPE=<WEB_SEARCH|LLM>
QUERY=<short keywords>

Rules:
- Output ONLY the format above
- No explanations
- No quotes
- No sentences
- Do NOT answer the question

Definitions:
WEB_SEARCH = real-world, current, or time-based information
LLM = explanations, reasoning, general knowledge

<|im_end|>
<|im_start|>user
${userInput}<|im_end|>
<|im_start|>assistant
`;

  return prompt;
}

// ================================
// Generate Answer
// ================================
async function generateAnswer(history, userInput) {
  const pipe = await loadModel();

  if (!pipe) throw new Error('Model failed to load');

  const safeHistory = (history ?? '').toString();
  const safeInput = (userInput ?? '').toString();

  const prompt = buildPrompt(safeHistory, safeInput);

  if (!prompt || typeof prompt !== 'string') {
    console.error('BAD PROMPT:', prompt);
    throw new Error('Invalid prompt');
  }

  console.log('PROMPT:', prompt);

  const output = await pipe(prompt, {
    max_new_tokens: 360,
    temperature: 0.2,
    top_p: 0.9,
    repetition_penalty: 1.15,
  });

  let text = output?.[0]?.generated_text ?? '';

  if (text.includes('<|assistant|>')) {
    text = text.split('<|assistant|>').pop();
  }

  if (text.includes('<|user|>')) {
    text = text.split('<|user|>')[0];
  }

  return text.trim() || '...';
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

// ================================
// Send Message
// ================================
async function sendMessage() {
  const inputEl = document.getElementById('user-input');
  const userInput = (inputEl.value ?? '').toString().trim();
  if (!userInput) return;

  inputEl.classList.remove('interim');

  appendMessage(userInput, 'user');
  inputEl.value = '';

  const convs = loadConversations();
  const idx = getCurrentConvIdx();

  let history = '';

  if (idx !== null && convs[idx]) {
    const conv = convs[idx];

    history = conv.messages
      .map(m => {
        const safeText = (m.text ?? '').toString();

        return m.sender === 'user'
          ? `<|user|>\n${safeText}\n</s>`
          : `<|assistant|>\n${safeText}\n</s>`;
      })
      .join('\n');

    conv.messages.push({ sender: 'user', text: userInput });
  }

  saveConversations(convs);

  appendMessage('...', 'ai');

  try {
    const aiText = await generateAnswer(history, userInput);

    const chat = document.getElementById('chat-history');
    chat.lastChild.textContent = aiText;

    if (idx !== null && convs[idx]) {
      convs[idx].messages.push({ sender: 'ai', text: aiText });
      saveConversations(convs);
    }
  } catch (err) {
    console.error(err);
    const chat = document.getElementById('chat-history');
    chat.lastChild.textContent = 'Error generating response.';
  }
}

// ================================
// Voice Input (FINAL ONLY)
// ================================
const voiceBtn = document.getElementById('voice-input');

if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();

  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;

  let finalTranscript = '';

  voiceBtn.onclick = () => {
    voiceBtn.disabled = true;
    recognition.start();
  };

  recognition.onstart = () => {
    finalTranscript = '';
    voiceBtn.classList.add('recording');
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = (event.results[i][0].transcript ?? '').toString();

      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    const inputEl = document.getElementById('user-input');

    const displayText = (finalTranscript + interimTranscript).trim();
    inputEl.value = displayText || '';

    if (interimTranscript.length > 0) {
      inputEl.classList.add('interim');
    } else {
      inputEl.classList.remove('interim');
    }
  };

  recognition.onerror = (e) => console.error(e);

  recognition.onend = () => {
    voiceBtn.disabled = false;
    voiceBtn.classList.remove('recording');

    const finalText = (finalTranscript ?? '').trim();

    if (finalText.length > 0) {
      const inputEl = document.getElementById('user-input');
      inputEl.value = finalText;
      inputEl.classList.remove('interim');

      sendMessage();
    }
  };
} else {
  voiceBtn.disabled = true;
}

// ================================
// Conversation UI
// ================================
function renderConversations() {
  const list = document.getElementById('conversations-list');
  list.innerHTML = '';

  const convs = loadConversations();
  const currentIdx = getCurrentConvIdx();

  convs.forEach((conv, idx) => {
    const li = document.createElement('li');
    li.textContent = conv.name;
    li.style.cursor = 'pointer';

    if (idx === currentIdx) li.classList.add('selected');

    li.onclick = () => loadConversation(idx);

    list.appendChild(li);
  });
}

function loadConversation(idx) {
  const convs = loadConversations();
  const conv = convs[idx];
  if (!conv) return;

  const chat = document.getElementById('chat-history');
  chat.innerHTML = '';

  conv.messages.forEach(m =>
    appendMessage((m.text ?? '').toString(), m.sender)
  );

  setCurrentConvIdx(idx);
  renderConversations();
}

function storeCurrentConversation() {
  const idx = getCurrentConvIdx();
  const chat = document.getElementById('chat-history');

  const msgs = Array.from(chat.children).map(el => ({
    sender: el.classList.contains('user') ? 'user' : 'ai',
    text: (el.textContent ?? '').toString()
  }));

  const convs = loadConversations();
  const name = 'Chat ' + new Date().toLocaleString();

  if (idx !== null && convs[idx]) {
    convs[idx] = { name, messages: msgs };
  } else {
    convs.push({ name, messages: msgs });
    setCurrentConvIdx(convs.length - 1);
  }

  saveConversations(convs);
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

document.getElementById('new-conversation').onclick = () => {
  storeCurrentConversation();

  const convs = loadConversations();
  const name = 'Chat ' + new Date().toLocaleString();

  convs.push({ name, messages: [] });
  setCurrentConvIdx(convs.length - 1);

  saveConversations(convs);
  document.getElementById('chat-history').innerHTML = '';
};

const sidebar = document.getElementById('conversations-sidebar');
sidebar.style.display = 'none';

document.getElementById('conversations-btn').onclick = () => {
  if (sidebar.style.display === 'none') {
    renderConversations();
    sidebar.style.display = 'block';
  } else {
    sidebar.style.display = 'none';
  }
};