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

  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    res.status(503).json({
      error: 'Twilio not configured',
      message: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables'
    });
    return;
  }

  const body = req.body || {};
  const { phoneNumber, customerName, language = 'en' } = body;

  if (!phoneNumber) {
    res.status(400).json({ error: 'phoneNumber is required' });
    return;
  }

  const cleanNumber = phoneNumber.replace(/\s+/g, '');
  if (!/^\+91\d{10}$/.test(cleanNumber)) {
    res.status(400).json({
      error: 'Invalid phone number format',
      expected: '+91XXXXXXXXXX'
    });
    return;
  }

  try {
    const baseUrl = getBaseUrl(req);
    const twilio = await getTwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    const call = await twilio.calls.create({
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      url: `${baseUrl}/api/call?name=${encodeURIComponent(customerName || '')}&lang=${language}`,
      statusCallback: `${baseUrl}/api/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      timeout: 30,
      machineDetection: 'Enable',
    });

    res.status(200).json({
      success: true,
      callSid: call.sid,
      status: call.status,
      to: cleanNumber,
      message: `Call initiated to ${cleanNumber}`,
    });
  } catch (error) {
    console.error('Outbound call error:', error);
    res.status(500).json({
      error: 'Failed to initiate call',
      message: error.message
    });
  }
}

function getBaseUrl(req) {
  const host = req.headers.host || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

async function getTwilioClient(accountSid, authToken) {
  const twilio = await import('twilio');
  return twilio.default(accountSid, authToken);
}
