import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      if (process.env.NODE_ENV === 'production') {
        return JSON.stringify({ timestamp, level, message });
      } else {
        return `[${timestamp}] ${level}: ${message}`;
      }
    })
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

export default logger;