
// src/pages/api/process-speech.js

import { getServices } from '@/lib/config';

// Disable the default body parser for this route
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read the stream into a buffer
async function getAsBuffer(req) {
  const buffer = [];
  for await (const chunk of req) {
    buffer.push(chunk);
  }
  return Buffer.concat(buffer);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { sttService } = getServices();

  try {
    const sampleRate = req.headers['x-sample-rate'];
    if (!sampleRate) {
      return res.status(400).json({ message: 'Missing X-Sample-Rate header' });
    }

    const audioData = await getAsBuffer(req);
    const result = await sttService.detectAndTranscribe(audioData, sampleRate);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in process-speech API:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
