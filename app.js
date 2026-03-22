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