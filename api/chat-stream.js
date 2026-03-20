import OpenAI from 'openai';
import {
  getConversation,
  saveConversation,
  appendMessage,
  incrementRateLimit,
  saveSessionMetadata,
} from './lib/redis.js';
import { getCachedResponse, setCachedResponse } from './lib/cache.js';
import { generateSpeech } from './lib/tts.js';
import { getVoiceSystemPrompt } from './lib/voice-prompt.js';

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
  // CORS headers
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
  if (!apiKey || !apiKey.startsWith('sk-')) {
    res.status(503).json({ error: 'OpenAI API key not configured' });
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

  // Rate limiting
  const rateLimit = await incrementRateLimit(sessionId);
  if (!rateLimit.allowed) {
    res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
    return;
  }

  // Check cache for common queries
  const cachedResponse = await getCachedResponse(userMessage, lang);
  if (cachedResponse) {
    // Still save to conversation history
    await appendMessage(sessionId, { role: 'user', content: userMessage });
    await appendMessage(sessionId, { role: 'assistant', content: cachedResponse.reply });
    
    res.status(200).json({
      reply: cachedResponse.reply,
      sessionId,
      cached: true,
    });
    return;
  }

  // Load conversation history from storage
  let conversationHistory = await getConversation(sessionId);

  // Add current user message
  conversationHistory.push({ role: 'user', content: userMessage });

  // Build messages for OpenAI
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
      // Streaming response with SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages,
        max_tokens: MAX_COMPLETION_TOKENS,
        temperature: 0.7,
        stream: true,
      });

      let fullReply = '';

      // Send session ID first
      res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullReply += content;
          res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
        }
      }

      // Save to persistent storage
      conversationHistory.push({ role: 'assistant', content: fullReply });
      await saveConversation(sessionId, conversationHistory);
      await saveSessionMetadata(sessionId, { language: lang });

      // Cache if applicable
      await setCachedResponse(userMessage, lang, fullReply);

      // Generate TTS audio (in parallel with final message)
      const tts = await generateSpeech(fullReply, { language: lang });

      // Send completion signal with audio
      res.write(`data: ${JSON.stringify({ 
        type: 'done', 
        fullReply,
        audioBase64: tts.audioBase64,
        ttsProvider: tts.provider,
      })}\n\n`);
      res.end();
    } else {
      // Non-streaming response with TTS
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages,
        max_tokens: MAX_COMPLETION_TOKENS,
        temperature: 0.7,
      });

      const reply = completion.choices?.[0]?.message?.content?.trim() || '';

      if (!reply) {
        res.status(502).json({ error: 'Empty model response' });
        return;
      }

      // Save to persistent storage
      conversationHistory.push({ role: 'assistant', content: reply });
      await saveConversation(sessionId, conversationHistory);
      await saveSessionMetadata(sessionId, { language: lang });

      // Cache if applicable
      await setCachedResponse(userMessage, lang, reply);

      // Generate TTS audio
      const tts = await generateSpeech(reply, { language: lang });

      res.status(200).json({
        reply,
        sessionId,
        audioBase64: tts.audioBase64,
        ttsProvider: tts.provider,
      });
    }
  } catch (err) {
    console.error('Chat error:', err);
    const code = err.status === 429 ? 429 : err.status === 401 ? 401 : 502;
    res.status(code).json({ error: err.message || 'Model request failed' });
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
