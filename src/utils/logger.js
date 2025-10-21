// src/utils/logger.js

const isDevelopment = process.env.NODE_ENV === 'development';

const clientLogger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
};

export default clientLogger;