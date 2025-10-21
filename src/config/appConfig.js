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
export const STT_LANGUAGE_CODE = 'hi-IN';
export const STT_LANGUAGE_CODES = ['hi-IN', 'en-US', 'es-ES'];

// Google Cloud Translation Configuration
export const TRANSLATION_MIME_TYPE = 'text/plain';
export const TRANSLATION_LOCATION = 'global';

// Timeouts
export const CLIENT_STOP_TIMEOUT_MS = 5000; // 5 seconds
export const SERVER_STT_CLOSE_TIMEOUT_MS = 30000; // 30 seconds