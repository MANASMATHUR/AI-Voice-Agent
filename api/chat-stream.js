import OpenAI from 'openai';
import {
  getConversation,
  saveConversation,
  appendMessage,
  incrementRateLimit,
  saveSessionMetadata,
} from './_lib/redis.js';
import { getCachedResponse, setCachedResponse } from './_lib/cache.js';
import { generateSpeech } from './_lib/tts.js';
import { getVoiceSystemPrompt } from './_lib/voice-prompt.js';
import {
  isValidOpenAIApiKey,
  openaiKeyErrorPayload,
  isElevenLabsRequired,
  isElevenLabsConfigured,
  elevenlabsKeyErrorPayload,
} from './_lib/env.js';

const MAX_CONTEXT_MESSAGES = 20;
const MAX_COMPLETION_TOKENS = 200;
const MODEL = 'gpt-4o-mini';

function getSystemPrompt(lang, customerName = null) {
  return getVoiceSystemPrompt(lang, customerName);
}

function getGreetingContext() {
  const updates = [
    "Boundary wall construction is progressing well",
    "Internal road development is underway in the township",
    "Plot demarcation work has been completed",
    "Infrastructure planning for water and electricity is finalized",
    "Landscaping and green area planning is in progress",
    "Entry gate design has been approved",
  ];
  const randomUpdate = updates[Math.floor(Math.random() * updates.length)];

  return `CURRENT PROJECT STATUS: ${randomUpdate}. The IMT Kharkhauda industrial hub nearby is attracting major manufacturers, which will boost housing demand in the area.`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!isValidOpenAIApiKey(apiKey)) {
    res.status(503).json(openaiKeyErrorPayload());
    return;
  }

  if (isElevenLabsRequired() && !isElevenLabsConfigured()) {
    res.status(503).json(elevenlabsKeyErrorPayload());
    return;
  }

  let body;
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(await getRawBody(req));
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const sessionId = body.sessionId || generateSessionId();
  const lang = ['en', 'hi', 'mr'].includes(body.language) ? body.language : 'en';
  const userMessage = String(body.message || '').trim();
  const stream = body.stream !== false;

  if (!userMessage) {
    res.status(400).json({ error: 'message required' });
    return;
  }

  const rateLimit = await incrementRateLimit(sessionId);
  if (!rateLimit.allowed) {
    res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
    return;
  }

  const cachedResponse = await getCachedResponse(userMessage, lang);
  if (cachedResponse) {
    await appendMessage(sessionId, { role: 'user', content: userMessage });
    await appendMessage(sessionId, { role: 'assistant', content: cachedResponse.reply });

    const ttsCached = await generateSpeech(cachedResponse.reply, { language: lang });
    if (ttsCached.error) {
      res.status(502).json({
        error: 'ElevenLabs speech generation failed',
        code: ttsCached.error,
        hint: ttsCached.hint || elevenlabsKeyErrorPayload().hint,
        reply: cachedResponse.reply,
        sessionId,
        cached: true,
      });
      return;
    }
    res.status(200).json({
      reply: cachedResponse.reply,
      sessionId,
      cached: true,
      audioBase64: ttsCached.audioBase64,
      ttsProvider: ttsCached.provider,
    });
    return;
  }

  let conversationHistory = await getConversation(sessionId);

  conversationHistory.push({ role: 'user', content: userMessage });

  const systemPrompt = getSystemPrompt(lang);
  const greetingContext = getGreetingContext();
  const contextMessages = conversationHistory
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 2000),
    }))
    .filter((m) => m.content.length > 0);

  const messages = [
    { role: 'system', content: `${systemPrompt}\n\n${greetingContext}` },
    ...contextMessages
  ];
  const openai = new OpenAI({ apiKey });

  try {
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages,
        max_tokens: MAX_COMPLETION_TOKENS,
        temperature: 0.72,
        stream: true,
      });

      let fullReply = '';

      res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullReply += content;
          res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
        }
      }

      conversationHistory.push({ role: 'assistant', content: fullReply });
      await saveConversation(sessionId, conversationHistory);
      await saveSessionMetadata(sessionId, { language: lang });

      await setCachedResponse(userMessage, lang, fullReply);

      const tts = await generateSpeech(fullReply, { language: lang });

      res.write(`data: ${JSON.stringify({
        type: 'done',
        fullReply,
        audioBase64: tts.audioBase64,
        ttsProvider: tts.provider,
        ttsError: tts.error || null,
        ttsHint: tts.hint || null,
      })}\n\n`);
      res.end();
    } else {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages,
        max_tokens: MAX_COMPLETION_TOKENS,
        temperature: 0.72,
      });

      const reply = completion.choices?.[0]?.message?.content?.trim() || '';

      if (!reply) {
        res.status(502).json({ error: 'Empty model response' });
        return;
      }

      conversationHistory.push({ role: 'assistant', content: reply });
      await saveConversation(sessionId, conversationHistory);
      await saveSessionMetadata(sessionId, { language: lang });

      await setCachedResponse(userMessage, lang, reply);

      const tts = await generateSpeech(reply, { language: lang });

      if (tts.error) {
        res.status(502).json({
          error: 'ElevenLabs speech generation failed',
          code: tts.error,
          hint: tts.hint || elevenlabsKeyErrorPayload().hint,
          reply,
          sessionId,
        });
        return;
      }

      res.status(200).json({
        reply,
        sessionId,
        audioBase64: tts.audioBase64,
        ttsProvider: tts.provider,
      });
    }
  } catch (err) {
    console.error('Chat error:', err);
    const status = err.status === 429 ? 429 : err.status === 401 ? 401 : 502;
    const hint =
      status === 401
        ? 'Check that OPENAI_API_KEY is valid and not expired.'
        : status === 429
          ? 'OpenAI rate limit reached. Wait a moment and retry.'
          : 'Temporary model error. Retry shortly.';
    res.status(status).json({
      error: err.message || 'Model request failed',
      code: status === 401 ? 'OPENAI_AUTH' : status === 429 ? 'OPENAI_RATE_LIMIT' : 'MODEL_ERROR',
      hint,
    });
  }
}

function generateSessionId() {
  return 'ses_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
