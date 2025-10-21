import 'dotenv/config'; // Load environment variables from .env file
import fs from 'fs'; // Import fs
import path from 'path'; // Import path
import os from 'os'; // Import os for temporary directory

// websocket-server.js
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { SpeechClient } from '@google-cloud/speech';
import { translateText } from './src/lib/services/google/Translation.js'; // Adjust path
import logger from './src/config/logger.js'; // Import the logger
import { DEFAULT_WEBSOCKET_PORT, STT_ENCODING, STT_MODEL, STT_ENABLE_AUTOMATIC_PUNCTUATION, STT_LANGUAGE_CODE, STT_LANGUAGE_CODES, SERVER_STT_CLOSE_TIMEOUT_MS } from './src/config/appConfig.js';

// Handle GOOGLE_APPLICATION_CREDENTIALS for deployment environments
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    // Create a temporary file to store the credentials
    const tempCredentialsPath = path.join(os.tmpdir(), 'gcloud-credentials.json');
    fs.writeFileSync(tempCredentialsPath, Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'base64').toString('utf8'));
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tempCredentialsPath;
    logger.info('Google Cloud credentials successfully written to temporary file.');
  } catch (error) {
    logger.error('Error writing Google Cloud credentials to temporary file:', error);
    // Exit or throw error if credentials cannot be set up
    process.exit(1);
  }
}

logger.info('Render PORT environment variable:', process.env.PORT);

const speechClient = new SpeechClient();

