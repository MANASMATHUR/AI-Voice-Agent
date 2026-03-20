(function () {
  'use strict';

  var VAPI_PUBLIC_KEY = window.VAPI_PUBLIC_KEY || '';
  var VAPI_ASSISTANT_ID = window.VAPI_ASSISTANT_ID || '';
  var LANG_KEY = 'riverwood_lang';

  var currentLang = localStorage.getItem(LANG_KEY) || 'en';

  var vapi = null;
  var callActive = false;
  var isMuted = false;
  var timerInterval = null;
  var callStartTime = null;

  var el = {
    callBtn: document.getElementById('call-btn'),
    muteBtn: document.getElementById('mute-btn'),
    callAvatar: document.getElementById('call-avatar'),
    callStatus: document.getElementById('call-status'),
    callTimer: document.getElementById('call-timer'),
    transcript: document.getElementById('transcript'),
    volumeIndicator: document.getElementById('volume-indicator'),
    volumeBars: document.querySelectorAll('.volume-bar'),
    langBtns: document.querySelectorAll('.lang-btn'),
    configWarning: document.getElementById('config-warning'),
    footerStatus: document.getElementById('footer-status'),
  };

  if (!el.callBtn) return;

  init();

  async function init() {
    if (!VAPI_PUBLIC_KEY) {
      try {
        var resp = await fetch('/api/health');
        var health = await resp.json();
        VAPI_PUBLIC_KEY = String(health.vapiPublicKey || '').trim();
        VAPI_ASSISTANT_ID = String(health.vapiAssistantId || '').trim();
      } catch (e) {}
    } else {
      try {
        await fetch('/api/health');
      } catch (e) {}
    }

    initLanguageToggle();

    if (!VAPI_PUBLIC_KEY) {
      showConfigWarning(true);
      el.callBtn.disabled = true;
      setStatus(
        'Required: set VAPI_PUBLIC_KEY (and VAPI_ASSISTANT_ID) in Vercel env. In VAPI dashboard, use ElevenLabs for voice and OpenAI for the model.',
        true
      );
      return;
    }

    showConfigWarning(false);
    initVapi();
  }

  function showConfigWarning(isError) {
    if (!el.configWarning) return;
    if (isError) {
      el.configWarning.style.display = 'block';
      el.configWarning.classList.add('config-note--error');
    } else {
      el.configWarning.style.display = 'none';
      el.configWarning.classList.remove('config-note--error');
    }
  }

  function getVapiConstructor() {
    var g = typeof Vapi !== 'undefined' ? Vapi : null;
    if (typeof g === 'function') return g;
    if (g && typeof g.default === 'function') return g.default;
    return null;
  }

  function initVapi() {
    var VapiCtor = getVapiConstructor();
    if (!VapiCtor) {
      setStatus('VAPI SDK failed to load. Check your connection.', true);
      el.callBtn.disabled = true;
      return;
    }

    vapi = new VapiCtor(VAPI_PUBLIC_KEY);

    vapi.on('call-start', function () {
      callActive = true;
      callStartTime = Date.now();
      startTimer();

      el.callBtn.className = 'call-btn end';
      el.callBtn.title = 'End Call';
      el.callBtn.setAttribute('aria-label', 'End voice call');
      if (el.muteBtn) el.muteBtn.style.display = '';
      if (el.volumeIndicator) el.volumeIndicator.style.display = 'flex';
      el.callAvatar.classList.remove('speaking', 'listening');

      setCallStatus('Connected', true);
      setStatus('Call active. Speak naturally.');
    });

    vapi.on('call-end', function () {
      endCallUI();
      setCallStatus('Call ended');
      setStatus('Call ended.');
    });

    vapi.on('speech-start', function () {
      el.callAvatar.classList.add('speaking');
      el.callAvatar.classList.remove('listening');
      setCallStatus('Priya is speaking...', true);
    });

    vapi.on('speech-end', function () {
      el.callAvatar.classList.remove('speaking');
      setCallStatus('Listening...', true);
    });

    vapi.on('message', function (message) {
      handleVapiMessage(message);
    });

    vapi.on('volume-level', function (level) {
      updateVolumeIndicator(level);
    });

    vapi.on('error', function (error) {
      console.error('VAPI error:', error);
      endCallUI();
      setCallStatus('Call error');
      setStatus('Error: ' + formatVapiError(error), true);
    });

    el.callBtn.addEventListener('click', function () {
      if (callActive) {
        stopCall();
      } else {
        startCall();
      }
    });

    if (el.muteBtn) {
      el.muteBtn.addEventListener('click', function () {
        isMuted = !isMuted;
        vapi.setMuted(isMuted);
        el.muteBtn.classList.toggle('muted', isMuted);
        el.muteBtn.title = isMuted ? 'Unmute' : 'Mute';
      });
    }

    setCallStatus('Ready to call');
  }

  /**
   * VAPI / axios often nest errors: message may be an object, not a string.
   * 400 on POST /call/web usually means assistantOverrides or inline assistant
   * contains fields VAPI’s API rejects — see buildAssistantOverrides (kept minimal).
   */
  function formatVapiError(error) {
    function dig(obj, depth) {
      if (!obj || depth > 8) return null;
      if (typeof obj === 'string' && obj.length) return obj;
      if (typeof obj === 'number') return String(obj);
      if (Array.isArray(obj)) {
        var parts = [];
        for (var i = 0; i < obj.length; i++) {
          var p = dig(obj[i], depth + 1);
          if (p) parts.push(p);
        }
        return parts.length ? parts.join('; ') : null;
      }
      if (typeof obj !== 'object') return null;

      if (typeof obj.message === 'string' && obj.message) return obj.message;
      if (obj.message && typeof obj.message === 'object') {
        var m = dig(obj.message, depth + 1);
        if (m) return m;
      }
      if (typeof obj.errorMsg === 'string' && obj.errorMsg) return obj.errorMsg;
      if (obj.error && typeof obj.error === 'string') return obj.error;
      if (obj.error && typeof obj.error === 'object') {
        var e = dig(obj.error, depth + 1);
        if (e) return e;
      }
      if (obj.response && obj.response.data) {
        var d = dig(obj.response.data, depth + 1);
        if (d) return d;
      }
      if (obj.data) {
        var d2 = dig(obj.data, depth + 1);
        if (d2) return d2;
      }
      if (Array.isArray(obj.errors)) {
        var ed = dig(obj.errors, depth + 1);
        if (ed) return ed;
      }
      return null;
    }

    if (!error) return 'Connection failed';
    if (typeof error === 'string') return error;

    var top = dig(error, 0);
    if (top) return top.length > 500 ? top.slice(0, 500) + '…' : top;

    try {
      return JSON.stringify(error).slice(0, 400);
    } catch (e2) {
      return 'Connection failed (see browser console for details).';
    }
  }

  function startCall() {
    if (!vapi || callActive) return;

    setCallStatus('Connecting...');
    el.callBtn.disabled = true;
    el.transcript.innerHTML = '';

    var callConfig;

    function onStartFail(err) {
      console.error('Failed to start call:', err);
      el.callBtn.disabled = false;
      setCallStatus('Failed to connect');
      setStatus(
        'Could not start call: ' +
          formatVapiError(err) +
          '. Confirm VAPI assistant uses OpenAI + ElevenLabs, and VAPI_ASSISTANT_ID matches your dashboard.',
        true
      );
    }

    function startWithConfig(config, allowModelRetry) {
      try {
        var started = vapi.start(config);
        if (started && typeof started.then === 'function') {
          started.catch(function (err) {
            var msg = formatVapiError(err) || '';
            var looksLike400 =
              msg.indexOf('400') !== -1 ||
              msg.toLowerCase().indexOf('bad request') !== -1 ||
              (err && err.status === 400);
            if (
              allowModelRetry &&
              looksLike400 &&
              config.assistantOverrides &&
              config.assistantOverrides.model &&
              VAPI_ASSISTANT_ID
            ) {
              console.warn('Riverwood: VAPI returned 400 — retrying with firstMessage-only overrides (dashboard prompt will apply).');
              startWithConfig(
                {
                  assistantId: String(VAPI_ASSISTANT_ID).trim(),
                  assistantOverrides: { firstMessage: getFirstMessage() },
                },
                false
              );
              return;
            }
            onStartFail(err);
          });
        }
        setTimeout(function () {
          el.callBtn.disabled = false;
        }, 2000);
      } catch (err) {
        onStartFail(err);
      }
    }

    if (VAPI_ASSISTANT_ID) {
      startWithConfig(
        {
          assistantId: String(VAPI_ASSISTANT_ID).trim(),
          assistantOverrides: buildAssistantOverrides(),
        },
        true
      );
    } else {
      startWithConfig({ assistant: buildInlineAssistant() }, false);
    }
  }

  function stopCall() {
    if (!vapi || !callActive) return;
    vapi.stop();
  }

  function endCallUI() {
    callActive = false;
    isMuted = false;
    stopTimer();

    el.callBtn.className = 'call-btn start';
    el.callBtn.title = 'Start Call';
    el.callBtn.setAttribute('aria-label', 'Start voice call');
    el.callBtn.disabled = false;
    if (el.muteBtn) {
      el.muteBtn.style.display = 'none';
      el.muteBtn.classList.remove('muted');
    }
    if (el.volumeIndicator) el.volumeIndicator.style.display = 'none';
    el.callAvatar.classList.remove('speaking', 'listening');

    el.volumeBars.forEach(function (bar) {
      bar.style.height = '4px';
      bar.classList.remove('active');
    });
  }

  /**
   * Merged into your dashboard assistant (e.g. Riverwood Assistant).
   * Keep in sync with VAPI → Model tab: OpenAI + GPT 4o Mini, temperature & max tokens
   * should match what the dashboard shows so validation doesn’t fight the saved assistant.
   */
  var VAPI_MODEL_SETTINGS = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.5,
    maxTokens: 250,
  };

  function buildAssistantOverrides() {
    return {
      firstMessage: getFirstMessage(),
      model: Object.assign({}, VAPI_MODEL_SETTINGS, {
        messages: [
          {
            role: 'system',
            content: getSystemPromptForLang(),
          },
        ],
      }),
    };
  }

  function buildInlineAssistant() {
    return {
      model: Object.assign({}, VAPI_MODEL_SETTINGS, {
        messages: [
          {
            role: 'system',
            content: getSystemPromptForLang(),
          },
        ],
      }),
      voice: {
        provider: '11labs',
        voiceId: getVoiceId(),
        stability: 0.48,
        similarityBoost: 0.8,
        style: 0.42,
        useSpeakerBoost: true,
        optimizeStreamingLatency: 2,
        model: currentLang === 'en' ? 'eleven_turbo_v2_5' : 'eleven_multilingual_v2',
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: currentLang === 'mr' ? 'hi' : currentLang,
        smartFormat: true,
        keywords: ['Riverwood:3', 'Kharkhauda:3', 'DDJAY:3', 'Sonipat:2', 'IMT:2', 'Priya:2', 'DTCP:2'],
        endpointing: 380,
      },
      firstMessage: getFirstMessage(),
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 600,
      responseDelaySeconds: 0.65,
      llmRequestDelaySeconds: 0.45,
      numWordsToInterruptAssistant: 2,
      interruptionsEnabled: true,
    };
  }

  function getSystemPromptForLang() {
    var base = 'You are Priya, a warm voice agent for Riverwood Estate. PRIMARY GOAL: sound like a real human on a phone call (~70% of evaluation: voice realism).\n\n'
      + 'Every word is spoken aloud via TTS. Write SPOKEN English -- not brochure text.\n\n'
      + 'THINKING TIME: Often pause before the answer: "Hmm, let me put it this way...", "Oh, good question... give me a second...", "Right, so... what I\'d say is...". Use "I mean...", "honestly...", "look..."\n\n'
      + 'FILLERS (required almost every turn): So..., Well..., Okay..., Yeah..., Um..., You know..., Actually..., Right right..., Mm-hmm..., Totally...\n\n'
      + 'PAUSES: Use "..." and commas before facts: "It\'s... fifteen and a half acres, licensed under DDJAY." Mid-thought: "Kharkhauda -- and this is the exciting bit -- is next to the IMT hub."\n\n'
      + 'FLOW: React to their tone in one short phrase first. Use their words back. End with ONE gentle open question. 2-3 short sentences max.\n\n'
      + 'GOOD: "Ohh, I love that question. So... um... we\'re most of the way through the boundary work, and roads are next. Does that help -- or want me to set up a visit?"\n'
      + 'BAD: "Boundary wall 80% complete. Roads planned. Schedule visit?" (robotic)\n\n'
      + 'NEVER: bullet points, lists, markdown, ALL CAPS, same opener every time, zero fillers.\n\n'
      + 'FACTS: Riverwood Estate, Riverwood Projects LLP. Sector-7, Kharkhauda, Sonipat, Haryana. 15.5 acres (not 25). DDJAY, DTCP licensed. IMT Kharkhauda nearby. Vastu plots, tree-named roads. Construction in progress.\n';

    if (currentLang === 'hi') {
      return base + '\nLANGUAGE: Hindi Devanagari only, आप. Thinking: "एक मिनट...", fillers: अच्छा..., हाँ..., देखिए..., वो क्या है ना..., pauses "..."';
    }
    if (currentLang === 'mr') {
      return base + '\nLANGUAGE: Marathi Devanagari, formal. Fillers: बरं..., हो ना..., बघा ना..., अहो..., pauses "..."';
    }
    return base + '\nLANGUAGE: Warm conversational English.';
  }

  function getFirstMessage() {
    if (currentLang === 'hi') {
      return 'अच्छा, नमस्ते! मैं प्रिया बोल रही हूं... रिवरवुड एस्टेट से। आप कैसे हैं? मेरे पास आपके लिए कुछ अपडेट्स हैं -- सुनिएगा ज़रा...';
    }
    if (currentLang === 'mr') {
      return 'नमस्कार! मी प्रिया बोलत आहे, रिवरवुड एस्टेट कडून... कसे आहात? माझ्याकडे काही छान गोष्टी सांगायला आहेत, बघा ना...';
    }
    return "Oh, hi! Um... this is Priya -- I'm calling from Riverwood Estate. How are you doing today? I've got a couple of updates I think you'll want to hear...";
  }

  function getVoiceId() {
    var voices = {
      en: 'pFZP5JQG7iQjIQuC4Bku',
      hi: 'Xb7hH8MSUJpSbSDYk0k2',
      mr: 'Xb7hH8MSUJpSbSDYk0k2',
    };
    return voices[currentLang] || voices.en;
  }

  function handleVapiMessage(message) {
    if (!message) return;

    switch (message.type) {
      case 'transcript':
        handleTranscript(message);
        break;
      case 'function-call':
        break;
      case 'speech-update':
        handleSpeechUpdate(message);
        break;
      case 'status-update':
        if (message.status === 'ended') {
          endCallUI();
        }
        break;
    }
  }

  function handleTranscript(message) {
    var role = message.role;
    var text = message.transcript || '';
    var isFinal = message.transcriptType === 'final';

    if (!text) return;

    var existingPartial = el.transcript.querySelector('.transcript-line.' + role + '.partial-line');

    if (!isFinal && existingPartial) {
      var textEl = existingPartial.querySelector('.text');
      if (textEl) {
        textEl.textContent = text;
      }
    } else if (isFinal) {
      if (existingPartial) {
        existingPartial.remove();
      }
      addTranscriptLine(role, text, false);
    } else {
      if (existingPartial) existingPartial.remove();
      addTranscriptLine(role, text, true);
    }
  }

  function addTranscriptLine(role, text, isPartial) {
    var line = document.createElement('div');
    line.className = 'transcript-line ' + role + (isPartial ? ' partial-line' : '');

    var roleLabel = role === 'assistant' ? 'Priya' : 'You';
    line.innerHTML =
      '<div class="role">' + escapeHtml(roleLabel) + '</div>' +
      '<div class="text' + (isPartial ? ' partial' : '') + '">' + escapeHtml(text) + '</div>';

    el.transcript.appendChild(line);
    el.transcript.scrollTop = el.transcript.scrollHeight;
  }

  function handleSpeechUpdate(message) {
    if (message.status === 'started' && message.role === 'assistant') {
      el.callAvatar.classList.add('speaking');
      el.callAvatar.classList.remove('listening');
    } else if (message.status === 'stopped' && message.role === 'assistant') {
      el.callAvatar.classList.remove('speaking');
      el.callAvatar.classList.add('listening');
      setCallStatus('Listening...', true);
    } else if (message.status === 'started' && message.role === 'user') {
      el.callAvatar.classList.add('listening');
      el.callAvatar.classList.remove('speaking');
      setCallStatus('You are speaking...', true);
    }
  }

  function updateVolumeIndicator(level) {
    var barCount = el.volumeBars.length;
    var activeCount = Math.round(level * barCount);

    el.volumeBars.forEach(function (bar, i) {
      var isActive = i < activeCount;
      var height = isActive ? Math.max(6, Math.round(level * 24 * (0.5 + i / barCount))) : 4;
      bar.style.height = height + 'px';
      bar.classList.toggle('active', isActive);
    });
  }

  function startTimer() {
    callStartTime = Date.now();
    el.callTimer.textContent = '0:00';

    timerInterval = setInterval(function () {
      var elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      var mins = Math.floor(elapsed / 60);
      var secs = elapsed % 60;
      el.callTimer.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function initLanguageToggle() {
    if (!el.langBtns || !el.langBtns.length) return;

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

        if (callActive) {
          setStatus('End the current call before switching language.');
          return;
        }

        currentLang = lang;
        localStorage.setItem(LANG_KEY, currentLang);

        el.langBtns.forEach(function (b) {
          var active = b.getAttribute('data-lang') === currentLang;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        var langNames = { en: 'English', hi: 'Hindi', mr: 'Marathi' };
        setStatus('Language: ' + langNames[currentLang]);
        el.transcript.innerHTML = '';
      });
    });
  }

  function setCallStatus(text, isActive) {
    if (!el.callStatus) return;
    el.callStatus.textContent = text || '';
    el.callStatus.classList.toggle('active', Boolean(isActive));
  }

  function setStatus(text, isError) {
    if (!el.footerStatus) return;
    el.footerStatus.textContent = text || '';
    el.footerStatus.classList.toggle('error', Boolean(isError));
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
