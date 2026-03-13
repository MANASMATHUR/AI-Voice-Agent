/**
 * Health check: reports configuration status. No secrets exposed.
 * GET /api/health
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders).end();
    return;
  }
  if (req.method !== 'GET') {
    res.writeHead(405, corsHeaders).setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const openaiConfigured = Boolean(
    process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')
  );
  const redisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
  const elevenlabsConfigured = Boolean(process.env.ELEVENLABS_API_KEY);
  const twilioConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  );

  // Determine TTS provider
  let ttsProvider = 'browser';
  if (elevenlabsConfigured) ttsProvider = 'elevenlabs';
  else if (openaiConfigured) ttsProvider = 'openai';

  res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    openai_configured: openaiConfigured,
    storage: redisConfigured ? 'redis' : 'memory',
    tts_provider: ttsProvider,
    phone_calls: twilioConfigured ? 'enabled' : 'disabled',
    features: {
      conversation_memory: true,
      streaming: true,
      rate_limiting: true,
      response_caching: true,
      persistent_storage: redisConfigured,
      voice_quality: ttsProvider === 'elevenlabs' ? 'premium' : ttsProvider === 'openai' ? 'good' : 'basic',
    },
  }));
}
