import {
  isElevenLabsConfigured,
  isElevenLabsRequired,
} from './env.js';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_VOICE = process.env.OPENAI_TTS_VOICE || 'shimmer';

export function getTTSProvider() {
  if (isElevenLabsConfigured()) return 'elevenlabs';
  if (OPENAI_API_KEY) return 'openai';
  return 'browser';
}

/**
 * Generate speech. If ElevenLabs is required (default) and missing, returns error object.
 */
export async function generateSpeech(text, options = {}) {
  const lang = options.language || 'en';

  if (isElevenLabsRequired() && !isElevenLabsConfigured()) {
    return {
      provider: null,
      audioBase64: null,
      error: 'ELEVENLABS_NOT_CONFIGURED',
    };
  }

  if (isElevenLabsConfigured()) {
    const out = await generateElevenLabsSpeech(text, lang);
    if (!out.error && out.audioBase64) return out;
    if (isElevenLabsRequired()) return out;
    return await generateOpenAISpeech(text, lang);
  }

  return await generateOpenAISpeech(text, lang);
}

async function generateElevenLabsSpeech(text, lang) {
  const voiceId = getVoiceForLanguage(lang);
  const modelId = lang === 'en' ? 'eleven_turbo_v2_5' : 'eleven_multilingual_v2';

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text.slice(0, 2500),
          model_id: modelId,
          // Tuned for conversational realism (pauses in text matter more; these add warmth)
          voice_settings: {
            stability: 0.48,
            similarity_boost: 0.8,
            style: 0.42,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('ElevenLabs error:', response.status, errText);
      return {
        provider: null,
        audioBase64: null,
        error: 'ELEVENLABS_API_ERROR',
        status: response.status,
        hint: 'Check ELEVENLABS_API_KEY quota and voice IDs.',
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      provider: 'elevenlabs',
      audioBase64: buffer.toString('base64'),
      contentType: 'audio/mpeg',
    };
  } catch (err) {
    console.error('ElevenLabs error:', err.message);
    return {
      provider: null,
      audioBase64: null,
      error: 'ELEVENLABS_REQUEST_FAILED',
      hint: err.message,
    };
  }
}

async function generateOpenAISpeech(text, lang = 'en') {
  if (!OPENAI_API_KEY) {
    return { provider: 'browser', audioBase64: null };
  }

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: OPENAI_VOICE,
      input: text.slice(0, 4096),
      response_format: 'mp3',
      speed: 1.0,
    });

    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    return {
      provider: 'openai',
      audioBase64: buffer.toString('base64'),
      contentType: 'audio/mpeg',
    };
  } catch (err) {
    console.error('OpenAI TTS error:', err.message);
    return { provider: 'browser', audioBase64: null };
  }
}

function getVoiceForLanguage(lang) {
  const voices = {
    en: process.env.ELEVENLABS_VOICE_ID || 'pFZP5JQG7iQjIQuC4Bku',
    hi: process.env.ELEVENLABS_VOICE_ID_HI || 'Xb7hH8MSUJpSbSDYk0k2',
    mr: process.env.ELEVENLABS_VOICE_ID_MR || 'Xb7hH8MSUJpSbSDYk0k2',
  };
  return voices[lang] || voices.en;
}

export async function streamElevenLabsSpeech(text, lang = 'en') {
  if (!isElevenLabsConfigured()) return null;

  const voiceId = getVoiceForLanguage(lang);
  const modelId = lang === 'en' ? 'eleven_turbo_v2_5' : 'eleven_multilingual_v2';

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text.slice(0, 2500),
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) return null;
    return response.body;
  } catch {
    return null;
  }
}
