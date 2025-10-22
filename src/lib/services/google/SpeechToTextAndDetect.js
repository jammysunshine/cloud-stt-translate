// src/lib/services/google/SpeechToTextAndDetect.js
import { SpeechClient } from '@google-cloud/speech';
import logger from '../../../config/logger.js';
import { STT_ENCODING, STT_MODEL, STT_ENABLE_AUTOMATIC_PUNCTUATION, STT_LANGUAGE_CODE } from '../../../config/appConfig.js';

// Initialize Google Cloud Speech client
const speechClient = new SpeechClient();

/**
 * Detect language and transcribe audio using Google Cloud Speech-to-Text API
 * @param {Buffer} audioData - The audio data buffer to process
 * @param {string} languageHint - Optional language hint for detection (e.g., 'en-US')
 * @returns {Promise<Object>} An object containing transcription and detected language
 */
export async function detectAndTranscribe(audioData, languageHint = null) {
  logger.info('Starting STT and language detection with Google Cloud');
  
  try {
    const request = {
      config: {
        encoding: STT_ENCODING,
        languageCode: languageHint || STT_LANGUAGE_CODE, // Use hint if provided, otherwise default
        enableAutomaticPunctuation: STT_ENABLE_AUTOMATIC_PUNCTUATION,
        model: STT_MODEL,
        // Enable automatic language detection
        alternativeLanguageCodes: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'zh-CN', 'ja-JP', 'ko-KR', 'ar-SA', 'hi-IN'],
      },
      audio: {
        content: audioData.toString('base64'),
      },
    };

    logger.debug('Sending request to Google Cloud Speech API');
    const startTime = process.hrtime.bigint();
    
    const [response] = await speechClient.recognize(request);
    const processingTime = Number(process.hrtime.bigint() - startTime) / 1_000_000; // Convert to milliseconds
    
    logger.info(`Google Cloud Speech API completed in ${processingTime.toFixed(2)} ms`);
    
    if (response.results && response.results.length > 0) {
      const transcription = response.results
        .map(result => result.alternatives[0]?.transcript || '')
        .join(' ');
        
      // Get the most confident language detection
      const language = response.results[0].languageCode || 'und'; // 'und' for undetermined
      
      logger.info(`Transcription: "${transcription}"`);
      logger.info(`Detected language: ${language}`);
      
      return {
        transcription,
        language,
        processingTimeMs: processingTime,
        confidence: response.results[0].alternatives[0]?.confidence || null
      };
    } else {
      logger.warn('No speech results returned from API');
      return {
        transcription: '',
        language: 'und',
        processingTimeMs: processingTime,
        confidence: null
      };
    }
  } catch (error) {
    logger.error('Error in Google Cloud Speech-to-Text detection:', error);
    throw new Error(`STT and language detection failed: ${error.message}`);
  }
}

/**
 * Alternative method for streaming recognition (useful for longer audio or real-time processing)
 * @param {ReadableStream} audioStream - The audio stream to process
 * @param {string} languageHint - Optional language hint for detection
 * @returns {Promise<Object>} An object containing transcription and detected language
 */
export async function detectAndTranscribeStream(audioStream, languageHint = null) {
  logger.info('Starting streaming STT and language detection with Google Cloud');
  
  return new Promise((resolve, reject) => {
    const request = {
      config: {
        encoding: STT_ENCODING,
        sampleRateHertz: 16000, // Default sample rate, should be adjusted based on input
        languageCode: languageHint || STT_LANGUAGE_CODE,
        enableAutomaticPunctuation: STT_ENABLE_AUTOMATIC_PUNCTUATION,
        model: STT_MODEL,
        // Enable automatic language detection
        alternativeLanguageCodes: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'zh-CN', 'ja-JP', 'ko-KR', 'ar-SA', 'hi-IN'],
        interimResults: true,
      },
      interimResults: true,
    };

    const recognizeStream = speechClient.streamingRecognize(request)
      .on('error', (error) => {
        logger.error('Streaming recognition error:', error);
        reject(new Error(`Streaming STT and language detection failed: ${error.message}`));
      })
      .on('data', (data) => {
        if (data.results && data.results.length > 0) {
          const transcription = data.results
            .map(result => result.alternatives[0]?.transcript || '')
            .join(' ');
            
          const language = data.results[0].languageCode || 'und';
          const isFinal = data.results[0].isFinal || false;
          
          logger.info(`Streaming transcription: "${transcription}", Language: ${language}, Final: ${isFinal}`);
          
          // For streaming, we can return interim results or wait for final
          if (isFinal) {
            resolve({
              transcription,
              language,
              isFinal
            });
          }
        }
      });

    // Pipe the audio stream to the recognition stream
    audioStream.pipe(recognizeStream);
  });
}