// ================================
// HF Transformers Setup (FIX 401)
// ================================
let generator = null;

async function ensureTransformersLoaded() {
  if (window.transformers) return;

  const mod = await import(
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers'
  );

  window.transformers = mod;

  // 🔥 CRITICAL: prevent 401 errors
  transformers.env.HF_TOKEN = undefined;
  transformers.env.useBrowserCache = true;
  transformers.env.allowLocalModels = false;
  transformers.env.useFS = false;
}

// ================================
// Load Model (FAST + RELIABLE)
// ================================
async function loadModel() {
  if (generator) return;

  await ensureTransformersLoaded();

  generator = await transformers.pipeline(
    'text-generation',
    'Xenova/TinyLlama-1.1B-Chat-v1.0'
  );
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
// Prompt Builder (CHAT FORMAT)
// ================================
function buildPrompt(history, userInput) {
  let prompt = `<|system|>
You are a helpful, concise assistant.
</s>
`;

  if (history) {
    prompt += history + '\n';
  }

  prompt += `<|user|>
${userInput}
</s>
<|assistant|>
`;

  return prompt;
}

// ================================
// Generate Answer
// ================================
async function generateAnswer(history, userInput) {
  await loadModel();
  if (!generator) return 'Model failed to load.';

  const prompt = buildPrompt(history, userInput);

  const output = await generator(prompt, {
    max_new_tokens: 120,
    temperature: 0.7,
    top_p: 0.9,
    repetition_penalty: 1.15,
  });

  let text = output[0].generated_text;

  // Extract assistant response
  if (text.includes('<|assistant|>')) {
    text = text.split('<|assistant|>').pop();
  }

  if (text.includes('<|user|>')) {
    text = text.split('<|user|>')[0];
  }

  return text.trim() || '…';
}

// ================================
// UI Helpers
// ================================
function appendMessage(text, sender) {
  const chat = document.getElementById('chat-history');

  const el = document.createElement('div');
  el.classList.add('message', sender);
  el.textContent = text;

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
  const userInput = inputEl.value.trim();
  if (!userInput) return;

  appendMessage(userInput, 'user');
  inputEl.value = '';

  const convs = loadConversations();
  const idx = getCurrentConvIdx();

  let history = '';

  if (idx !== null && convs[idx]) {
    const conv = convs[idx];

    history = conv.messages
      .map(m =>
        m.sender === 'user'
          ? `<|user|>\n${m.text}\n</s>`
          : `<|assistant|>\n${m.text}\n</s>`
      )
      .join('\n');

    conv.messages.push({ sender: 'user', text: userInput });
  }

  saveConversations(convs);

  appendMessage('...', 'ai');

  const aiText = await generateAnswer(history, userInput);

  const chat = document.getElementById('chat-history');
  chat.lastChild.textContent = aiText;

  if (idx !== null && convs[idx]) {
    convs[idx].messages.push({ sender: 'ai', text: aiText });
    saveConversations(convs);
  }
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

  conv.messages.forEach(m => appendMessage(m.text, m.sender));

  setCurrentConvIdx(idx);
  renderConversations();
}

function storeCurrentConversation() {
  const idx = getCurrentConvIdx();
  const chat = document.getElementById('chat-history');

  const msgs = Array.from(chat.children).map(el => ({
    sender: el.classList.contains('user') ? 'user' : 'ai',
    text: el.textContent
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
// Voice Input
// ================================
const voiceBtn = document.getElementById('voice-input');

if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();

  rec.lang = 'en-US';

  voiceBtn.onclick = () => {
    voiceBtn.disabled = true;
    voiceBtn.classList.add('recording');
    rec.start();
  };

  rec.onresult = (e) => {
    document.getElementById('user-input').value =
      e.results[0][0].transcript;
    sendMessage();
  };

  rec.onend = () => {
    voiceBtn.disabled = false;
    voiceBtn.classList.remove('recording');
  };
} else {
  voiceBtn.disabled = true;
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