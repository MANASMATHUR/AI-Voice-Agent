/**
 * AI Voice Agent – OpenAI-only prototype.
 * Uses /api/chat (Vercel). Voice input: Web Speech API. Voice output: browser TTS.
 * Remembers conversation context (last 10 messages sent to API).
 */
(function () {
  'use strict';

  const API_BASE = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
  const conversation = [];
  let recognition = null;

  const el = {
    conversation: document.getElementById('conversation'),
    userInput: document.getElementById('user-input'),
    voiceBtn: document.getElementById('voice-btn'),
    sendBtn: document.getElementById('send-btn'),
    status: document.getElementById('status'),
  };

  if (!el.conversation || !el.userInput || !el.sendBtn || !el.status) return;

  function setStatus(text, isError) {
    el.status.textContent = text || '';
    el.status.classList.toggle('error', Boolean(isError));
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function appendMessage(role, content, options) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg ' + (role === 'assistant' ? 'assistant' : 'user');
    const roleLabel = role === 'assistant' ? 'Agent' : 'You';
    const contentClass = options && options.loading ? 'content loading' : 'content';
    msgDiv.innerHTML =
      '<div class="role">' + escapeHtml(roleLabel) + '</div>' +
      '<div class="' + contentClass + '">' + escapeHtml(content || '') + '</div>';
    el.conversation.appendChild(msgDiv);
    el.conversation.scrollTop = el.conversation.scrollHeight;
    return msgDiv;
  }

  function updateMessageContent(msgDiv, content) {
    const contentEl = msgDiv && msgDiv.querySelector('.content');
    if (contentEl) {
      contentEl.textContent = content || '';
      contentEl.classList.remove('loading');
    }
  }

  async function apiHealth() {
    try {
      const r = await fetch(API_BASE + '/api/health', { method: 'GET' });
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  function speakWithBrowser(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 500));
    u.rate = 0.95;
    u.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const en = voices.find(function (v) { return v.lang.startsWith('en'); });
    if (en) u.voice = en;
    window.speechSynthesis.speak(u);
  }

  async function startConversation() {
    const health = await apiHealth();
    if (health && health.openai_configured) {
      setStatus('Connecting…');
      var greetingPrompt = 'You are calling the customer on behalf of Riverwood Estate. In 2–3 short sentences: (1) Greet them warmly in English and Hindi. (2) Share a brief construction progress update for Sector 7 Kharkhauda. (3) Ask if they plan to visit the site soon. Keep it conversational and warm.';
      try {
        const r = await fetch(API_BASE + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: greetingPrompt }] }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || r.statusText);
        conversation.push({ role: 'user', content: greetingPrompt });
        conversation.push({ role: 'assistant', content: data.reply });
        appendMessage('assistant', data.reply);
        setStatus('Ready. Type or hold Voice to speak. Your response is recorded in the conversation.');
        speakWithBrowser(data.reply);
      } catch (e) {
        conversation.push({ role: 'assistant', content: 'Welcome. How can I help you today?' });
        appendMessage('assistant', 'Welcome. How can I help you today?');
        setStatus('Offline or error. Set OPENAI_API_KEY in Vercel and redeploy.', true);
        speakWithBrowser('Welcome. How can I help you today?');
      }
    } else {
      conversation.push({ role: 'assistant', content: 'Welcome. How can I help you today?' });
      appendMessage('assistant', 'Welcome. How can I help you today?');
      setStatus('Add OPENAI_API_KEY in Vercel project settings, then redeploy.');
      speakWithBrowser('Welcome. How can I help you today?');
    }
  }

  async function sendUserMessage(text) {
    const raw = (text != null ? String(text) : el.userInput.value || '').trim();
    if (!raw) return;

    el.userInput.value = '';
    appendMessage('user', raw);
    conversation.push({ role: 'user', content: raw });

    setStatus('Thinking…');
    el.sendBtn.disabled = true;
    if (el.voiceBtn) el.voiceBtn.disabled = true;
    const loadingRow = appendMessage('assistant', '…', { loading: true });

    try {
      const r = await fetch(API_BASE + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Request failed');
      const reply = data.reply && String(data.reply).trim();
      if (!reply) throw new Error('Empty response');
      conversation.push({ role: 'assistant', content: reply });
      updateMessageContent(loadingRow, reply);
      setStatus('Ready.');
      speakWithBrowser(reply);
    } catch (e) {
      const message = e && e.message ? e.message : 'Connection error';
      updateMessageContent(loadingRow, 'Sorry, I couldn’t respond right now. Please try again.');
      conversation.push({ role: 'assistant', content: 'Sorry, I couldn’t respond right now. Please try again.' });
      setStatus(message, true);
    } finally {
      el.sendBtn.disabled = false;
      if (el.voiceBtn) el.voiceBtn.disabled = false;
    }
  }

  function initSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !el.voiceBtn) {
      if (el.voiceBtn) el.voiceBtn.disabled = true;
      return;
    }
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';
    recognition.onresult = function (e) {
      var last = e.results.length - 1;
      var transcript = e.results[last][0].transcript;
      if (transcript) sendUserMessage(transcript);
    };
    recognition.onerror = function () {
      if (el.voiceBtn) el.voiceBtn.classList.remove('recording');
      setStatus('Voice ended.');
    };
    recognition.onend = function () {
      if (el.voiceBtn) {
        el.voiceBtn.classList.remove('recording');
        el.voiceBtn.setAttribute('aria-pressed', 'false');
      }
    };
  }

  el.sendBtn.addEventListener('click', function () { sendUserMessage(); });
  el.userInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendUserMessage(); }
  });

  if (el.voiceBtn) {
    el.voiceBtn.addEventListener('mousedown', function () {
      if (!recognition) return;
      el.voiceBtn.classList.add('recording');
      el.voiceBtn.setAttribute('aria-pressed', 'true');
      setStatus('Listening…');
      try { recognition.start(); } catch (err) { setStatus('Voice not available.'); }
    });
    el.voiceBtn.addEventListener('mouseup', function () {
      if (recognition) try { recognition.stop(); } catch (err) {}
      el.voiceBtn.setAttribute('aria-pressed', 'false');
    });
    el.voiceBtn.addEventListener('mouseleave', function () {
      if (recognition) try { recognition.stop(); } catch (err) {}
      el.voiceBtn.setAttribute('aria-pressed', 'false');
    });
  }

  if (window.speechSynthesis) window.speechSynthesis.getVoices();
  initSpeech();
  startConversation();
})();
