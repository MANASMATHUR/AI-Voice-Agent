import OpenAI, { toFile } from 'openai';
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  const openai = new OpenAI({ apiKey });

  const form = new IncomingForm({ keepExtensions: true, allowEmptyFiles: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err);
      jsonResponse(res, 400, { error: 'Error parsing form data' });
      return;
    }

    const fileData = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    if (!fileData || !fileData.filepath) {
      jsonResponse(res, 400, { error: 'No audio file provided' });
      return;
    }

    try {
      const audioStream = fs.createReadStream(fileData.filepath);

      const transcription = await openai.audio.transcriptions.create({
        file: audioStream,
        model: 'whisper-1',
        language: 'en',
      });

      fs.unlink(fileData.filepath, () => {});

      jsonResponse(res, 200, { text: transcription.text });
    } catch (openaiErr) {
      console.error(openaiErr);
      fs.unlink(fileData.filepath, () => {});
      jsonResponse(res, 500, { error: 'Transcription failed' });
    }
  });
}
