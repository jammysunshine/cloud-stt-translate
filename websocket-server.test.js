import { WebSocketServer } from 'ws';
import { SpeechClient } from '@google-cloud/speech';
import { translateText } from './src/lib/services/google/Translation.js';
import logger from './src/config/logger.js';
import http from 'http';
import { startWebSocketServer } from './websocket-server.js'; // Import the refactored function

// Mock Google Cloud Speech and Translation clients
jest.mock('@google-cloud/speech');
jest.mock('./src/lib/services/google/Translation.js');
jest.mock('./src/config/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));

const mockRecognizeStream = {
  write: jest.fn(),
  end: jest.fn(),
  on: jest.fn((event, handler) => {
    if (event === 'data') {
      // Simulate a data event for transcription
      handler({
        results: [{
          alternatives: [{
            transcript: 'hello world'
          }],
          isFinal: true,
          languageCode: 'en-US',
        }],
      });
    }
    if (event === 'close') {
      // Simulate stream closing
      handler();
    }
  }),
};

SpeechClient.mockImplementation(() => ({
  streamingRecognize: jest.fn(() => mockRecognizeStream),
}));

translateText.mockImplementation(async (text, source, target) => {
  if (target === 'en') return { translatedText: `Translated to English: ${text}` };
  if (target === 'ar') return { translatedText: `Translated to Arabic: ${text}` };
  return { translatedText: text };
});

describe('WebSocket Server', () => {
  let server;
  let wss;
  let client;

  beforeAll((done) => {
    // Create a dummy HTTP server for the WebSocketServer to attach to
    const httpServer = http.createServer();
    // Start the WebSocket server using the exported function
    const { server: startedServer, wss: startedWss } = startWebSocketServer(8080, httpServer);
    server = startedServer;
    wss = startedWss;

    server.listen(8080, () => {
      done();
    });
  });

  afterAll((done) => {
    wss.close(() => {
      server.close(done);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mockRecognizeStream's on method for each test
    mockRecognizeStream.on.mockImplementation((event, handler) => {
      if (event === 'data') {
        // Simulate a data event for transcription
        handler({
          results: [{
            alternatives: [{
              transcript: 'hello world'
            }],
            isFinal: true,
            languageCode: 'en-US',
          }],
        });
      }
      if (event === 'close') {
        // Simulate stream closing
        handler();
      }
    });
  });

  it('should establish a WebSocket connection', (done) => {
    client = new WebSocket('ws://localhost:8080');
    client.onopen = () => {
      expect(logger.info).toHaveBeenCalledWith('WebSocket client connected');
      client.close();
      done();
    };
  });

  it('should handle config message and start STT stream', (done) => {
    client = new WebSocket('ws://localhost:8080');
    client.onopen = () => {
      client.send(JSON.stringify({ sampleRate: 16000 }));
    };

    client.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'config_ack') {
        expect(SpeechClient).toHaveBeenCalledTimes(1);
        expect(SpeechClient.mock.instances[0].streamingRecognize).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              sampleRateHertz: 16000,
              languageCode: 'hi-IN', // Default from appConfig
            }),
          })
        );
        client.close();
        done();
      }
    };
  });

  it('should send audio data to STT stream', (done) => {
    client = new WebSocket('ws://localhost:8080');
    client.onopen = () => {
      client.send(JSON.stringify({ sampleRate: 16000 }));
    };

    client.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'config_ack') {
        const audioChunk = Buffer.from('audio_data');
        client.send(audioChunk);
        expect(mockRecognizeStream.write).toHaveBeenCalledWith(audioChunk);
        client.close();
        done();
      }
    };
  });

  it('should process STT transcription and send back to client', (done) => {
    client = new WebSocket('ws://localhost:8080');
    client.onopen = () => {
      client.send(JSON.stringify({ sampleRate: 16000 }));
    };

    client.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'config_ack') {
        // Simulate sending audio data to trigger STT data event
        client.send(Buffer.from('audio_data'));
      } else if (data.transcription) {
        expect(data.transcription).toBe('hello world');
        expect(data.isFinal).toBe(true);
        expect(data.language).toBe('en-US');
        expect(data.enTranslation).toBe('Translated to English: ${data.transcription}');
        expect(data.arTranslation).toBe('Translated to Arabic: ${data.transcription}');
        expect(data.sttLatencyMs).toBeGreaterThan(0);
        expect(data.translationDurationMs).toBeGreaterThan(0);
        client.close();
        done();
      }
    };
  });

  it('should handle stopRecording message', (done) => {
    client = new WebSocket('ws://localhost:8080');
    client.onopen = () => {
      client.send(JSON.stringify({ sampleRate: 16000 })); // Start stream
      client.send(JSON.stringify({ type: 'stopRecording' }));
    };

    client.onclose = (event) => {
      expect(event.code).toBe(1000); // Normal closure
      expect(mockRecognizeStream.end).toHaveBeenCalled();
      done();
    };
  });

  it('should log errors from STT stream', (done) => {
    client = new WebSocket('ws://localhost:8080');
    client.onopen = () => {
      client.send(JSON.stringify({ sampleRate: 16000 }));
    };

    client.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'config_ack') {
        // Simulate an error from the recognizeStream
        mockRecognizeStream.on.mockImplementation((event, handler) => {
          if (event === 'error') {
            handler(new Error('STT Test Error'));
          }
        });
        client.send(Buffer.from('audio_data')); // Trigger the error
      } else if (data.error) {
        expect(data.error).toContain('STT Test Error');
        expect(logger.error).toHaveBeenCalledWith('[WS Server] Google STT Stream Error:', expect.any(Error));
        client.close();
        done();
      }
    };
  });
});