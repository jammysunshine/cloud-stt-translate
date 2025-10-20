
// src/pages/api/translate.js

import { getServices } from '@/lib/config';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { translationService } = getServices();
  const { text, sourceLang, targetLang } = req.body;

  if (!text || !sourceLang || !targetLang) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  try {
    const result = await translationService.translateText(text, sourceLang, targetLang);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in translate API:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
