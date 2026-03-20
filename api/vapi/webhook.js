import {
  getConversation,
  saveConversation,
  appendMessage,
  saveSessionMetadata,
} from '../lib/redis.js';
import {
  getProjectSummary,
  getLocationBenefits,
  getRandomConstructionUpdate,
  RIVERWOOD_KNOWLEDGE,
} from '../lib/knowledge.js';

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

  let body;
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(await getRawBody(req));
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const serverSecret = process.env.VAPI_SERVER_SECRET;
  if (serverSecret) {
    const headerSecret = req.headers['x-vapi-secret'];
    if (headerSecret !== serverSecret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const message = body.message || body;
  const messageType = message.type || body.type;

  try {
    switch (messageType) {
      case 'function-call':
        return await handleFunctionCall(message, res);
      case 'end-of-call-report':
        return await handleEndOfCallReport(message, res);
      case 'transcript':
        return await handleTranscript(message, res);
      case 'hang':
        return await handleHang(message, res);
      case 'status-update':
        return await handleStatusUpdate(message, res);
      case 'assistant-request':
        return await handleAssistantRequest(message, res);
      default:
        res.status(200).json({});
    }
  } catch (err) {
    console.error('VAPI webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleFunctionCall(message, res) {
  const functionCall = message.functionCall || message;
  const name = functionCall.name;
  const params = functionCall.parameters || {};

  let result;

  switch (name) {
    case 'getConstructionUpdate':
      result = getConstructionUpdateResult();
      break;
    case 'getProjectDetails':
      result = getProjectDetailsResult(params.topic);
      break;
    case 'scheduleVisit':
      result = await handleScheduleVisit(message, params);
      break;
    case 'getLocationBenefits':
      result = { info: getLocationBenefits() };
      break;
    case 'endCall':
      result = { action: 'end_call', message: 'Call ending gracefully' };
      break;
    default:
      result = { error: `Unknown function: ${name}` };
  }

  res.status(200).json({ result: JSON.stringify(result) });
}

function getConstructionUpdateResult() {
  const updates = RIVERWOOD_KNOWLEDGE.constructionUpdates;
  const randomUpdate = getRandomConstructionUpdate();

  return {
    currentUpdate: randomUpdate,
    phases: updates.map((u) => `${u.phase}: ${u.status} - ${u.details}`).join('. '),
    summary: 'Construction is progressing well. Boundary wall and internal roads are being developed. Infrastructure planning is complete.',
  };
}

function getProjectDetailsResult(topic) {
  switch (topic) {
    case 'location':
      return {
        info: getLocationBenefits(),
        address: `${RIVERWOOD_KNOWLEDGE.location.sector}, ${RIVERWOOD_KNOWLEDGE.location.district}, ${RIVERWOOD_KNOWLEDGE.location.state}`,
        nearbyHub: RIVERWOOD_KNOWLEDGE.location.nearbyHub,
      };
    case 'features':
      return {
        features: RIVERWOOD_KNOWLEDGE.features.join('. '),
        totalArea: RIVERWOOD_KNOWLEDGE.specifications.totalArea,
        type: RIVERWOOD_KNOWLEDGE.specifications.projectType,
      };
    case 'ddjay':
      return {
        policy: 'Deen Dayal Jan Awas Yojna (DDJAY)',
        benefits: RIVERWOOD_KNOWLEDGE.ddjayBenefits.join('. '),
        approval: RIVERWOOD_KNOWLEDGE.specifications.approval,
      };
    case 'investment':
      return {
        highlights: RIVERWOOD_KNOWLEDGE.investmentHighlights.join('. '),
        growthStory: 'Similar to Gurgaon and Manesar growth. IMT Kharkhauda is attracting major manufacturers, driving housing demand.',
      };
    case 'general':
    default:
      return {
        summary: getProjectSummary(),
        area: RIVERWOOD_KNOWLEDGE.specifications.totalArea,
        type: RIVERWOOD_KNOWLEDGE.specifications.projectType,
        location: `${RIVERWOOD_KNOWLEDGE.location.sector}, ${RIVERWOOD_KNOWLEDGE.location.district}`,
      };
  }
}

async function handleScheduleVisit(message, params) {
  const callId = message.call?.id || 'unknown';
  const sessionId = `vapi_${callId}`;

  await saveSessionMetadata(sessionId, {
    visitRequested: true,
    preferredDate: params.preferredDate || 'not specified',
    preferredTime: params.preferredTime || 'not specified',
    numberOfVisitors: params.numberOfVisitors || 1,
    timestamp: Date.now(),
  });

  return {
    confirmed: true,
    message: 'Site visit interest recorded. Our team will call back to confirm the exact date and time.',
    note: params.preferredDate
      ? `Preferred date: ${params.preferredDate}, ${params.preferredTime || 'anytime'}`
      : 'No specific date preference. Team will coordinate.',
  };
}

async function handleEndOfCallReport(message, res) {
  const callId = message.call?.id || message.callId || 'unknown';
  const sessionId = `vapi_${callId}`;

  const transcript = message.transcript || message.artifact?.transcript || '';
  const messages = message.artifact?.messages || [];
  const duration = message.call?.endedAt && message.call?.startedAt
    ? Math.round((new Date(message.call.endedAt) - new Date(message.call.startedAt)) / 1000)
    : 0;

  const conversationHistory = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: m.message || m.content || '',
      timestamp: m.time || Date.now(),
    }));

  if (conversationHistory.length > 0) {
    await saveConversation(sessionId, conversationHistory);
  }

  await saveSessionMetadata(sessionId, {
    type: 'vapi_call',
    callId,
    duration,
    endReason: message.endedReason || message.call?.endedReason || 'unknown',
    customerPhone: message.call?.customer?.number || 'web',
    transcript: typeof transcript === 'string' ? transcript.slice(0, 5000) : '',
    messageCount: conversationHistory.length,
    completedAt: Date.now(),
  });

  console.log(`VAPI call ${callId} ended. Duration: ${duration}s, Messages: ${conversationHistory.length}`);

  res.status(200).json({});
}

