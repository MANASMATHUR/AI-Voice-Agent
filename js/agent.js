/**
 * AI Voice Agent – Riverwood Estate
 * Features: Streaming responses, persistent memory, multi-language support
 */
(function () {
  'use strict';

  var API_BASE = window.location.origin || '';
  var SESSION_KEY = 'riverwood_session_id';
  var LANG_KEY = 'riverwood_lang';
  
  var sessionId = localStorage.getItem(SESSION_KEY) || generateSessionId();
  var currentLang = localStorage.getItem(LANG_KEY) || 'en';
  var recognition = null;
  var isProcessing = false;
  var abortController = null;
  var currentAudio = null;

  localStorage.setItem(SESSION_KEY, sessionId);

  var el = {
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

  function setStatus(text, isError) {
    el.status.textContent = text || '';
    el.status.classList.toggle('error', Boolean(isError));
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function appendMessage(role, content, options) {
    options = options || {};
    var msgDiv = document.createElement('div');
    msgDiv.className = 'msg ' + (role === 'assistant' ? 'assistant' : 'user');
    var roleLabel = role === 'assistant' ? 'Agent' : 'You';
    var contentClass = options.loading ? 'content loading' : 'content';
    msgDiv.innerHTML =
      '<div class="role">' + escapeHtml(roleLabel) + '</div>' +
      '<div class="' + contentClass + '">' + escapeHtml(content || '') + '</div>';
    el.conversation.appendChild(msgDiv);
    el.conversation.scrollTop = el.conversation.scrollHeight;
    return msgDiv;
  }

  function updateMessageContent(msgDiv, content) {
    if (!msgDiv) return;
    var contentEl = msgDiv.querySelector('.content');
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

  function speakText(text, audioBase64) {
    // Stop any current audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // If we have server-generated audio (ElevenLabs/OpenAI), use that
    if (audioBase64) {
      try {
        var audio = new Audio('data:audio/mpeg;base64,' + audioBase64);
        audio.playbackRate = 1.0;
        currentAudio = audio;
        audio.play().catch(function(err) {
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
    var utterance = new SpeechSynthesisUtterance(String(text).slice(0, 500));
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.lang = getSpeechLang();
    
    var voices = window.speechSynthesis.getVoices();
    var voice = findBestVoice(voices, currentLang);
    if (voice) utterance.voice = voice;
    
    window.speechSynthesis.speak(utterance);
  }

  function findBestVoice(voices, lang) {
    if (!voices || !voices.length) return null;
    
    var preferences = {
      en: ['Google UK English Female', 'Microsoft Zira', 'Samantha', 'Karen', 'Google US English'],
      hi: ['Google हिन्दी', 'Microsoft Hemant', 'Lekha', 'hi-IN'],
      mr: ['Google मराठी', 'mr-IN'],
    };
    
    var langPrefs = preferences[lang] || preferences.en;
    var langCode = lang === 'hi' ? 'hi' : lang === 'mr' ? 'mr' : 'en';
    
    // Try to find preferred voice
    for (var i = 0; i < langPrefs.length; i++) {
      var pref = langPrefs[i];
      for (var j = 0; j < voices.length; j++) {
        if (voices[j].name.indexOf(pref) !== -1 || voices[j].lang.indexOf(pref) === 0) {
          return voices[j];
        }
      }
    }
    
    // Fallback: any voice in the language
    for (var k = 0; k < voices.length; k++) {
      if (voices[k].lang.indexOf(langCode) === 0) {
        return voices[k];
      }
    }
    
    return null;
  }

  function getGreetingPrompt() {
    var instruction = 'Greet the customer warmly. Share a brief construction progress update for Riverwood Estate (e.g., current phase, recent milestones). Ask if they would like to schedule a site visit. Keep it conversational (3-4 sentences).';
    
    if (currentLang === 'hi') {
      return instruction + ' Respond ONLY in Hindi using Devanagari script.';
    }
    if (currentLang === 'mr') {
      return instruction + ' Respond ONLY in Marathi using Devanagari script.';
    }
    return instruction + ' Respond in English.';
  }

  function startConversation() {
    setStatus('Connecting…');
    
    fetch(API_BASE + '/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        message: getGreetingPrompt(),
        language: currentLang,
        stream: false,
      }),
    })
    .then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) {
          throw new Error(data.error || response.statusText);
        }
        return data;
      });
    })
    .then(function(data) {
      if (data.sessionId) {
        sessionId = data.sessionId;
        localStorage.setItem(SESSION_KEY, sessionId);
      }

      appendMessage('assistant', data.reply);
      setStatus(data.ttsProvider ? 'Ready (' + data.ttsProvider + ' voice)' : 'Ready. Type or use voice to respond.');
      speakText(data.reply, data.audioBase64);
    })
    .catch(function(err) {
      console.error('Start conversation error:', err);
      appendMessage('assistant', 'Welcome to Riverwood Estate! How can I help you today?');
      setStatus('Connected (limited mode)', true);
      speakText('Welcome to Riverwood Estate! How can I help you today?');
    });
  }

  function sendMessageStreaming(text) {
    if (isProcessing) return;
    
    var message = (text !== undefined && text !== null ? String(text) : el.userInput.value || '').trim();
    if (!message) return;

    el.userInput.value = '';
    appendMessage('user', message);
    
    setStatus('Thinking…');
    setProcessing(true);
    
    var loadingRow = appendMessage('assistant', '', { loading: true });
    var fullReply = '';
    var audioBase64 = null;
    var ttsProvider = null;

    abortController = new AbortController();
    
    fetch(API_BASE + '/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        message: message,
        language: currentLang,
        stream: true,
      }),
      signal: abortController.signal,
    })
    .then(function(response) {
      if (!response.ok) {
        return response.json().then(function(data) {
          throw new Error(data.error || 'Request failed');
        });
      }
      
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      
      function readChunk() {
        return reader.read().then(function(result) {
          if (result.done) return;
          
          var chunk = decoder.decode(result.value);
          var lines = chunk.split('\n');
          
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('data: ') === 0) {
              try {
                var data = JSON.parse(line.slice(6));
                
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
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
          
          return readChunk();
        });
      }
      
      return readChunk();
    })
    .then(function() {
      updateMessageContent(loadingRow, fullReply);
      setStatus(ttsProvider ? 'Ready (' + ttsProvider + ' voice)' : 'Ready.');
      speakText(fullReply, audioBase64);
    })
    .catch(function(err) {
      if (err.name === 'AbortError') {
        updateMessageContent(loadingRow, 'Response cancelled.');
        setStatus('Cancelled.');
      } else {
        console.error('Send message error:', err);
        updateMessageContent(loadingRow, 'Sorry, I couldn\'t respond. Please try again.');
        setStatus(err.message || 'Connection error', true);
      }
    })
    .finally(function() {
      setProcessing(false);
      abortController = null;
    });
  }

  function setProcessing(processing) {
    isProcessing = processing;
    el.sendBtn.disabled = processing;
    if (el.voiceBtn) el.voiceBtn.disabled = processing;
  }

  function initSpeechRecognition() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !el.voiceBtn) {
      if (el.voiceBtn) el.voiceBtn.disabled = true;
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = getSpeechLang();

    recognition.onresult = function(event) {
      var result = event.results[event.results.length - 1];
      if (result.isFinal) {
        var transcript = result[0].transcript;
        if (transcript) sendMessageStreaming(transcript);
      } else {
        el.userInput.value = result[0].transcript;
      }
    };

    recognition.onerror = function() {
      if (el.voiceBtn) el.voiceBtn.classList.remove('recording');
      setStatus('Voice input ended.');
    };

    recognition.onend = function() {
      if (el.voiceBtn) {
        el.voiceBtn.classList.remove('recording');
        el.voiceBtn.setAttribute('aria-pressed', 'false');
      }
    };
  }

  // Event listeners
  el.sendBtn.addEventListener('click', function() { sendMessageStreaming(); });
  
  el.userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageStreaming();
    }
  });

  if (el.voiceBtn) {
    el.voiceBtn.addEventListener('mousedown', function() {
      if (!recognition || isProcessing) return;
      recognition.lang = getSpeechLang();
      el.voiceBtn.classList.add('recording');
      el.voiceBtn.setAttribute('aria-pressed', 'true');
      setStatus('Listening…');
      try {
        recognition.start();
      } catch (e) {
        setStatus('Voice not available.');
      }
    });

    el.voiceBtn.addEventListener('mouseup', function() {
      if (recognition) {
        try { recognition.stop(); } catch (e) {}
      }
      el.voiceBtn.setAttribute('aria-pressed', 'false');
    });

    el.voiceBtn.addEventListener('mouseleave', function() {
      if (recognition) {
        try { recognition.stop(); } catch (e) {}
      }
      el.voiceBtn.setAttribute('aria-pressed', 'false');
    });
  }

  // Language switching
  if (el.langBtns && el.langBtns.length) {
    // Set initial active state
    el.langBtns.forEach(function(btn) {
      var lang = btn.getAttribute('data-lang');
      var isActive = lang === currentLang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    el.langBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var lang = btn.getAttribute('data-lang');
        if (!lang || lang === currentLang) return;

        currentLang = lang;
        localStorage.setItem(LANG_KEY, currentLang);

        el.langBtns.forEach(function(b) {
          var active = b.getAttribute('data-lang') === currentLang;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        if (recognition) recognition.lang = getSpeechLang();
        
        var langNames = { en: 'English', hi: 'हिंदी', mr: 'मराठी' };
        setStatus('Language: ' + langNames[currentLang]);

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
    window.speechSynthesis.onvoiceschanged = function() {
      window.speechSynthesis.getVoices();
    };
  }
  
  initSpeechRecognition();
  startConversation();
})();
