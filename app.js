// Global key for storing current conversation index
const currentConvIdxKey = 'sieveCurrentConvIdx';

function getCurrentConvIdx() {
  const val = localStorage.getItem(currentConvIdxKey);
  return val !== null ? parseInt(val, 10) : null;
}

function setCurrentConvIdx(idx) {
  localStorage.setItem(currentConvIdxKey, idx);
}

// Voice input using Web Speech API
const voiceBtn = document.getElementById('voice-input');
if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;
  voiceBtn.addEventListener('click', () => {
    voiceBtn.disabled = true;
    recognition.start();
  });
  recognition.onstart = () => {
    voiceBtn.classList.add('recording');
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('user-input').value = transcript;
    sendMessage();
  };
  recognition.onerror = (event) => {
    console.error(event.error);
  };
  recognition.onend = () => {
    voiceBtn.disabled = false;
    voiceBtn.classList.remove('recording');
  };
} else {
  voiceBtn.disabled = true;
}

// Send message on button click
document.getElementById('send-button').addEventListener('click', sendMessage);

// Send message on Enter key
document.getElementById('user-input').addEventListener('keypress', function(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

// New conversation button
document.getElementById('new-conversation').addEventListener('click', function() {
  // Store current conversation
  storeCurrentConversation();
  // Create a new conversation entry
  const convs = loadConversations();
  const name = 'Chat ' + new Date().toLocaleString();
  convs.push({ name, messages: [] });
  const newIdx = convs.length - 1;
  setCurrentConvIdx(newIdx);
  saveConversations(convs);
  // Clear the chat history for the new conversation
  document.getElementById('chat-history').innerHTML = '';
});

function sendMessage() {
  const userInput = document.getElementById('user-input').value;
  if (!userInput.trim()) return;
  // Display user message
  appendMessage(userInput, 'user');
  // Update stored conversation if exists
  const idx = getCurrentConvIdx();
  if (idx !== null) {
    const convs = loadConversations();
    const conv = convs[idx];
    if (conv) {
      conv.messages.push({ sender: 'user', text: userInput });
      saveConversations(convs);
    }
  }
  // Clear input
  document.getElementById('user-input').value = '';

  // Simulate AI response after a short delay
  setTimeout(function() {
    const aiText = "This is a simulated response to: " + userInput;
    appendMessage(aiText, 'ai');
    const aiIdx = getCurrentConvIdx();
    if (aiIdx !== null) {
      const convs = loadConversations();
      const conv = convs[aiIdx];
      if (conv) {
        conv.messages.push({ sender: 'ai', text: aiText });
        saveConversations(convs);
      }
    }
  }, 1000);
}

function appendMessage(text, sender) {
  const chatHistory = document.getElementById('chat-history');
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', sender);
  messageElement.textContent = text;
  chatHistory.appendChild(messageElement);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Conversation persistence functions
function loadConversations() {
  const stored = localStorage.getItem('sieveConversations');
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveConversations(convs) {
  localStorage.setItem('sieveConversations', JSON.stringify(convs));
}

function renderConversations() {
  const listEl = document.getElementById('conversations-list');
  listEl.innerHTML = '';
  const convs = loadConversations();
  const currentIdx = getCurrentConvIdx();
  convs.forEach((conv, idx) => {
    const li = document.createElement('li');
    li.textContent = conv.name;
    li.dataset.idx = idx;
    li.style.cursor = 'pointer';
    if (idx === currentIdx) li.classList.add('selected');
    li.addEventListener('click', () => loadConversation(idx));
    listEl.appendChild(li);
  });
}

function loadConversation(idx) {
  // Store current conversation before switching
  const currIdx = getCurrentConvIdx();
  if (currIdx !== null) {
    storeCurrentConversation();
  }
  const convs = loadConversations();
  const conv = convs[idx];
  if (!conv) return;
  const chat = document.getElementById('chat-history');
  chat.innerHTML = '';
  conv.messages.forEach(m => appendMessage(m.text, m.sender));
  document.getElementById('conversations-sidebar').style.display = 'none';
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

// Toggle sidebar
const sidebar = document.getElementById('conversations-sidebar');
sidebar.style.display = 'none';

document.getElementById('conversations-btn').addEventListener('click', () => {
  if (sidebar.style.display === 'none' || sidebar.style.display === '') {
    renderConversations();
    sidebar.style.display = 'block';
  } else {
    sidebar.style.display = 'none';
  }
});
