document.getElementById('send-button').addEventListener('click', sendMessage);

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

document.getElementById('user-input').addEventListener('keypress', function(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

document.getElementById('new-conversation').addEventListener('click', function() {
  storeCurrentConversation();
  // Clear the chat history
  document.getElementById('chat-history').innerHTML = '';
});

function sendMessage() {
  const userInput = document.getElementById('user-input').value;

  if (!userInput.trim()) return;

  // Display user message
  appendMessage(userInput, 'user');

  // Clear input
  document.getElementById('user-input').value = '';

  // Simulate AI response after a short delay
  setTimeout(function() {
    appendMessage("This is a simulated response to: " + userInput, 'ai');
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
  convs.forEach((conv, idx) => {
    const li = document.createElement('li');
    li.textContent = conv.name;
    li.dataset.idx = idx;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => loadConversation(idx));
    listEl.appendChild(li);
  });
}

function loadConversation(idx) {
  const convs = loadConversations();
  const conv = convs[idx];
  if (!conv) return;
  const chat = document.getElementById('chat-history');
  chat.innerHTML = '';
  conv.messages.forEach(m => appendMessage(m.text, m.sender));
  document.getElementById('conversations-sidebar').style.display = 'none';
}

function storeCurrentConversation() {
  const chat = document.getElementById('chat-history');
  const msgs = Array.from(chat.children).map(el => ({
    sender: el.classList.contains('user') ? 'user' : 'ai',
    text: el.textContent
  }));
  const convs = loadConversations();
  const name = 'Chat ' + new Date().toLocaleString();
  convs.push({name, messages: msgs});
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
