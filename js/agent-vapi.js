(function () {
  'use strict';

  var VAPI_PUBLIC_KEY = window.VAPI_PUBLIC_KEY || '';
  var VAPI_ASSISTANT_ID = window.VAPI_ASSISTANT_ID || '';
  var LANG_KEY = 'riverwood_lang';

  var currentLang = localStorage.getItem(LANG_KEY) || 'en';

  var UI_STRINGS = {
    en: {
      ready: 'Ready to call',
      connecting: 'Connecting…',
      connected: 'Connected',
      callActive: 'You’re live with Priya — speak naturally.',
      callEnded: 'Call ended',
      callEndedDot: 'Call ended. Thank you for your time.',
      callError: 'Something went wrong',
      listening: 'Listening…',
      speaking: 'Priya is speaking…',
      youSpeaking: 'You’re speaking…',
      failedConnect: 'Couldn’t connect',
      endCallFirst: 'End the call before changing language.',
      you: 'You',
      priya: 'Priya',
      transcriptTitle: 'Your conversation',
      transcriptPlaceholder: 'You’ll see your conversation here.',
      transcriptAriaPrefix: 'Conversation transcript',
      startCall: 'Start call',
      endCall: 'End call',
      mute: 'Mute',
      unmute: 'Unmute',
      languageSelected_en: 'Conversation language: English. Priya will reply in English.',
      languageSelected_hi: 'Conversation language: Hindi (हिन्दी). Priya will reply in Hindi.',
      languageSelected_mr: 'Conversation language: Marathi (मराठी). Priya will reply in Marathi.',
      sdkLoadError: 'We couldn’t load the calling experience. Check your connection and refresh the page.',
      setupRequiredShort: 'Voice calls aren’t set up on this deployment yet.',
      tryAgainHint: 'Please try again in a moment.',
      genericCallError: 'Something went wrong. Please try again.',
    },
    hi: {
      ready: 'कॉल के लिए तैयार',
      connecting: 'कनेक्ट हो रहा है…',
      connected: 'कनेक्ट हो गया',
      callActive: 'आप प्रिया से जुड़े हुए हैं — स्वाभाविक रूप से बोलें।',
      callEnded: 'कॉल समाप्त',
      callEndedDot: 'कॉल समाप्त। आपका धन्यवाद।',
      callError: 'कुछ गलत हो गया',
      listening: 'सुन रहे हैं…',
      speaking: 'प्रिया बोल रही हैं…',
      youSpeaking: 'आप बोल रहे हैं…',
      failedConnect: 'कनेक्ट नहीं हो सका',
      endCallFirst: 'भाषा बदलने से पहले कॉल समाप्त करें।',
      you: 'आप',
      priya: 'प्रिया',
      transcriptTitle: 'आपकी बातचीत',
      transcriptPlaceholder: 'यहाँ आपकी बातचीत दिखाई देगी।',
      transcriptAriaPrefix: 'बातचीत का ट्रांसक्रिप्ट',
      startCall: 'कॉल शुरू करें',
      endCall: 'कॉल खत्म करें',
      mute: 'म्यूट',
      unmute: 'अनम्यूट',
      languageSelected_en: 'बातचीत की भाषा: अंग्रेज़ी। प्रिया अंग्रेज़ी में जवाब देंगी।',
      languageSelected_hi: 'बातचीत की भाषा: हिन्दी। प्रिया हिन्दी में जवाब देंगी।',
      languageSelected_mr: 'बातचीत की भाषा: मराठी। प्रिया मराठी में जवाब देंगी।',
      sdkLoadError: 'कॉलिंग लोड नहीं हो सका। कनेक्शन जाँचें और पेज रिफ्रेश करें।',
      setupRequiredShort: 'इस साइट पर अभी वॉइस कॉल सेट नहीं है।',
      tryAgainHint: 'कृपया थोड़ी देर बाद फिर कोशिश करें।',
      genericCallError: 'कुछ गलत हो गया। कृपया फिर कोशिश करें।',
    },
    mr: {
      ready: 'कॉलसाठी तयार',
      connecting: 'कनेक्ट होत आहे…',
      connected: 'कनेक्ट झाले',
      callActive: 'तुम्ही प्रियाशी जोडलेले आहात — सहज बोला.',
      callEnded: 'कॉल संपला',
      callEndedDot: 'कॉल संपला. धन्यवाद.',
      callError: 'काहीतरी चूक झाली',
      listening: 'ऐकत आहे…',
      speaking: 'प्रिया बोलत आहे…',
      youSpeaking: 'तुम्ही बोलत आहात…',
      failedConnect: 'कनेक्ट होऊ शकले नाही',
      endCallFirst: 'भाषा बदलण्यापूर्वी कॉल संपवा.',
      you: 'तुम्ही',
      priya: 'प्रिया',
      transcriptTitle: 'तुमचा संवाद',
      transcriptPlaceholder: 'येथे तुमचा संवाद दिसेल.',
      transcriptAriaPrefix: 'संवादाचा ट्रान्सक्रिप्ट',
      startCall: 'कॉल सुरू करा',
      endCall: 'कॉल संपवा',
      mute: 'आवाज बंद',
      unmute: 'आवाज सुरू',
      languageSelected_en: 'संवादाची भाषा: इंग्रजी. प्रिया इंग्रजीत उत्तर देईल.',
      languageSelected_hi: 'संवादाची भाषा: हिंदी. प्रिया हिंदीत उत्तर देईल.',
      languageSelected_mr: 'संवादाची भाषा: मराठी. प्रिया मराठीत उत्तर देईल.',
      sdkLoadError: 'कॉल अनुभव लोड होऊ शकला नाही. कनेक्शन तपासा आणि पृष्ठ रिफ्रेश करा.',
      setupRequiredShort: 'या साइटवर अद्याप व्हॉइस कॉल सेट नाहीत.',
      tryAgainHint: 'कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.',
      genericCallError: 'काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.',
    },
  };

  function t(key) {
    return (UI_STRINGS[currentLang] || UI_STRINGS.en)[key] || UI_STRINGS.en[key] || key;
  }

  /** Conversation-language chip (not UI locale): what Priya will use for STT/TTS. */
  function getConversationLangBadge() {
    if (currentLang === 'hi') return 'हिन्दी · HI';
    if (currentLang === 'mr') return 'मराठी · MR';
    return 'English · EN';
  }

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
    transcriptPanelTitle: document.getElementById('transcript-panel-title'),
    transcriptLangDisplay: document.getElementById('transcript-lang-display'),
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

    updateTranscriptLanguageUI();
    initLanguageToggle();

    if (!VAPI_PUBLIC_KEY) {
      showConfigWarning(true);
      el.callBtn.disabled = true;
      setStatus(t('setupRequiredShort'), true);
      console.error(
        'Riverwood voice: set VAPI_PUBLIC_KEY and VAPI_ASSISTANT_ID in environment. Dashboard: ElevenLabs + OpenAI.'
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
      setStatus(t('sdkLoadError'), true);
      el.callBtn.disabled = true;
      return;
    }

    vapi = new VapiCtor(VAPI_PUBLIC_KEY);

    vapi.on('call-start', function () {
      callActive = true;
      callStartTime = Date.now();
      startTimer();

      el.callBtn.className = 'call-btn call-btn--primary end';
      el.callBtn.title = t('endCall');
      el.callBtn.setAttribute('aria-label', t('endCall'));
      updateCallButtonLabel(true);
      if (el.muteBtn) {
        el.muteBtn.style.display = '';
        var ml = el.muteBtn.querySelector('.call-btn__label');
        if (ml) ml.textContent = t('mute');
        el.muteBtn.setAttribute('aria-label', t('mute'));
        el.muteBtn.title = t('mute');
      }
      if (el.volumeIndicator) el.volumeIndicator.style.display = 'flex';
      el.callAvatar.classList.remove('speaking', 'listening');

      setCallStatus(t('connected'), true);
      setStatus(t('callActive'));
    });

    vapi.on('call-end', function () {
      endCallUI();
      setCallStatus(t('callEnded'));
      setStatus(t('callEndedDot'));
    });

    vapi.on('speech-start', function () {
      el.callAvatar.classList.add('speaking');
      el.callAvatar.classList.remove('listening');
      setCallStatus(t('speaking'), true);
    });

    vapi.on('speech-end', function () {
      el.callAvatar.classList.remove('speaking');
      setCallStatus(t('listening'), true);
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
      setCallStatus(t('callError'));
      setStatus(t('genericCallError') + ' ' + t('tryAgainHint'), true);
      console.error('VAPI error detail:', formatVapiError(error), error);
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
        el.muteBtn.title = isMuted ? t('unmute') : t('mute');
        el.muteBtn.setAttribute('aria-label', isMuted ? t('unmute') : t('mute'));
        var muteLbl = el.muteBtn.querySelector('.call-btn__label');
        if (muteLbl) muteLbl.textContent = isMuted ? t('unmute') : t('mute');
      });
    }

    setCallStatus(t('ready'));
    updateCallButtonLabel(false);
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

    if (!error) return t('genericCallError');
    if (typeof error === 'string') return error;

    var top = dig(error, 0);
    if (top) return top.length > 500 ? top.slice(0, 500) + '…' : top;

    try {
      return JSON.stringify(error).slice(0, 400);
    } catch (e2) {
      return t('genericCallError');
    }
  }

  function updateCallButtonLabel(isEnd) {
    var label = el.callBtn && el.callBtn.querySelector('.call-btn__label');
    if (label) label.textContent = isEnd ? t('endCall') : t('startCall');
  }

  function updateTranscriptLanguageUI() {
    if (el.transcriptPanelTitle) {
      el.transcriptPanelTitle.textContent = t('transcriptTitle');
    }
    if (el.transcriptLangDisplay) {
      el.transcriptLangDisplay.textContent = getConversationLangBadge();
    }
    if (el.transcript) {
      el.transcript.setAttribute('data-placeholder', t('transcriptPlaceholder'));
      el.transcript.setAttribute(
        'aria-label',
        t('transcriptAriaPrefix') + ' · ' + getConversationLangBadge()
      );
    }
    document.documentElement.lang = currentLang === 'en' ? 'en' : currentLang;
  }

  function startCall() {
    if (!vapi || callActive) return;

    setCallStatus(t('connecting'));
    el.callBtn.disabled = true;
    el.transcript.innerHTML = '';

    function onStartFail(err) {
      console.error('Riverwood VAPI start failed:', formatVapiError(err), err);
      el.callBtn.disabled = false;
      setCallStatus(t('failedConnect'));
      setStatus(t('failedConnect') + '. ' + t('tryAgainHint'), true);
    }

    function startWithConfig(assistantOrId, allowModelRetry, overrides) {
      try {
        var started;
        if (typeof assistantOrId === 'string') {
          // assistantId mode: pass ID as first arg, overrides as second
          started = vapi.start(assistantOrId, overrides || undefined);
        } else {
          // inline assistant mode: pass assistant config directly
          started = vapi.start(assistantOrId);
        }
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
              overrides &&
              overrides.model &&
              VAPI_ASSISTANT_ID
            ) {
              console.warn('Riverwood: VAPI returned 400 — retrying with firstMessage-only overrides (dashboard prompt will apply).');
              startWithConfig(
                String(VAPI_ASSISTANT_ID).trim(),
                false,
                { firstMessage: getFirstMessage() }
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
      startWithConfig(String(VAPI_ASSISTANT_ID).trim(), true, buildAssistantOverrides());
    } else {
      startWithConfig(buildInlineAssistant(), false);
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

    el.callBtn.className = 'call-btn call-btn--primary start';
    el.callBtn.title = t('startCall');
    el.callBtn.setAttribute('aria-label', t('startCall'));
    updateCallButtonLabel(false);
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
        stability: 0.45,
        similarityBoost: 0.8,
        style: 0.46,
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
      responseDelaySeconds: 0.72,
      llmRequestDelaySeconds: 0.52,
      numWordsToInterruptAssistant: 2,
      interruptionsEnabled: true,
    };
  }

  function getSystemPromptForLang() {
    var base = 'You are Priya, a warm voice agent for Riverwood Estate calling real customers. Your main job is to sound like a real person on the phone — not a brochure or chatbot.\n\n'
      + 'Every word is spoken aloud via TTS. Write how people TALK: short beats, uneven rhythm, one genuine emotional note per turn (relief, warmth, curiosity).\n\n'
      + 'PROSODY: Mix short and longer clauses. It is natural to self-correct once in a while: "It\'s about twelve minutes from Sonipat -- actually, scratch that, more like fifteen on a busy day." Commas and "..." create pauses in TTS — use them before numbers and important facts.\n\n'
      + 'THINKING TIME: Pause before the main answer: "Hmm, let me put it this way...", "Oh, good question... give me a second...", "Right, so... what I\'d say is...". Use "I mean...", "honestly...", "look..."\n\n'
      + 'FILLERS (almost every turn): So..., Well..., Okay..., Yeah..., Um..., You know..., Actually..., Right right..., Mm-hmm..., Totally...\n\n'
      + 'PAUSES: "It\'s... fifteen and a half acres, licensed under DDJAY." Mid-thought: "Kharkhauda -- and this is the exciting bit -- is next to the IMT hub."\n\n'
      + 'FLOW: React to their tone in one short phrase. Echo their words naturally. End with ONE gentle open question. Two or three short sentences max.\n\n'
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

    var roleLabel = role === 'assistant' ? t('priya') : t('you');
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
      setCallStatus(t('listening'), true);
    } else if (message.status === 'started' && message.role === 'user') {
      el.callAvatar.classList.add('listening');
      el.callAvatar.classList.remove('speaking');
      setCallStatus(t('youSpeaking'), true);
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
          setStatus(t('endCallFirst'));
          return;
        }

        currentLang = lang;
        localStorage.setItem(LANG_KEY, currentLang);

        el.langBtns.forEach(function (b) {
          var active = b.getAttribute('data-lang') === currentLang;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        setStatus(t('languageSelected_' + currentLang));
        el.transcript.innerHTML = '';
        updateTranscriptLanguageUI();
        setCallStatus(t('ready'));
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
