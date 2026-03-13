
(function () {
  'use strict';

  const API_BASE = window.location.origin || '';
  const SESSION_KEY = 'riverwood_session_id';
  const LANG_KEY = 'riverwood_lang';
  
  let sessionId = localStorage.getItem(SESSION_KEY) || generateSessionId();
  let currentLang = localStorage.getItem(LANG_KEY) || 'en';
  let recognition = null;
  let isProcessing = false;
  let abortController = null;

  localStorage.setItem(SESSION_KEY, sessionId);

  const el = {
    conversation: document.getElementById('conversation'),
    userInput: document.getElementById('user-input'),
    voiceBtn: document.getElementById('voice-btn'),
    sendBtn: document.getElementById('send-btn'),
    status: document.getElementById('status'),
    langBtns: document.querySelectorAll('.lang-btn'),
  };

  if (!el.conversation || !el.userInput || !el.sendBtn || !el.status) return;

  function generateSessionId() {
    return 'ses_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function setStatus(text, isError = false) {
    el.status.textContent = text || '';
    el.status.classList.toggle('error', isError);
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function appendMessage(role, content, options = {}) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg ' + (role === 'assistant' ? 'assistant' : 'user');
    const roleLabel = role === 'assistant' ? 'Agent' : 'You';
    const contentClass = options.loading ? 'content loading' : 'content';
    msgDiv.innerHTML =
      '<div class="role">' + escapeHtml(roleLabel) + '</div>' +
      '<div class="' + contentClass + '">' + escapeHtml(content || '') + '</div>';
    el.conversation.appendChild(msgDiv);
    el.conversation.scrollTop = el.conversation.scrollHeight;
    return msgDiv;
  }

  function updateMessageContent(msgDiv, content) {
    const contentEl = msgDiv?.querySelector('.content');
    if (contentEl) {
      contentEl.textContent = content || '';
      contentEl.classList.remove('loading');
    }
  }

  function getSpeechLang() {
    if (currentLang === 'hi') return 'hi-IN';
    if (currentLang === 'mr') return 'mr-IN';
    return 'en-IN';
  }

  let currentAudio = null;

  function speakText(text, audioBase64 = null) {
    // Stop any current audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    window.speechSynthesis?.cancel();

    // If we have server-generated audio (ElevenLabs/OpenAI), use that
    if (audioBase64) {
      try {
        const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
        audio.playbackRate = 1.0;
        currentAudio = audio;
        audio.play().catch(err => {
          console.warn('Audio playback failed, falling back to browser TTS:', err);
          speakWithBrowserTTS(text);
        });
        return;
      } catch (err) {
        console.warn('Audio creation failed:', err);
      }
    }

    // Fallback to browser TTS
    speakWithBrowserTTS(text);
  }

  function speakWithBrowserTTS(text) {
    if (!window.speechSynthesis || !text) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 500));
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.05; // Slightly higher for warmth
    utterance.lang = getSpeechLang();
    
    // Find the best available voice
    const voices = window.speechSynthesis.getVoices();
    const voice = findBestVoice(voices, currentLang);
    if (voice) utterance.voice = voice;
    
    window.speechSynthesis.speak(utterance);
  }

  function findBestVoice(voices, lang) {
    if (!voices.length) return null;
    
    // Preferred voices by language (Google/Microsoft voices are usually better)
    const preferences = {
      en: ['Google UK English Female', 'Microsoft Zira', 'Samantha', 'Karen', 'Google US English'],
      hi: ['Google हिन्दी', 'Microsoft Hemant', 'Lekha', 'hi-IN'],
      mr: ['Google मराठी', 'mr-IN'],
    };
    
    const langPrefs = preferences[lang] || preferences.en;
    const langCode = lang === 'hi' ? 'hi' : lang === 'mr' ? 'mr' : 'en';
    
    // Try to find preferred voice
    for (const pref of langPrefs) {
      const found = voices.find(v => 
        v.name.includes(pref) || v.lang.startsWith(pref)
      );
      if (found) return found;
    }
    
    // Fallback: any female voice in the language
    const femaleVoice = voices.find(v => 
      v.lang.startsWith(langCode) && 
      (v.name.toLowerCase().includes('female') || 
       v.name.includes('Zira') || 
       v.name.includes('Samantha'))
    );
    if (femaleVoice) return femaleVoice;
    
    // Last resort: any voice in the language
    return voices.find(v => v.lang.startsWith(langCode));
  }

  function getGreetingPrompt() {
    const instruction = 'Greet the customer warmly. Share a brief construction progress update for Riverwood Estate (e.g., current phase, recent milestones). Ask if they would like to schedule a site visit. Keep it conversational (3-4 sentences).';
    
    if (currentLang === 'hi') {
      return instruction + ' Respond ONLY in Hindi using Devanagari script.';
    }
    if (currentLang === 'mr') {
      return instruction + ' Respond ONLY in Marathi using Devanagari script.';
    }
    return instruction + ' Respond in English.';
  }

  async function startConversation() {
    setStatus('Connecting…');
    
    try {
      const response = await fetch(`${API_BASE}/api/chat-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: getGreetingPrompt(),
          language: currentLang,
          stream: false,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || response.statusText);
      }

      if (data.sessionId) {
        sessionId = data.sessionId;
        localStorage.setItem(SESSION_KEY, sessionId);
      }

      appendMessage('assistant', data.reply);
      setStatus(data.ttsProvider ? `Ready (${data.ttsProvider} voice)` : 'Ready. Type or use voice to respond.');
      speakText(data.reply, data.audioBase64);
    } catch (err) {
      console.error('Start conversation error:', err);
      appendMessage('assistant', 'Welcome to Riverwood Estate! How can I help you today?');
      setStatus('Connected (limited mode)', true);
      speakText('Welcome to Riverwood Estate! How can I help you today?');
    }
  }

  async function sendMessageStreaming(text) {
    if (isProcessing) return;
    
    const message = (text ?? el.userInput.value || '').trim();
    if (!message) return;

    el.userInput.value = '';
    appendMessage('user', message);
    
    setStatus('Thinking…');
    setProcessing(true);
    
    const loadingRow = appendMessage('assistant', '', { loading: true });
    let fullReply = '';

    try {
      abortController = new AbortController();
      
      const response = await fetch(`${API_BASE}/api/chat-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message,
          language: currentLang,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let audioBase64 = null;
      let ttsProvider = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'session' && data.sessionId) {
                sessionId = data.sessionId;
                localStorage.setItem(SESSION_KEY, sessionId);
              } else if (data.type === 'token' && data.content) {
                fullReply += data.content;
                updateMessageContent(loadingRow, fullReply);
              } else if (data.type === 'done') {
                fullReply = data.fullReply || fullReply;
                audioBase64 = data.audioBase64 || null;
                ttsProvider = data.ttsProvider || null;
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      updateMessageContent(loadingRow, fullReply);
      setStatus(ttsProvider ? `Ready (${ttsProvider} voice)` : 'Ready.');
      speakText(fullReply, audioBase64);
    } catch (err) {
      if (err.name === 'AbortError') {
        updateMessageContent(loadingRow, 'Response cancelled.');
        setStatus('Cancelled.');
      } else {
        console.error('Send message error:', err);
        updateMessageContent(loadingRow, 'Sorry, I couldn\'t respond. Please try again.');
        setStatus(err.message || 'Connection error', true);
      }
    } finally {
      setProcessing(false);
      abortController = null;
    }
  }

  function setProcessing(processing) {
    isProcessing = processing;
    el.sendBtn.disabled = processing;
    if (el.voiceBtn) el.voiceBtn.disabled = processing;
  }

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !el.voiceBtn) {
      if (el.voiceBtn) el.voiceBtn.disabled = true;
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = getSpeechLang();

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const transcript = result[0].transcript;
        if (transcript) sendMessageStreaming(transcript);
      } else {
        el.userInput.value = result[0].transcript;
      }
    };

    recognition.onerror = () => {
      el.voiceBtn?.classList.remove('recording');
      setStatus('Voice input ended.');
    };

    recognition.onend = () => {
      el.voiceBtn?.classList.remove('recording');
      el.voiceBtn?.setAttribute('aria-pressed', 'false');
    };
  }

  // Event listeners
  el.sendBtn.addEventListener('click', () => sendMessageStreaming());
  
  el.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageStreaming();
    }
  });

  if (el.voiceBtn) {
    el.voiceBtn.addEventListener('mousedown', () => {
      if (!recognition || isProcessing) return;
      recognition.lang = getSpeechLang();
      el.voiceBtn.classList.add('recording');
      el.voiceBtn.setAttribute('aria-pressed', 'true');
      setStatus('Listening…');
      try {
        recognition.start();
      } catch {
        setStatus('Voice not available.');
      }
    });

    el.voiceBtn.addEventListener('mouseup', () => {
      if (recognition) {
        try { recognition.stop(); } catch {}
      }
      el.voiceBtn.setAttribute('aria-pressed', 'false');
    });

    el.voiceBtn.addEventListener('mouseleave', () => {
      if (recognition) {
        try { recognition.stop(); } catch {}
      }
      el.voiceBtn.setAttribute('aria-pressed', 'false');
    });
  }

  // Language switching
  if (el.langBtns?.length) {
    // Set initial active state based on saved language
    el.langBtns.forEach(btn => {
      const lang = btn.getAttribute('data-lang');
      const isActive = lang === currentLang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    el.langBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        if (!lang || lang === currentLang) return;

        currentLang = lang;
        localStorage.setItem(LANG_KEY, currentLang);

        el.langBtns.forEach((b) => {
          const active = b.getAttribute('data-lang') === currentLang;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        if (recognition) recognition.lang = getSpeechLang();
        
        const langNames = { en: 'English', hi: 'हिंदी', mr: 'मराठी' };
        setStatus(`Language: ${langNames[currentLang]}`);

        // Start new session for new language
        sessionId = generateSessionId();
        localStorage.setItem(SESSION_KEY, sessionId);
        el.conversation.innerHTML = '';
        startConversation();
      });
    });
  }

  // Initialize
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
  
  initSpeechRecognition();
  startConversation();
})();
