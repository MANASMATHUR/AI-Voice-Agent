/**
 * Environment helpers – OpenAI, ElevenLabs, VAPI validation.
 * Production default: ElevenLabs TTS is required (set ELEVENLABS_OPTIONAL=true to allow OpenAI/browser fallback for local dev).
 */

export function isValidOpenAIApiKey(key) {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  return trimmed.startsWith('sk-') && trimmed.length > 20;
}

export function isElevenLabsConfigured() {
  const k = process.env.ELEVENLABS_API_KEY;
  return Boolean(k && typeof k === 'string' && k.trim().length > 8);
}

/** When true, chat-stream requires ElevenLabs for all server-side TTS. */
export function isElevenLabsRequired() {
  return process.env.ELEVENLABS_OPTIONAL !== 'true';
}

export function isVapiPublicConfigured() {
  const k = process.env.VAPI_PUBLIC_KEY;
  return Boolean(k && typeof k === 'string' && k.trim().length > 8);
}

export function openaiKeyErrorPayload() {
  return {
    error: 'OpenAI API key is not configured or invalid.',
    code: 'OPENAI_NOT_CONFIGURED',
    hint: 'Add OPENAI_API_KEY in Vercel → Environment Variables. Keys start with sk- or sk-proj-.',
  };
}

export function elevenlabsKeyErrorPayload() {
  return {
    error: 'ElevenLabs API key is required for premium voice (mandatory in production).',
    code: 'ELEVENLABS_NOT_CONFIGURED',
    hint: 'Add ELEVENLABS_API_KEY and optional ELEVENLABS_VOICE_ID in environment. Get a key at https://elevenlabs.io/ — For local dev only, set ELEVENLABS_OPTIONAL=true to allow OpenAI TTS fallback.',
  };
}

export function vapiPublicKeyErrorPayload() {
  return {
    error: 'VAPI public key is required for the Voice Call page.',
    code: 'VAPI_PUBLIC_NOT_CONFIGURED',
    hint: 'Add VAPI_PUBLIC_KEY (and usually VAPI_ASSISTANT_ID) from https://dashboard.vapi.ai/ to your server environment. Configure your VAPI assistant to use ElevenLabs voice + OpenAI model.',
  };
}

/** Redis recommended for scalable conversation memory (evaluation: memory + scalability). */
export function isRedisConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}