async function handleTranscript(message, res) {
  res.status(200).json({});
}

async function handleHang(message, res) {
  const callId = message.call?.id || 'unknown';
  console.log(`VAPI call ${callId} hung up`);
  res.status(200).json({});
}

async function handleStatusUpdate(message, res) {
  const status = message.status;
  const callId = message.call?.id || 'unknown';
  console.log(`VAPI call ${callId} status: ${status}`);
  res.status(200).json({});
}

async function handleAssistantRequest(message, res) {
  const { getVoiceSystemPrompt, getFirstMessage, getToolDefinitions } = await import('../lib/voice-prompt.js');

  const customerNumber = message.call?.customer?.number || '';
  const lang = detectLanguageFromNumber(customerNumber);

  res.status(200).json({
    assistant: {
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 200,
        messages: [
          {
            role: 'system',
            content: getVoiceSystemPrompt(lang),
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
      firstMessage: getFirstMessage(lang),
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
      clientMessages: ['transcript', 'hang', 'function-call', 'speech-update', 'status-update'],
      serverMessages: ['end-of-call-report', 'function-call', 'hang', 'transcript'],
    },
  });
}

function getVoiceIdForLang(lang) {
  const voices = {
    en: process.env.ELEVENLABS_VOICE_ID || 'pFZP5JQG7iQjIQuC4Bku',
    hi: process.env.ELEVENLABS_VOICE_ID_HI || 'Xb7hH8MSUJpSbSDYk0k2',
    mr: process.env.ELEVENLABS_VOICE_ID_MR || 'Xb7hH8MSUJpSbSDYk0k2',
  };
  return voices[lang] || voices.en;
}

function detectLanguageFromNumber(number) {
  return process.env.AGENT_PRIMARY_LANGUAGE || 'en';
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
