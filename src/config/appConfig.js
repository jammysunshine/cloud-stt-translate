// src/config/appConfig.js

export const SESSION_LIMIT_SECONDS = 30;
export const PING_INTERVAL_MS = 10000; // 10 seconds
export const MAX_HISTORY_SIZE = 20;
export const DEFAULT_WEBSOCKET_PORT = 3001;
export const MEDIA_RECORDER_MIME_TYPE = 'audio/webm';

// Google Cloud STT Configuration
export const STT_ENCODING = 'WEBM_OPUS';
export const STT_MODEL = 'default';
export const STT_ENABLE_AUTOMATIC_PUNCTUATION = true;
export const STT_LANGUAGE_CODE = 'en-US'; // Default fallback language
export const STT_LANGUAGE_CODES = [
  'en-US', // English (United States)
  'ar-AE', // Arabic (United Arab Emirates) - primary language in Dubai
  'hi-IN', // Hindi (India) - common in Dubai expat community
  'es-ES', // Spanish (Spain)
  'fr-FR', // French (France)
  'de-DE', // German (Germany)
  'ja-JP', // Japanese (Japan)
  'ko-KR', // Korean (South Korea)
  'zh-CN', // Chinese (Simplified, China)
  'bn-IN', // Bengali (India) - common in Dubai expat community
  'te-IN', // Telugu (India) - common in Dubai expat community
  'gu-IN', // Gujarati (India) - common in Dubai expat community
  'ur-PK', // Urdu (Pakistan) - common in Dubai expat community
  'ta-IN', // Tamil (India) - common in Dubai expat community
  'it-IT'  // Italian (Italy) - common in Dubai expat community and tourism
]; // Languages for auto-detection

// Google Cloud Translation Configuration
export const TRANSLATION_MIME_TYPE = 'text/plain';
export const TRANSLATION_LOCATION = 'global';

// Timeouts
export const CLIENT_STOP_TIMEOUT_MS = 5000; // 5 seconds
export const SERVER_STT_CLOSE_TIMEOUT_MS = 60000; // 60 seconds