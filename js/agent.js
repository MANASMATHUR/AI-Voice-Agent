/**
 * Riverwood AI Voice Agent – Text chat + push-to-talk voice input.
 * Language toggles only bind to .lang-pick-btn (not mode tabs).
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
  var isRecording = false;
  var openaiReady = true;

  localStorage.setItem(SESSION_KEY, sessionId);

  var el = {
    conversation: document.getElementById('conversation'),
    userInput: document.getElementById('user-input'),
    voiceBtn: document.getElementById('voice-btn'),
    sendBtn: document.getElementById('send-btn'),
    status: document.getElementById('status'),
    langBtns: document.querySelectorAll('.lang-pick-btn'),
    apiBanner: document.getElementById('api-config-banner'),
  };

  if (!el.conversation || !el.userInput || !el.sendBtn || !el.status) return;

  function generateSessionId() {
    return 'ses_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function setStatus(text, isError) {
    el.status.textContent = text || '';
    el.status.classList.toggle('error', Boolean(isError));
  }

  function showApiBanner(message, isError) {
    if (!el.apiBanner) return;
    el.apiBanner.style.display = 'block';
    el.apiBanner.textContent = message || '';
    el.apiBanner.classList.toggle('error', Boolean(isError));
  }

  function hideApiBanner() {
    if (!el.apiBanner) return;
    el.apiBanner.style.display = 'none';
    el.apiBanner.textContent = '';
  }

  function setChatDisabled(disabled) {
    el.sendBtn.disabled = disabled;
    el.userInput.disabled = disabled;
    if (el.voiceBtn) el.voiceBtn.disabled = disabled;
  }

  function parseJsonResponse(response) {
    var ct = response.headers.get('content-type') || '';
    if (ct.indexOf('application/json') === -1) {
      return response.text().then(function (text) {
        throw new Error(
          response.status === 404
            ? 'API not found. Run with: npx vercel dev (or deploy to Vercel).'
            : 'Server returned non-JSON. Check deployment.'
        );
      });
    }
    return response.json().then(function (data) {
      if (!response.ok) {
        var msg = data.error || response.statusText || 'Request failed';
        if (data.hint) msg += ' — ' + data.hint;
        if (data.code === 'OPENAI_NOT_CONFIGURED') {
          openaiReady = false;
          showApiBanner(
            'OpenAI API key missing. Add OPENAI_API_KEY in Vercel (or .env) and redeploy. Keys start with sk- or sk-proj-.',
            true
          );
          setChatDisabled(true);
        }
        if (
          data.code === 'ELEVENLABS_NOT_CONFIGURED' ||
          data.code === 'ELEVENLABS_API_ERROR' ||
          data.code === 'ELEVENLABS_REQUEST_FAILED'
        ) {
          openaiReady = false;
          showApiBanner(
            'ElevenLabs is required for spoken replies. Add ELEVENLABS_API_KEY (see .env.example). For local dev only, set ELEVENLABS_OPTIONAL=true.',
            true
          );
          setChatDisabled(true);
        }
        throw new Error(msg);
      }
      return data;
    });
  }

  function bootstrap() {
    fetch(API_BASE + '/api/health', { method: 'GET' })
      .then(parseJsonResponse)
      .then(function (health) {
        if (!health.text_chat_ready) {
          openaiReady = false;
          var missing = [];
          if (!health.openai_configured) missing.push('OPENAI_API_KEY');
          if (health.elevenlabs_required && !health.elevenlabs_configured) {
            missing.push('ELEVENLABS_API_KEY');
          }
          showApiBanner(
            'Required for Text Chat: ' + missing.join(', ') + '. Premium voice uses ElevenLabs (mandatory). For local dev without ElevenLabs, set ELEVENLABS_OPTIONAL=true.',
            true
          );
          setChatDisabled(true);
          setStatus('Configure environment variables (see .env.example).', true);
        } else {
          hideApiBanner();
          openaiReady = true;
          setChatDisabled(false);
          startConversation();
        }
      })
      .catch(function () {
        showApiBanner(
          'Could not reach /api/health. Run "npx vercel dev" or open your deployed Vercel URL (not file://).',
          true
        );
        openaiReady = true;
        setStatus('Trying to connect…');
        startConversation();
      });
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
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (audioBase64) {
      try {
        var audio = new Audio('data:audio/mpeg;base64,' + audioBase64);
        audio.playbackRate = 1.0;
        currentAudio = audio;
        audio.play().catch(function () {
          speakWithBrowserTTS(text);
        });
        return;
      } catch (e) {
        // fall through
      }
    }

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

    for (var i = 0; i < langPrefs.length; i++) {
      var pref = langPrefs[i];
      for (var j = 0; j < voices.length; j++) {
        if (voices[j].name.indexOf(pref) !== -1 || voices[j].lang.indexOf(pref) === 0) {
          return voices[j];
        }
      }
    }

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
    if (openaiReady === false) return;

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
      .then(function (res) {
        return parseJsonResponse(res);
      })
      .then(function (data) {
        if (data.sessionId) {
          sessionId = data.sessionId;
          localStorage.setItem(SESSION_KEY, sessionId);
        }

        appendMessage('assistant', data.reply);
        setStatus(data.ttsProvider ? 'Ready (' + data.ttsProvider + ' voice)' : 'Ready. Type or tap Voice to speak.');
        speakText(data.reply, data.audioBase64);
      })
      .catch(function (err) {
        console.error('Start conversation error:', err);
        appendMessage('assistant', 'I can’t reach the AI service right now. Check your API key and that you’re on Vercel (or run vercel dev).');
        setStatus(err.message || 'Connection error', true);
      });
  }

  function getAbortSignal() {
    if (typeof AbortController === 'undefined') return undefined;
    abortController = new AbortController();
    return abortController.signal;
  }

  function sendMessageStreaming(text) {
    if (isProcessing || openaiReady === false) return;

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

    var signal = getAbortSignal();

    fetch(API_BASE + '/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        message: message,
        language: currentLang,
        stream: true,
      }),
      signal: signal,
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(function (data) {
            var msg = (data && data.error) ? data.error : response.statusText;
            if (data && data.hint) msg += ' — ' + data.hint;
            if (data && data.code === 'OPENAI_NOT_CONFIGURED') {
              openaiReady = false;
              showApiBanner(
                'OpenAI API key missing. Add OPENAI_API_KEY in Vercel or .env and redeploy.',
                true
              );
              setChatDisabled(true);
            }
            if (
              data &&
              (data.code === 'ELEVENLABS_NOT_CONFIGURED' ||
                data.code === 'ELEVENLABS_API_ERROR' ||
                data.code === 'ELEVENLABS_REQUEST_FAILED')
            ) {
              openaiReady = false;
              showApiBanner(
                'ElevenLabs is required for spoken replies. Add ELEVENLABS_API_KEY or set ELEVENLABS_OPTIONAL=true for local dev.',
                true
              );
              setChatDisabled(true);
            }
            throw new Error(msg || 'Request failed');
          });
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();

        function readChunk() {
          return reader.read().then(function (result) {
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
                  if (data.ttsError) {
                    setStatus('Reply ready; ElevenLabs error: ' + (data.ttsHint || data.ttsError), true);
                  }
                }
                } catch (e) {
                  // incomplete SSE chunk
                }
              }
            }

            return readChunk();
          });
        }

        return readChunk();
      })
      .then(function () {
        updateMessageContent(loadingRow, fullReply);
        setStatus(ttsProvider ? 'Ready (' + ttsProvider + ' voice)' : 'Ready.');
        speakText(fullReply, audioBase64);
      })
      .catch(function (err) {
        if (err.name === 'AbortError') {
          updateMessageContent(loadingRow, 'Cancelled.');
          setStatus('Cancelled.');
        } else {
          console.error('Send message error:', err);
          updateMessageContent(loadingRow, 'Sorry, I couldn’t respond. Please try again.');
          setStatus(err.message || 'Connection error', true);
        }
      })
      .then(function () {
        setProcessing(false);
        abortController = null;
      });
  }

  function setProcessing(processing) {
    isProcessing = processing;
    var block = processing || openaiReady === false;
    el.sendBtn.disabled = block;
    el.userInput.disabled = block;
    if (el.voiceBtn) el.voiceBtn.disabled = block || isRecording;
  }

  function stopRecording() {
    isRecording = false;
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }
    if (el.voiceBtn) {
      el.voiceBtn.classList.remove('recording');
      el.voiceBtn.setAttribute('aria-pressed', 'false');
    }
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

    recognition.onresult = function (event) {
      var result = event.results[event.results.length - 1];
      if (result.isFinal) {
        var transcript = (result[0] && result[0].transcript) ? result[0].transcript.trim() : '';
        stopRecording();
        if (transcript) sendMessageStreaming(transcript);
      } else if (result[0]) {
        el.userInput.value = result[0].transcript;
      }
    };

    recognition.onerror = function (ev) {
      stopRecording();
      var code = ev && ev.error ? ev.error : '';
      if (code === 'not-allowed') {
        setStatus('Microphone blocked. Allow mic in browser settings.', true);
      } else if (code !== 'aborted' && code !== 'no-speech') {
        setStatus('Voice error: ' + code + '. Try typing instead.', true);
      } else {
        setStatus('Tap Voice again to speak.');
      }
    };

    recognition.onend = function () {
      isRecording = false;
      if (el.voiceBtn) {
        el.voiceBtn.classList.remove('recording');
        el.voiceBtn.setAttribute('aria-pressed', 'false');
      }
    };

    el.voiceBtn.addEventListener('click', function () {
      if (!recognition || isProcessing || openaiReady === false) return;

      if (isRecording) {
        stopRecording();
        setStatus('Processing…');
        return;
      }

      try {
        recognition.lang = getSpeechLang();
        isRecording = true;
        el.voiceBtn.classList.add('recording');
        el.voiceBtn.setAttribute('aria-pressed', 'true');
        setStatus('Listening… tap Voice again when finished.');
        recognition.start();
      } catch (e) {
        isRecording = false;
        setStatus('Voice not available in this browser.', true);
      }
    });
  }

  el.sendBtn.addEventListener('click', function () {
    sendMessageStreaming();
  });

  el.userInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageStreaming();
    }
  });

  if (el.langBtns && el.langBtns.length) {
    el.langBtns.forEach(function (btn) {
      var lang = btn.getAttribute('data-lang');
      var isActive = lang === currentLang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    el.langBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-lang');
        if (!lang || lang === currentLang) return;

        currentLang = lang;
        localStorage.setItem(LANG_KEY, currentLang);

        el.langBtns.forEach(function (b) {
          var active = b.getAttribute('data-lang') === currentLang;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        if (recognition) recognition.lang = getSpeechLang();

        var langNames = { en: 'English', hi: 'हिंदी', mr: 'मराठी' };
        setStatus('Language: ' + langNames[currentLang]);

        sessionId = generateSessionId();
        localStorage.setItem(SESSION_KEY, sessionId);
        el.conversation.innerHTML = '';
        if (openaiReady !== false) startConversation();
      });
    });
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function () {
      window.speechSynthesis.getVoices();
    };
  }

  initSpeechRecognition();
  bootstrap();
})();

