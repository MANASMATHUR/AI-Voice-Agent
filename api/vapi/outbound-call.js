import { getVoiceSystemPrompt, getFirstMessage, getToolDefinitions } from '../_lib/voice-prompt.js';

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

  const vapiKey = process.env.VAPI_API_KEY;
  if (!vapiKey) {
    res.status(503).json({ error: 'VAPI API key not configured' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(await getRawBody(req));
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const { phoneNumber, customerName, language } = body;
  const lang = ['en', 'hi', 'mr'].includes(language) ? language : 'en';

  if (!phoneNumber) {
    res.status(400).json({ error: 'phoneNumber is required' });
    return;
  }

  const cleanNumber = phoneNumber.replace(/[\s-]/g, '');
  if (!/^\+91\d{10}$/.test(cleanNumber)) {
    res.status(400).json({ error: 'Invalid phone number. Use +91XXXXXXXXXX format.' });
    return;
  }

  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    res.status(503).json({ error: 'VAPI phone number not configured' });
    return;
  }

  try {
    const assistantId = process.env.VAPI_ASSISTANT_ID;
    let callPayload;

    if (assistantId) {
      callPayload = {
        assistantId,
        assistantOverrides: {
          firstMessage: getFirstMessage(lang, customerName),
          model: {
            messages: [
              {
                role: 'system',
                content: getVoiceSystemPrompt(lang, customerName),
              },
            ],
          },
          transcriber: {
            language: lang === 'mr' ? 'hi' : lang,
          },
          voice: {
            voiceId: getVoiceIdForLang(lang),
            model: lang === 'en' ? 'eleven_turbo_v2_5' : 'eleven_multilingual_v2',
          },
        },
        customer: {
          number: cleanNumber,
          name: customerName || undefined,
        },
        phoneNumberId,
      };
    } else {
      callPayload = {
        assistant: {
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 200,
            messages: [
              {
                role: 'system',
                content: getVoiceSystemPrompt(lang, customerName),
              },
            ],
            tools: getToolDefinitions(),
          },
          voice: {
            provider: '11labs',
            voiceId: getVoiceIdForLang(lang),
            stability: 0.45,
            similarityBoost: 0.78,
            style: 0.35,
            useSpeakerBoost: true,
            optimizeStreamingLatency: 3,
            model: lang === 'en' ? 'eleven_turbo_v2_5' : 'eleven_multilingual_v2',
          },
          transcriber: {
            provider: 'deepgram',
            model: 'nova-2',
            language: lang === 'mr' ? 'hi' : lang,
            smartFormat: true,
            keywords: ['Riverwood:3', 'Kharkhauda:3', 'DDJAY:3', 'Sonipat:2', 'IMT:2', 'Priya:2', 'DTCP:2'],
            endpointing: 300,
          },
          firstMessage: getFirstMessage(lang, customerName),
          serverUrl: getServerUrl(req),
          silenceTimeoutSeconds: 30,
          maxDurationSeconds: 600,
          responseDelaySeconds: 0.5,
          llmRequestDelaySeconds: 0.3,
          numWordsToInterruptAssistant: 2,
          interruptionsEnabled: true,
          backgroundSound: 'office',
          backgroundDenoisingEnabled: true,
          modelOutputInMessagesEnabled: true,
          boostedKeywords: ['Riverwood', 'Kharkhauda', 'DDJAY', 'Sonipat', 'IMT Kharkhauda', 'Sector-7', 'DTCP'],
        },
        customer: {
          number: cleanNumber,
          name: customerName || undefined,
        },
        phoneNumberId,
      };
    }

    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vapiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('VAPI call error:', response.status, errorData);
      res.status(response.status).json({
        error: errorData.message || 'Failed to initiate VAPI call',
      });
      return;
    }

    const callData = await response.json();

    res.status(200).json({
      success: true,
      callId: callData.id,
      status: callData.status,
      phoneNumber: cleanNumber,
      language: lang,
    });
  } catch (err) {
    console.error('VAPI outbound call error:', err);
    res.status(502).json({ error: 'Failed to connect to VAPI' });
  }
}

function getVoiceIdForLang(lang) {
  const voices = {
    en: process.env.ELEVENLABS_VOICE_ID || 'pFZP5JQG7iQjIQuC4Bku',
    hi: process.env.ELEVENLABS_VOICE_ID_HI || 'Xb7hH8MSUJpSbSDYk0k2',
    mr: process.env.ELEVENLABS_VOICE_ID_MR || 'Xb7hH8MSUJpSbSDYk0k2',
  };
  return voices[lang] || voices.en;
}

function getServerUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  return `${protocol}://${host}/api/vapi/webhook`;
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
