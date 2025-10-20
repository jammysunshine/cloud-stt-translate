
// src/lib/config.js

// This function will dynamically import and return the STT and translation services
// based on the environment variables. This allows for a modular architecture
// where providers can be swapped easily.

export const getServices = () => {
  const sttProvider = process.env.STT_PROVIDER || 'google';
  const translationProvider = process.env.TRANSLATION_PROVIDER || 'google';

  // Dynamically import the services based on the provider
  const sttService = require(`@/lib/services/${sttProvider}/SpeechToTextAndDetect.js`);
  const translationService = require(`@/lib/services/${translationProvider}/Translation.js`);

  return {
    sttService,
    translationService,
  };
};
