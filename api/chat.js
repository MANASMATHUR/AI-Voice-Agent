import OpenAI from 'openai';

const MAX_CONTEXT_MESSAGES = 10; // last 5 user + 5 assistant (conversation context)
const MAX_COMPLETION_TOKENS = 100;
const MODEL = 'gpt-4o-mini';

function getSystemPrompt(lang) {
  const base = 'You are a warm voice agent calling customers. Give brief, friendly updates on construction progress and milestones. Ask about site visits when relevant. Reply in 1-3 short sentences. No markdown.';
  if (lang === 'hi') {
    return `${base} Respond ONLY in Hindi. Write all Hindi in Devanagari script (e.g. नमस्ते, कैसे हैं).`;
  }
  if (lang === 'mr') {
    return `${base} Respond ONLY in Marathi. Write all Marathi in Devanagari script (e.g. नमस्कार, कसे आहात).`;
  }
  return `${base} Respond ONLY in English.`;
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
  if (!apiKey || !apiKey.startsWith('sk-')) {
    jsonResponse(res, 503, { error: 'OpenAI API key not configured' });
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

  const raw = body.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    jsonResponse(res, 400, { error: 'messages array required' });
    return;
  }

  const lang = ['en', 'hi', 'mr'].includes(body.language) ? body.language : 'en';
  const systemPrompt = getSystemPrompt(lang);

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
    // 1. Get LLM Reply
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

    // 2. Generate TTS Audio
    const mp3Response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy", // "alloy" is a good neutral/warm voice
      input: reply,
      response_format: "mp3"
    });
    
    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    const audioBase64 = buffer.toString('base64');

    jsonResponse(res, 200, { reply, audioBase64 });
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
