/**
 * Text-to-Speech with multiple provider support.
 * Priority: ElevenLabs → OpenAI TTS → Browser TTS
 * 
 * Without ElevenLabs, OpenAI TTS provides good quality voices.
 * "shimmer" voice is warm and friendly - perfect for Priya.
 */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pFZP5JQG7iQjIQuC4Bku';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer
// "shimmer" - warm, friendly female voice (best for Priya)
// "nova" - also warm female, slightly more energetic
const OPENAI_VOICE = process.env.OPENAI_TTS_VOICE || 'shimmer';

export function getTTSProvider() {
  if (ELEVENLABS_API_KEY) return 'elevenlabs';
  if (OPENAI_API_KEY) return 'openai';
  return 'browser';
}

export async function generateSpeech(text, options = {}) {
  const provider = options.provider || getTTSProvider();
  const lang = options.language || 'en';
  
  if (provider === 'elevenlabs' && ELEVENLABS_API_KEY) {
    return generateElevenLabsSpeech(text, lang);
  }
  
  if (provider === 'openai' && OPENAI_API_KEY) {
    return generateOpenAISpeech(text, lang);
  }
  
  return { provider: 'browser', audioBase64: null };
}

async function generateElevenLabsSpeech(text, lang) {
  // Select voice based on language
  // Hindi/Marathi: Use multilingual model
  // English: Use standard model
  const voiceId = getVoiceForLanguage(lang);
  const modelId = lang === 'en' ? 'eleven_turbo_v2_5' : 'eleven_multilingual_v2';
  
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text.slice(0, 2500),
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('ElevenLabs error:', response.status);
      return generateOpenAISpeech(text);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      provider: 'elevenlabs',
      audioBase64: buffer.toString('base64'),
      contentType: 'audio/mpeg',
    };
  } catch (err) {
    console.error('ElevenLabs error:', err.message);
    return generateOpenAISpeech(text);
  }
}

async function generateOpenAISpeech(text, lang = 'en') {
  if (!OPENAI_API_KEY) {
    return { provider: 'browser', audioBase64: null };
  }

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Use shimmer for warm female voice (Priya)
    // OpenAI TTS supports Hindi/Marathi text automatically
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: OPENAI_VOICE, // shimmer - warm, friendly female
      input: text.slice(0, 4096),
      response_format: 'mp3',
      speed: 1.0, // natural speed
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
  // ElevenLabs voice IDs
  const voices = {
    en: process.env.ELEVENLABS_VOICE_ID || 'pFZP5JQG7iQjIQuC4Bku', // Lily
    hi: process.env.ELEVENLABS_VOICE_ID_HI || 'Xb7hH8MSUJpSbSDYk0k2', // Alice (multilingual)
    mr: process.env.ELEVENLABS_VOICE_ID_MR || 'Xb7hH8MSUJpSbSDYk0k2', // Alice (multilingual)
  };
  return voices[lang] || voices.en;
}

export async function streamElevenLabsSpeech(text, lang = 'en') {
  if (!ELEVENLABS_API_KEY) return null;

  const voiceId = getVoiceForLanguage(lang);
  const modelId = lang === 'en' ? 'eleven_turbo_v2_5' : 'eleven_multilingual_v2';

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
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