const port = process.env.PORT || DEFAULT_WEBSOCKET_PORT; // Use a different port for WebSocket server

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running');
});

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {

        let recognizeStream = null;
        let lastSttWriteTime = null; // To measure STT latency
  
      ws.on('message', async (message) => {
        logger.info(`[WS Server] Received message. Type: ${typeof message}, Length: ${message.length || message.byteLength}`);
        // console.log('[WS Server] Raw message:', message);
  
        let processedMessage = message;
        if (typeof message !== 'string') {
          // If message is not a string, it's likely a Buffer (binary data).
          // Try to convert it to string, assuming it might be the config message.
          try {
            const potentialString = message.toString('utf8');
            // Check if it looks like JSON before assuming it's a string config
            if (potentialString.startsWith('{') && potentialString.endsWith('}')) {
              processedMessage = potentialString;
            }
          } catch (e) {
            // Not a valid UTF-8 string, keep as binary
          }
        }
  
                if (typeof processedMessage === 'string') {
                  try {
                    const parsedMessage = JSON.parse(processedMessage);
        
                    if (parsedMessage.type === 'stopRecording') {
                      logger.info('[WS Server] Received stopRecording message from client.\n');
                      if (recognizeStream) {
                        recognizeStream.end(); // Signal STT API to finalize
                        const closeTimeout = setTimeout(() => { // Store timeout ID
                          if (recognizeStream) { // If it's still not null, it means on('close') didn't fire
                            logger.warn('[WS Server] recognizeStream did not close in time. Forcing WebSocket close.');
                            if (ws.readyState === ws.OPEN) {
                              ws.close(4000, 'STT Stream forced close timeout');
                            }
                            recognizeStream = null; // Clear reference
                          }
                        }, SERVER_STT_CLOSE_TIMEOUT_MS); // 30-second timeout for stream close

                        recognizeStream.on('close', () => {
                          logger.info('[WS Server] recognizeStream closed. Closing WebSocket.');
                          clearTimeout(closeTimeout); // Clear the timeout if stream closes cleanly
                          if (ws.readyState === ws.OPEN) {
                            ws.close(1000, 'Client requested stop'); // Use 1000 for normal closure
                          }
                          recognizeStream = null; // Clear the stream reference after closing WebSocket
                        });
                        recognizeStream = null; // Clear reference immediately after ending
                      } else {
                        // If recognizeStream was already null, just close the WebSocket
                        if (ws.readyState === ws.OPEN) {
                          ws.close(1000, 'Client requested stop (no active STT stream)');
                        }
                      }
                      return; // Stop further processing for this message
                    } else if (parsedMessage.type === 'ping') {
                      logger.info('[WS Server] Received ping from client.');
                      // Optionally send a pong back: ws.send(JSON.stringify({ type: 'pong' }));
                      return; // Do not process further
                    }
        
                    const config = parsedMessage;

                    // Only create a new recognizeStream if one doesn't exist
                    if (!recognizeStream) {
                      const requestConfig = {
                        encoding: STT_ENCODING,
                        sampleRateHertz: config.sampleRate,
                        languageCode: STT_LANGUAGE_CODE, // Re-adding default language hint as it's required with languageCodes
                        enableAutomaticPunctuation: STT_ENABLE_AUTOMATIC_PUNCTUATION,
                        model: STT_MODEL,
                        languageCodes: STT_LANGUAGE_CODES,
                      };  
            // The client does not send languageCode, so we remove the conditional block
            // if (config.languageCode) {
            //   requestConfig.languageCode = config.languageCode;
            // }
  
            const request = {
              config: requestConfig,
              interimResults: true, // Get interim results
              singleUtterance: false, // Expect continuous speech
            };
  
            recognizeStream = speechClient
              .streamingRecognize(request)
              .on('error', (error) => {
                logger.error('[WS Server] Google STT Stream Error:', error);
                ws.send(JSON.stringify({ error: error.message }));
                ws.close(4000, 'Google STT Stream Error'); // Internal error
              })
              .on('end', () => {
                logger.info('[WS Server] Google STT Stream Ended.');
              })
              .on('close', () => {
                logger.info('[WS Server] Google STT Stream Closed.');
              })
              .on('data', async (data) => {
              const sttResponseTime = process.hrtime.bigint();
              let currentSttLatencyMs = null; // Declare here
              if (lastSttWriteTime) {
                currentSttLatencyMs = Number(sttResponseTime - lastSttWriteTime) / 1_000_000;
                logger.info(`[WS Server] STT processing latency: ${currentSttLatencyMs.toFixed(2)} ms`);
                lastSttWriteTime = null; // Reset after measurement
              }
  
                const transcription = data.results[0] && data.results[0].alternatives[0]
                  ? data.results[0].alternatives[0].transcript
                  : '';
                const isFinal = data.results[0] ? data.results[0].isFinal : false;
                const language = data.results[0] ? data.results[0].languageCode : 'und';
                if (isFinal) {
                  logger.info('[WS Server] Received FINAL transcription.');
                }
              // Always include latency data, even if null for interim results
              const messageToSend = {
                transcription,
                isFinal,
                language,
                sttLatencyMs: currentSttLatencyMs !== null ? currentSttLatencyMs : 0,
                translationDurationMs: null // Default to null for interim
              };

              if (transcription && isFinal) { // Only perform translation and add its results for final transcriptions
                const translationStartTime = process.hrtime.bigint(); // Start timing translation

                const sourceBaseLang = language.split('-')[0];
                let enTranslation = ''; // Declare and initialize here
                let arTranslation = ''; // Declare and initialize here
                let translationDurationMs = null;

                const translationPromises = [];
                if (sourceBaseLang !== 'en') {
                  translationPromises.push(translateText(transcription, language, 'en'));
                }
                if (sourceBaseLang !== 'ar') {
                  translationPromises.push(translateText(transcription, language, 'ar'));
                }

                try {
                  const translations = await Promise.all(translationPromises);
                  const translationEndTime = process.hrtime.bigint(); // End timing translation
                  translationDurationMs = Number(translationEndTime - translationStartTime) / 1_000_000;
                  logger.info(`[WS Server] Translation processing time: ${translationDurationMs.toFixed(2)} ms`);

                  let translationIndex = 0;

                  if (sourceBaseLang !== 'en') {
                    enTranslation = translations[translationIndex++].translatedText;
                  } else {
                    enTranslation = transcription; // If source is English, it's the translation
                  }
                  if (sourceBaseLang !== 'ar') {
                    arTranslation = translations[translationIndex++].translatedText;
                  } else {
                    arTranslation = transcription; // If source is Arabic, it's the translation
                  }
                } catch (translationError) {
                  logger.error('[WS Server] Error during translation:', translationError);
                  enTranslation = `Translation Error: ${translationError.message}`;
                  arTranslation = `Translation Error: ${translationError.message}`;
                }

                // Add translations and actual translation latency to messageToSend for final results
                messageToSend.enTranslation = enTranslation;
                messageToSend.arTranslation = arTranslation;
                messageToSend.translationDurationMs = translationDurationMs;
              }

              ws.send(JSON.stringify(messageToSend));
            });
          } // Closes if (!recognizeStream)
          // Send acknowledgment back to client
          ws.send(JSON.stringify({ type: 'config_ack' }));

        } catch (e) {
          logger.error('[WS Server] Error parsing config message:', e.message);
          ws.close(1008, 'Invalid config message');
        }
      } else if (recognizeStream) {
        // Send audio data to Google STT
        try {
          lastSttWriteTime = process.hrtime.bigint(); // Record time before writing to STT stream
          logger.info(`[WS Server] Writing audio chunk to STT stream. Length: ${message.length || message.byteLength}`); // Add this log
          recognizeStream.write(message);
        } catch (error) {
          logger.error('[WS Server] Error writing to Google STT stream:', error);
          ws.send(JSON.stringify({ error: 'Error sending audio to STT stream.' }));
          ws.close(4000, 'STT Stream Write Error');
        }
      } else {
        logger.error('[WS Server] Received binary message before config. Closing WebSocket.');
        ws.close(1008, 'Binary message before config'); // Protocol error
      }
    });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
    if (recognizeStream) {
      logger.info('[WS Server] Ending Google STT recognizeStream due to client disconnection.');
      recognizeStream.end();
      recognizeStream = null; // Clear the stream reference
    }
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
    if (recognizeStream) {
      recognizeStream.end();
      recognizeStream = null; // Clear the stream reference
    }
    ws.close(4000, 'Server error'); // Internal error
  });
});

server.listen(port, (err) => {
  if (err) throw err;
  logger.info(`> WebSocket server listening on ws://localhost:${port}`);
});
