import OpenAI from 'openai';
import {
  getConversation,
  saveConversation,
  incrementRateLimit,
} from './_lib/redis.js';
import { getCachedResponse, setCachedResponse } from './_lib/cache.js';
import {
  isValidOpenAIApiKey,
  openaiKeyErrorPayload,
  isElevenLabsRequired,
  isElevenLabsConfigured,
  elevenlabsKeyErrorPayload,
} from './_lib/env.js';
import { generateSpeech } from './_lib/tts.js';

const MAX_CONTEXT_MESSAGES = 20;
const MAX_COMPLETION_TOKENS = 150;
const MODEL = 'gpt-4o-mini';

function getSystemPrompt(lang) {
  const base = `You are a warm, professional voice agent for Riverwood Estate - a premium residential township. Provide construction updates, answer questions, and help schedule site visits. Be conversational and concise (2-4 sentences).`;

  if (lang === 'hi') {
    return `${base}\n\nRespond ONLY in Hindi using Devanagari script (e.g., नमस्ते, कैसे हैं आप?).`;
  }
  if (lang === 'mr') {
    return `${base}\n\nRespond ONLY in Marathi using Devanagari script (e.g., नमस्कार, कसे आहात?).`;
  }
  return `${base}\n\nRespond in clear English.`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(res, status, data) {
  res.writeHead(status, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders).end();
    return;
  }
  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!isValidOpenAIApiKey(apiKey)) {
    jsonResponse(res, 503, openaiKeyErrorPayload());
    return;
  }

  let body;
  try {
    if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else {
      body = await getRequestBody(req);
    }
  } catch (e) {
    jsonResponse(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const sessionId = body.sessionId || null;
  const lang = ['en', 'hi', 'mr'].includes(body.language) ? body.language : 'en';
  const useTTS = body.tts !== false;

  if (useTTS && isElevenLabsRequired() && !isElevenLabsConfigured()) {
    jsonResponse(res, 503, elevenlabsKeyErrorPayload());
    return;
  }

  if (sessionId) {
    const rateLimit = await incrementRateLimit(sessionId);
    if (!rateLimit.allowed) {
      jsonResponse(res, 429, { error: 'Rate limit exceeded' });
      return;
    }
  }

  let raw = body.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    if (sessionId) {
      raw = await getConversation(sessionId);
    }
    if (!Array.isArray(raw) || raw.length === 0) {
      jsonResponse(res, 400, { error: 'messages array required' });
      return;
    }
  }

  const systemPrompt = getSystemPrompt(lang);
  const lastUserMessage = raw[raw.length - 1]?.content || '';

  const cachedResponse = await getCachedResponse(lastUserMessage, lang);
  if (cachedResponse) {
    const payload = { reply: cachedResponse.reply, cached: true };
    if (useTTS) {
      const tts = await generateSpeech(cachedResponse.reply, { language: lang });
      if (tts.error) {
        jsonResponse(res, 502, {
          error: 'ElevenLabs speech generation failed',
          code: tts.error,
          hint: tts.hint,
          reply: cachedResponse.reply,
          cached: true,
        });
        return;
      }
      payload.audioBase64 = tts.audioBase64;
      payload.ttsProvider = tts.provider;
    }
    jsonResponse(res, 200, payload);
    return;
  }

  const sanitized = raw
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? '').slice(0, 2000),
    }))
    .filter((m) => m.content.trim().length > 0);

  if (sanitized.length === 0) {
    jsonResponse(res, 400, { error: 'No valid messages' });
    return;
  }

  const openai = new OpenAI({ apiKey });
  const messages = [{ role: 'system', content: systemPrompt }, ...sanitized];

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: MAX_COMPLETION_TOKENS,
      temperature: 0.7,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() ?? '';
    if (!reply) {
      jsonResponse(res, 502, { error: 'Empty model response' });
      return;
    }

    if (sessionId) {
      const updatedConversation = [
        ...raw,
        { role: 'assistant', content: reply, timestamp: Date.now() }
      ];
      await saveConversation(sessionId, updatedConversation);
    }

    await setCachedResponse(lastUserMessage, lang, reply);

    if (useTTS) {
      const tts = await generateSpeech(reply, { language: lang });
      if (tts.error) {
        jsonResponse(res, 502, {
          error: 'ElevenLabs speech generation failed',
          code: tts.error,
          hint: tts.hint,
          reply,
        });
        return;
      }
      jsonResponse(res, 200, {
        reply,
        audioBase64: tts.audioBase64,
        ttsProvider: tts.provider,
      });
    } else {
      jsonResponse(res, 200, { reply });
    }
  } catch (err) {
    console.error(err);
    const code = err.status === 429 ? 429 : err.status === 401 ? 401 : 502;
    const message = err.message || 'Model request failed';
    jsonResponse(res, code, { error: message });
  }
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}
