
// websocket-server.js
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { SpeechClient } from '@google-cloud/speech';
import { translateText } from './src/lib/services/google/Translation.js'; // Adjust path

console.log('Render PORT environment variable:', process.env.PORT);

const speechClient = new SpeechClient();

const port = process.env.PORT || 3001; // Use a different port for WebSocket server

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
        console.log(`[WS Server] Received message. Type: ${typeof message}, Length: ${message.length || message.byteLength}`);
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
                      console.log('[WS Server] Received stopRecording message from client.');
                      if (recognizeStream) {
                        recognizeStream.end(); // Signal STT API to finalize
                        recognizeStream = null; // Clear the stream reference
                      }
                      // Give client a moment to receive final messages before closing server-side
                      setTimeout(() => {
                        if (ws.readyState === ws.OPEN) {
                          ws.close(1000, 'Client requested stop');
                        }
                      }, 2500); // 2.5-second delay
                      return; // Stop further processing for this message
                    }
        
                    const config = parsedMessage;
        
                    if (recognizeStream) {
                      recognizeStream.end();
                    }  
                      const requestConfig = {
                        encoding: 'WEBM_OPUS',
                        sampleRateHertz: config.sampleRate,
                        languageCode: 'hi-IN', // Re-adding default language hint as it's required with languageCodes
                        enableAutomaticPunctuation: true,
                        model: 'default',
                        languageCodes: ['hi-IN', 'en-US', 'es-ES'],
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
                console.error('[WS Server] Google STT Stream Error:', error);
                ws.send(JSON.stringify({ error: error.message }));
                ws.close(1011, 'Google STT Stream Error'); // Internal error
              })
              .on('end', () => {
                console.log('[WS Server] Google STT Stream Ended.');
              })
              .on('close', () => {
                console.log('[WS Server] Google STT Stream Closed.');
              })
              .on('data', async (data) => {
              const sttResponseTime = process.hrtime.bigint();
              let currentSttLatencyMs = null; // Declare here
              if (lastSttWriteTime) {
                currentSttLatencyMs = Number(sttResponseTime - lastSttWriteTime) / 1_000_000;
                console.log(`[WS Server] STT processing latency: ${currentSttLatencyMs.toFixed(2)} ms`);
                lastSttWriteTime = null; // Reset after measurement
              }
  
                const transcription = data.results[0] && data.results[0].alternatives[0]
                  ? data.results[0].alternatives[0].transcript
                  : '';
                const isFinal = data.results[0] ? data.results[0].isFinal : false;
                const language = data.results[0] ? data.results[0].languageCode : 'und';
                if (isFinal) {
                  console.log('[WS Server] Received FINAL transcription.');
                }
              if (transcription && isFinal) {
                const translationStartTime = process.hrtime.bigint(); // Start timing translation

                const sourceBaseLang = language.split('-')[0];
                let enTranslation = '';
                let arTranslation = '';

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
                  const translationDurationMs = Number(translationEndTime - translationStartTime) / 1_000_000;
                  console.log(`[WS Server] Translation processing time: ${translationDurationMs.toFixed(2)} ms`);

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
                  console.error('[WS Server] Error during translation:', translationError);
                  enTranslation = `Translation Error: ${translationError.message}`;
                  arTranslation = `Translation Error: ${translationError.message}`;
                }

                // Include latencies in the message
                ws.send(JSON.stringify({
                  transcription,
                  isFinal,
                  language,
                  enTranslation,
                  arTranslation,
                  sttLatencyMs: currentSttLatencyMs, // Add STT latency
                  translationDurationMs: translationDurationMs // Add Translation latency
                }));
              } else if (transcription && !isFinal) {
                // Send interim results without translation
                ws.send(JSON.stringify({ transcription, isFinal, language, sttLatencyMs: currentSttLatencyMs })); // Also include STT latency for interim
              }
            });

          // Send acknowledgment back to client
          ws.send(JSON.stringify({ type: 'config_ack' }));

        } catch (e) {
          console.error('[WS Server] Error parsing config message:', e.message);
          ws.close(1008, 'Invalid config message');
        }
      } else if (recognizeStream) {
        // Send audio data to Google STT
        try {
          lastSttWriteTime = process.hrtime.bigint(); // Record time before writing to STT stream
          recognizeStream.write(message);
        } catch (error) {
          console.error('[WS Server] Error writing to Google STT stream:', error);
          ws.send(JSON.stringify({ error: 'Error sending audio to STT stream.' }));
          ws.close(1011, 'STT Stream Write Error');
        }
      } else {
        console.error('[WS Server] Received binary message before config. Closing WebSocket.');
        ws.close(1008, 'Binary message before config'); // Protocol error
      }
    });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    if (recognizeStream) {
      console.log('[WS Server] Ending Google STT recognizeStream due to client disconnection.');
      recognizeStream.end();
      recognizeStream = null; // Clear the stream reference
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    if (recognizeStream) {
      recognizeStream.end();
      recognizeStream = null; // Clear the stream reference
    }
    ws.close(1011, 'Server error'); // Internal error
  });
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(`> WebSocket server listening on ws://localhost:${port}`);
});
