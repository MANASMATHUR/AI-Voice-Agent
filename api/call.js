import {
  getConversation,
  saveConversation,
  saveSessionMetadata,
} from './lib/redis.js';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml');

  if (req.method === 'GET') {
    // Health check
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Twilio webhook is active.</Say></Response>');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Method not allowed</Say></Response>');
    return;
  }

  const body = req.body || {};
  const callSid = body.CallSid || generateCallId();
  const speechResult = body.SpeechResult || '';
  const callStatus = body.CallStatus || 'in-progress';

  // Handle call events
  if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer') {
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    return;
  }

  // Generate session ID from call SID
  const sessionId = `call_${callSid}`;

  try {
    // Load conversation history
    let conversation = await getConversation(sessionId);
    
    // First interaction - greeting
    if (!speechResult && conversation.length === 0) {
      const greeting = getGreeting('en');
      conversation.push({ role: 'assistant', content: greeting, timestamp: Date.now() });
      await saveConversation(sessionId, conversation);
      await saveSessionMetadata(sessionId, { type: 'phone_call', startTime: Date.now() });

      res.status(200).send(generateTwiML(greeting, true));
      return;
    }

    // User said something - process with LLM
    if (speechResult) {
      conversation.push({ role: 'user', content: speechResult, timestamp: Date.now() });

      // Get AI response
      const aiResponse = await getAIResponse(conversation, 'en');
      conversation.push({ role: 'assistant', content: aiResponse, timestamp: Date.now() });
      await saveConversation(sessionId, conversation);

      // Check for goodbye intent
      const isGoodbye = /bye|goodbye|thank you|that's all/i.test(speechResult);
      
      res.status(200).send(generateTwiML(aiResponse, !isGoodbye));
      return;
    }

    // No input received
    res.status(200).send(generateTwiML("I didn't catch that. Could you please repeat?", true));
  } catch (error) {
    console.error('Call handler error:', error);
    res.status(200).send(generateTwiML("I'm sorry, I'm having trouble right now. Please try again later.", false));
  }
}

function generateCallId() {
  return 'CA' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getGreeting(lang) {
  const greetings = {
    en: "Hello! This is Priya calling from Riverwood Estate - your premium plotted township in Sector-7, Kharkhauda. I'm excited to share some great progress updates with you! The boundary wall and internal road construction is going really well. How are you doing today?",
    hi: "नमस्ते! मैं प्रिया, रिवरवुड एस्टेट से बोल रही हूं - सेक्टर-7, खरखौदा में आपकी प्रीमियम प्लॉटेड टाउनशिप। मैं आपको कुछ अच्छी खबर देने के लिए कॉल कर रही हूं! बाउंड्री वॉल और इंटरनल रोड का निर्माण बहुत अच्छी तरह से चल रहा है। आप कैसे हैं आज?",
  };
  return greetings[lang] || greetings.en;
}

function generateTwiML(message, continueListening = true) {
  const gather = continueListening 
    ? `<Gather input="speech" timeout="5" speechTimeout="auto" action="/api/call" method="POST">`
    : '';
  const gatherEnd = continueListening ? '</Gather>' : '';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${gather}
  <Say voice="Polly.Aditi" language="en-IN">${escapeXml(message)}</Say>
  ${gatherEnd}
  ${!continueListening ? '<Hangup/>' : '<Say voice="Polly.Aditi">I\'m still here if you have any questions.</Say>'}
</Response>`;
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function getAIResponse(conversation, lang) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "I'm sorry, I'm having technical difficulties. Someone from our team will call you back shortly.";
  }

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are Priya, a warm and friendly voice agent for Riverwood Estate. You're on a phone call with a customer.

PROJECT FACTS (be accurate):
- Riverwood Estate: 15.5-acre premium residential plotted township
- Location: Sector-7, Kharkhauda, District Sonipat, Haryana
- Policy: Licensed under DDJAY (Deen Dayal Jan Awas Yojna) by DTCP Haryana
- Near IMT Kharkhauda - major upcoming industrial hub
- Vastu-friendly plots for independent homes
- Tree-named roads: Bargad Avenue, Neem Ridge, Silver Oak Avenue
- Tagline: "Building Foundations"

CURRENT STATUS:
- Boundary wall and internal road construction in progress
- Plot demarcation completed
- Infrastructure planning finalized

WHY INVEST:
- Government-licensed = safe, transparent investment
- Near IMT Kharkhauda (similar growth story to Gurgaon/Manesar)
- Early entry advantage before major development
- Housing demand will rise with industrial workers

YOUR TASKS:
1. Share construction updates enthusiastically
2. Answer questions accurately using facts above
3. Highlight the IMT Kharkhauda growth opportunity
4. Offer to schedule site visits
5. Be warm, professional, and concise

IMPORTANT:
- Keep responses SHORT (2-3 sentences max) - this is a phone call
- Sound natural, not scripted
- If they want to end the call, say goodbye warmly`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }))
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 100,
      temperature: 0.7,
    });

    return completion.choices?.[0]?.message?.content?.trim() || "I understand. Is there anything else I can help you with?";
  } catch (error) {
    console.error('AI response error:', error);
    return "I understand. Let me note that down. Is there anything else you'd like to know about Riverwood Estate?";
  }
}
