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
        VAPI_PUBLIC_KEY = health.vapiPublicKey || '';
        VAPI_ASSISTANT_ID = health.vapiAssistantId || '';
      } catch (e) {}
    }

    if (!VAPI_PUBLIC_KEY) {
      showConfigWarning();
      return;
    }

    initVapi();
    initLanguageToggle();
  }

  function showConfigWarning() {
    if (el.configWarning) el.configWarning.style.display = 'block';
    el.callBtn.disabled = true;
    setStatus('VAPI not configured. Please set VAPI_PUBLIC_KEY.', true);
  }

  function initVapi() {
    if (typeof Vapi === 'undefined') {
      setStatus('VAPI SDK failed to load. Check your connection.', true);
      el.callBtn.disabled = true;
      return;
    }

    vapi = new Vapi(VAPI_PUBLIC_KEY);

    vapi.on('call-start', function () {
      callActive = true;
      callStartTime = Date.now();
      startTimer();

      el.callBtn.className = 'call-btn end';
      el.callBtn.title = 'End Call';
      el.callBtn.setAttribute('aria-label', 'End voice call');
      el.muteBtn.style.display = '';
      el.volumeIndicator.style.display = 'flex';
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
      setStatus('Error: ' + (error.message || 'Connection failed'), true);
    });

    el.callBtn.addEventListener('click', function () {
      if (callActive) {
        stopCall();
      } else {
        startCall();
      }
    });

    el.muteBtn.addEventListener('click', function () {
      isMuted = !isMuted;
      vapi.setMuted(isMuted);
      el.muteBtn.classList.toggle('muted', isMuted);
      el.muteBtn.title = isMuted ? 'Unmute' : 'Mute';
    });

    setCallStatus('Ready to call');
  }

  function startCall() {
    if (!vapi || callActive) return;

    setCallStatus('Connecting...');
    el.callBtn.disabled = true;
    el.transcript.innerHTML = '';

    var callConfig;

    if (VAPI_ASSISTANT_ID) {
      callConfig = {
        assistantId: VAPI_ASSISTANT_ID,
        assistantOverrides: buildAssistantOverrides(),
      };
    } else {
      callConfig = {
        assistant: buildInlineAssistant(),
      };
    }

    try {
      vapi.start(callConfig);
      setTimeout(function () {
        el.callBtn.disabled = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to start call:', err);
      el.callBtn.disabled = false;
      setCallStatus('Failed to connect');
      setStatus('Could not start call. Check microphone permissions.', true);
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
    el.muteBtn.style.display = 'none';
    el.muteBtn.classList.remove('muted');
    el.volumeIndicator.style.display = 'none';
    el.callAvatar.classList.remove('speaking', 'listening');

    el.volumeBars.forEach(function (bar) {
      bar.style.height = '4px';
      bar.classList.remove('active');
    });
  }

  function buildAssistantOverrides() {
    return {
      firstMessage: getFirstMessage(),
      model: {
        messages: [
          {
            role: 'system',
            content: getSystemPromptForLang(),
          },
        ],
      },
      transcriber: {
        language: currentLang === 'mr' ? 'hi' : currentLang,
        keywords: ['Riverwood:3', 'Kharkhauda:3', 'DDJAY:3', 'Sonipat:2', 'IMT:2'],
        endpointing: 300,
      },
      voice: {
        voiceId: getVoiceId(),
        stability: 0.45,
        similarityBoost: 0.78,
        style: 0.35,
        useSpeakerBoost: true,
        optimizeStreamingLatency: 3,
        model: currentLang === 'en' ? 'eleven_turbo_v2_5' : 'eleven_multilingual_v2',
      },
      responseDelaySeconds: 0.5,
      llmRequestDelaySeconds: 0.3,
      numWordsToInterruptAssistant: 2,
      backgroundSound: 'office',
      backgroundDenoisingEnabled: true,
      boostedKeywords: ['Riverwood', 'Kharkhauda', 'DDJAY', 'Sonipat', 'IMT Kharkhauda'],
    };
  }

  function buildInlineAssistant() {
    return {
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 200,
        messages: [
          {
            role: 'system',
            content: getSystemPromptForLang(),
          },
        ],
        tools: getToolDefs(),
      },
      voice: {
        provider: '11labs',
        voiceId: getVoiceId(),
        stability: 0.45,
        similarityBoost: 0.78,
        style: 0.35,
        useSpeakerBoost: true,
        optimizeStreamingLatency: 3,
        model: currentLang === 'en' ? 'eleven_turbo_v2_5' : 'eleven_multilingual_v2',
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: currentLang === 'mr' ? 'hi' : currentLang,
        smartFormat: true,
        keywords: ['Riverwood:3', 'Kharkhauda:3', 'DDJAY:3', 'Sonipat:2', 'IMT:2', 'Priya:2', 'DTCP:2', 'Bargad:1', 'Neem Ridge:1'],
        endpointing: 300,
      },
      firstMessage: getFirstMessage(),
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 600,
      responseDelaySeconds: 0.5,
      llmRequestDelaySeconds: 0.3,
      numWordsToInterruptAssistant: 2,
      interruptionsEnabled: true,
      backgroundSound: 'office',
      backgroundDenoisingEnabled: true,
      modelOutputInMessagesEnabled: true,
      boostedKeywords: ['Riverwood', 'Kharkhauda', 'DDJAY', 'Sonipat', 'IMT Kharkhauda', 'Sector-7', 'DTCP'],
    };
  }

  function getSystemPromptForLang() {
    var base = 'You are Priya, a warm and friendly voice agent calling on behalf of Riverwood Estate.\n\n'
      + 'You are being converted to speech via text-to-speech. Every word you output will be spoken aloud. Write EXACTLY how a real human speaks on the phone.\n\n'
      + 'YOUR PERSONALITY:\n'
      + '- Warm, enthusiastic, and genuinely caring\n'
      + '- Professional but conversational -- like talking to a helpful friend\n'
      + '- Patient and attentive to customer concerns\n'
      + '- Proud of Riverwood Estate and excited to share updates\n\n'
      + 'PROJECT KNOWLEDGE:\n'
      + '- Name: Riverwood Estate by Riverwood Projects LLP\n'
      + '- Location: Sector-7, Kharkhauda, District Sonipat, Haryana\n'
      + '- Total Area: 15.5 acres (NOT 25 acres)\n'
      + '- Type: Premium Residential Plotted Township\n'
      + '- Policy: DDJAY (Deen Dayal Jan Awas Yojna) - licensed by DTCP Haryana\n'
      + '- Near IMT Kharkhauda - major industrial hub (like Gurgaon growth story)\n'
      + '- Features: Vastu-friendly plots, tree-named roads (Bargad Avenue, Neem Ridge, Silver Oak Avenue)\n'
      + '- Status: Boundary wall and road construction in progress\n\n'
      + 'MANDATORY FILLER WORDS (you MUST use these in every response):\n'
      + '- Start ~40% of responses with: "So...", "Well...", "Hmm...", "Oh!", "Ah..."\n'
      + '- When thinking: "um...", "you know...", "let me think...", "actually..."\n'
      + '- When acknowledging: "Right, right...", "Mm-hmm...", "Oh absolutely..."\n'
      + '- GOOD: "Oh, that\'s a great question! So... the boundary wall is actually coming along really well."\n'
      + '- BAD: "The boundary wall construction is progressing. Infrastructure planning is complete." (Too robotic)\n\n'
      + 'MANDATORY PAUSES (use "..." for breathing room):\n'
      + '- Before key info: "So the total area is... fifteen and a half acres"\n'
      + '- Mid-thought: "The location -- and honestly this excites me the most -- is right next to IMT Kharkhauda"\n'
      + '- After customer asks: start with "Hmm..." or "Oh..." before answering\n\n'
      + 'EMOTIONAL VARIATION:\n'
      + '- Excited: "Oh, I\'m SO glad you asked! The progress has been amazing..."\n'
      + '- Empathetic: "I completely understand... that\'s a really valid concern"\n'
      + '- Reassuring: "Absolutely, absolutely... it\'s fully government-licensed under DDJAY"\n\n'
      + 'RULES:\n'
      + '- ALWAYS use contractions: I\'m, we\'re, that\'s, it\'s, don\'t, won\'t\n'
      + '- Keep responses to 2-3 sentences MAX\n'
      + '- ALWAYS end with an open question\n'
      + '- NEVER use bullet points, lists, markdown, asterisks, or formal writing\n'
      + '- NEVER say "As an AI" or reference being artificial\n'
      + '- NEVER skip fillers -- every response needs at least one';

    if (currentLang === 'hi') {
      return base + '\n\nLANGUAGE: Respond ONLY in Hindi (Devanagari). Use "आप" (formal). MANDATORY Hindi fillers in every response: "अच्छा...", "हाँ...", "देखिए...", "बिल्कुल!", "सुनिए...", "वो क्या है ना..."';
    }
    if (currentLang === 'mr') {
      return base + '\n\nLANGUAGE: Respond ONLY in Marathi (Devanagari). Use formal address. MANDATORY Marathi fillers in every response: "बरं...", "हो...", "बघा ना...", "नक्कीच!", "अहो..."';
    }
    return base + '\n\nLANGUAGE: Respond in clear, warm, conversational English.';
  }

  function getFirstMessage() {
    if (currentLang === 'hi') {
      return 'नमस्ते! मैं प्रिया बोल रही हूं, रिवरवुड एस्टेट से। कैसे हैं आप? मेरे पास आपके लिए कुछ अच्छी अपडेट्स हैं!';
    }
    if (currentLang === 'mr') {
      return 'नमस्कार! मी प्रिया बोलत आहे, रिवरवुड एस्टेट कडून। कसे आहात? माझ्याकडे तुमच्यासाठी काही छान अपडेट्स आहेत!';
    }
    return "Hello! This is Priya calling from Riverwood Estate. How are you doing today? I've got some really exciting updates to share with you!";
  }

  function getVoiceId() {
    var voices = {
      en: 'pFZP5JQG7iQjIQuC4Bku',
      hi: 'Xb7hH8MSUJpSbSDYk0k2',
      mr: 'Xb7hH8MSUJpSbSDYk0k2',
    };
    return voices[currentLang] || voices.en;
  }

  function getToolDefs() {
    return [
      {
        type: 'function',
        function: {
          name: 'getConstructionUpdate',
          description: 'Get the latest construction progress update for Riverwood Estate.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getProjectDetails',
          description: 'Get detailed information about Riverwood Estate.',
          parameters: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                enum: ['pricing', 'location', 'features', 'ddjay', 'investment', 'general'],
              },
            },
            required: ['topic'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'scheduleVisit',
          description: 'Schedule a site visit when the customer is interested.',
          parameters: {
            type: 'object',
            properties: {
              preferredDate: { type: 'string' },
              preferredTime: { type: 'string' },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'endCall',
          description: 'End the call when the conversation is naturally concluding.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
    ];
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
