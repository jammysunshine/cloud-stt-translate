
// src/lib/services/google/SpeechToTextAndDetect.js

import { SpeechClient } from '@google-cloud/speech';

const speechClient = new SpeechClient();

export async function detectAndTranscribe(audioData, sampleRate) {
  const audio = {
    content: audioData.toString('base64'),
  };

  const config = {
    encoding: 'WEBM_OPUS',
    sampleRateHertz: parseInt(sampleRate, 10),
    languageCode: 'en-US', // Primary language hint for auto-detection
    enableAutomaticPunctuation: true,
    model: 'default',
    // Enable automatic language detection
    languageCodes: ['hi-IN', 'en-US', 'pa-IN', 'ar-SA', 'es-ES', 'fr-FR', 'ml-IN', 'te-IN'], // Add languages you expect
  };

  console.log('Sending request to Google STT API with config:', JSON.stringify(config, null, 2));

  const request = {
    audio: audio,
    config: config,
  };

  try {
    const [response] = await speechClient.recognize(request);
    console.log('Received response from Google STT API:', JSON.stringify(response, null, 2));

    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
    
    // The Speech-to-Text API v1 doesn't directly return the detected language in the recognize response.
    // A more advanced implementation might use a separate language detection API or analyze the results.
    // For now, we'll return a placeholder for the language.
    const language = response.results.length > 0 ? response.results[0].languageCode : 'und';

    return {
      text: transcription,
      language: language, // Placeholder, as recognize API doesn't return this directly
    };
  } catch (error) {
    console.error('ERROR in Google STT service:', error);
    // Return a non-crashing response
    return {
      text: '',
      language: 'und',
    };
  }
}

module.exports = { detectAndTranscribe };
