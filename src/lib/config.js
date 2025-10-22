// src/lib/config.js
// Central configuration module for provider abstraction

import logger from '../config/logger.js';

// Import service implementations
import { detectAndTranscribe as googleDetectAndTranscribe } from './services/google/SpeechToTextAndDetect.js';
import { translateText as googleTranslateText } from './services/google/Translation.js';

// Import other provider implementations (will be added as needed)
// import { detectAndTranscribe as azureDetectAndTranscribe } from './services/azure/SpeechToTextAndDetect.js';
// import { translateText as azureTranslateText } from './services/azure/Translation.js';

// STT and Language Detection service mapping
const STT_SERVICES = {
  google: googleDetectAndTranscribe,
  // azure: azureDetectAndTranscribe,
  // Add other providers as needed
};

// Translation service mapping
const TRANSLATION_SERVICES = {
  google: googleTranslateText,
  // azure: azureTranslateText,
  // Add other providers as needed
};

// Get STT service based on environment variable
const getSTTService = () => {
  const provider = process.env.STT_PROVIDER || 'google';
  logger.info(`Using STT provider: ${provider}`);
  
  if (!STT_SERVICES[provider]) {
    throw new Error(`STT provider '${provider}' not supported. Available: ${Object.keys(STT_SERVICES).join(', ')}`);
  }
  
  return STT_SERVICES[provider];
};

// Get Translation service based on environment variable
const getTranslationService = () => {
  const provider = process.env.TRANSLATION_PROVIDER || 'google';
  logger.info(`Using Translation provider: ${provider}`);
  
  if (!TRANSLATION_SERVICES[provider]) {
    throw new Error(`Translation provider '${provider}' not supported. Available: ${Object.keys(TRANSLATION_SERVICES).join(', ')}`);
  }
  
  return TRANSLATION_SERVICES[provider];
};

// Export the service functions
export const detectAndTranscribe = getSTTService();
export const translateText = getTranslationService();

// Export the provider getter functions for potential advanced use
export { getSTTService, getTranslationService };