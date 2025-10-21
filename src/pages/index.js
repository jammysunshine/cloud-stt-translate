
// src/pages/index.js

import { useState, useRef } from 'react';
import clientLogger from '../utils/logger.js'; // Import the client logger
import { SESSION_LIMIT_SECONDS, PING_INTERVAL_MS, MAX_HISTORY_SIZE, DEFAULT_WEBSOCKET_PORT, MEDIA_RECORDER_MIME_TYPE, CLIENT_STOP_TIMEOUT_MS } from '../config/appConfig.js';
import { useToast } from '../components/Toast'; // Import useToast

export default function HomePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [englishTranslation, setEnglishTranslation] = useState('');
  const [arabicTranslation, setArabicTranslation] = useState('');
  const [detectedLanguages, setDetectedLanguages] = useState([]);
  const [interimTranscription, setInterimTranscription] = useState('');
  const [hasFinalTranscription, setHasFinalTranscription] = useState(false);
  const [hasUserStoppedSession, setHasUserStoppedSession] = useState(false);
  const [sttLatency, setSttLatency] = useState(null);
  const [translationLatency, setTranslationLatency] = useState(null);
  const [overallLatency, setOverallLatency] = useState(null);

  const sttLatenciesHistory = useRef([]);
  const translationLatenciesHistory = useRef([]);
  const overallLatenciesHistory = useRef([]);

  const [avgSttLatency, setAvgSttLatency] = useState(null);
  const [avgTranslationLatency, setAvgTranslationLatency] = useState(null);
  const [avgOverallLatency, setAvgOverallLatency] = useState(null);

  const { addToast } = useToast(); // Initialize useToast

  // Use constants from appConfig.js
  // const MAX_HISTORY_SIZE = 20; // Keep history of last 20 latency values

  const calculateAverage = (historyRef) => {
    if (historyRef.current.length === 0) return null;
    const sum = historyRef.current.reduce((acc, val) => acc + val, 0);
    return (sum / historyRef.current.length).toFixed(2);
  };

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const sampleRateRef = useRef(null);
  const wsRef = useRef(null); // WebSocket instance
  const isStoppingRef = useRef(false); // Flag to prevent sending audio after stopRecording
  const sessionTimeoutRef = useRef(null); // Ref to store session timeout ID
  const pingIntervalRef = useRef(null); // Ref to store ping interval ID

  // Use constants from appConfig.js
  // const SESSION_LIMIT_SECONDS = 30; // Maximum session duration in seconds
  // const PING_INTERVAL_MS = 10000; // Send ping every 10 seconds to keep WebSocket alive

  const stopRecordingSession = () => {
    clientLogger.log('Stopping recording session...');
    isStoppingRef.current = true; // Set flag immediately

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); // Stop the recorder
      // No need to nullify mediaRecorderRef.current here, as ondataavailable will check isStoppingRef
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stopRecording' }));
    }
    setIsRecording(false);
    setHasUserStoppedSession(true);
    // Clear session timeout if it exists
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
  };

  // This function will now be called when a transcription is received via WebSocket
    const processWebSocketMessage = (data) => {
      if (data.transcription) {
        // Update latencies if present
        if (data.sttLatencyMs !== undefined) {
          const stt = parseFloat(data.sttLatencyMs);
          setSttLatency(stt.toFixed(2));
          sttLatenciesHistory.current.push(stt);
          if (sttLatenciesHistory.current.length > MAX_HISTORY_SIZE) {
            sttLatenciesHistory.current.shift();
          }
          setAvgSttLatency(calculateAverage(sttLatenciesHistory));
        }
        if (data.translationDurationMs !== undefined) {
          const trans = parseFloat(data.translationDurationMs);
          setTranslationLatency(trans.toFixed(2));
          translationLatenciesHistory.current.push(trans);
          if (translationLatenciesHistory.current.length > MAX_HISTORY_SIZE) {
            translationLatenciesHistory.current.shift();
          }
          setAvgTranslationLatency(calculateAverage(translationLatenciesHistory));
        }

        const currentSttLatency = data.sttLatencyMs !== undefined ? parseFloat(data.sttLatencyMs) : 0;
        const currentTranslationLatency = data.translationDurationMs !== undefined ? parseFloat(data.translationDurationMs) : 0;
        const overall = currentSttLatency + currentTranslationLatency;
        setOverallLatency(overall.toFixed(2));
        overallLatenciesHistory.current.push(overall);
        if (overallLatenciesHistory.current.length > MAX_HISTORY_SIZE) {
          overallLatenciesHistory.current.shift();
        }
        setAvgOverallLatency(calculateAverage(overallLatenciesHistory));

        if (data.isFinal) {
          clientLogger.log('Received FINAL transcription from server:', data.transcription);
          setTranscribedText(prev => {
            const newText = prev + ' ' + data.transcription;
            clientLogger.log('Updating transcribedText to:', newText);
            return newText;
          });
          setInterimTranscription(''); // Clear interim when final is received
          setHasFinalTranscription(true); // Set to true when a final transcription is received
  
          // Update detected languages
          if (data.language) {
            setDetectedLanguages(prev => {
              if (!prev.includes(data.language)) {
                return [...prev, data.language];
              }
              return prev;
            });
          }
  
          // Update translations if available
          if (data.enTranslation) {
            clientLogger.log('Received English translation:', data.enTranslation);
            setEnglishTranslation(prev => {
              const newTranslation = prev + ' ' + data.enTranslation;
              clientLogger.log('Updating englishTranslation to:', newTranslation);
              return newTranslation;
            });
          }
          if (data.arTranslation) {
            clientLogger.log('Received Arabic translation:', data.arTranslation);
            setArabicTranslation(prev => {
              const newTranslation = prev + ' ' + data.arTranslation;
              clientLogger.log('Updating arabicTranslation to:', newTranslation);
              return newTranslation;
            });
          }
        } else {
          setInterimTranscription(data.transcription); // Update interim
          // Update detected languages for interim results as well
          if (data.language) {
            setDetectedLanguages(prev => {
              if (!prev.includes(data.language)) {
                return [...prev, data.language];
              }
              return prev;
            });
          }
        }
      } else if (data.error) {
        addToast(`WebSocket error from server: ${data.error}`, 'error');
        addToast(`Server Error: ${data.error}`, 'error');
      }
    };

  const handleSessionButtonClick = async () => {
    clientLogger.log('handleSessionButtonClick called. isRecording:', isRecording);
    if (isRecording) {
      stopRecordingSession(); // Call the new function
    } else {
      // Start recording
      clientLogger.log('Attempting to start session...');
      // Reset states for a new session
      setTranscribedText('');
      setEnglishTranslation('');
      setArabicTranslation('');
      setDetectedLanguages([]);
      setInterimTranscription('');
      setHasFinalTranscription(false);
      setHasUserStoppedSession(false); // Reset when starting a new session
      isStoppingRef.current = false; // Reset flag when starting a new session
      try {
        clientLogger.log('Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        clientLogger.log('Microphone access granted.');

        // Get the sample rate from the audio track
        const track = stream.getAudioTracks()[0];
        const settings = track.getSettings();
        sampleRateRef.current = settings.sampleRate;
        clientLogger.log(`Audio sample rate detected: ${sampleRateRef.current}`);

        track.onended = () => {
          clientLogger.log('Audio track ended.');
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        };

        // Initialize WebSocket connection to the dedicated WebSocket server
        // Use NEXT_PUBLIC_WEBSOCKET_URL environment variable for deployment
        const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3001`;
        clientLogger.log(`Connecting to WebSocket at: ${websocketUrl}`);
        const ws = new WebSocket(websocketUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          clientLogger.log('WebSocket connection opened.');
          const configMessage = JSON.stringify({
            sampleRate: sampleRateRef.current,
          });
          ws.send(configMessage);

          // Start sending pings to keep the connection alive
          pingIntervalRef.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
          }, PING_INTERVAL_MS);
        };

        ws.onmessage = (event) => {
          clientLogger.log('Received message from WebSocket:', event.data);
          const data = JSON.parse(event.data);
          if (data.type === 'config_ack') {
            clientLogger.log('Received config_ack. Starting MediaRecorder.');
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                if (!isStoppingRef.current) { // Only send if not in stopping phase
                  try {
                    ws.send(event.data);
                  } catch (error) {
                    addToast(`Client-side error sending audio data: ${error.message}`, 'error');
                    addToast(`Client Error: ${error.message}`, 'error');
                    ws.close(4000, 'Client-side audio send error');
                  }
                }
              }
            };

            mediaRecorder.start(1000); // Send chunks every 1 second
            setIsRecording(true);

            // Set session timeout
            sessionTimeoutRef.current = setTimeout(() => {
              clientLogger.log('Session limit reached. Stopping recording.');
              stopRecordingSession(); // Programmatically stop the session
            }, SESSION_LIMIT_SECONDS * 1000); // 30 seconds

          } else {
            try {
              processWebSocketMessage(data);
            } catch (error) {
              addToast(`Client-side error processing WebSocket message: ${error.message}`, 'error');
              addToast(`Client Error: ${error.message}`, 'error');
              ws.close(4000, 'Client-side processing error');
            }
          }
        };

        ws.onclose = (event) => {
          clientLogger.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
          clientLogger.log('WebSocket close event details:', { code: event.code, reason: event.reason, wasClean: event.wasClean });
          // Clear ping interval on close
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }
          setIsRecording(false); // Always set to false on close
          // Show toast for abnormal closures or if recording was active
          if (!event.wasClean || event.code !== 1000) { // 1000 is normal closure
            addToast('WebSocket disconnected unexpectedly. Please try again.', 'error');
          } else if (isRecording) { // If it was a clean close but recording was active (e.g., user stopped)
            addToast('Recording session ended.', 'info'); // Or a different message for clean stop
          }
        };

        ws.onerror = (error) => {
          addToast(`WebSocket error: ${error.message}`, 'error');
          // Clear ping interval on error
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }
          addToast('WebSocket connection error.', 'error');
        };

        // Stop and release microphone if the user closes the tab
        window.addEventListener('beforeunload', () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          if (wsRef.current) {
            wsRef.current.close();
          }
        });

      } catch (error) {
        addToast(`Error accessing microphone or setting up WebSocket: ${error.message}`, 'error');
        addToast('Could not access microphone or establish connection. Please check permissions and server.', 'error');
      }
    }
  };

  const shouldShowSessionTooShortMessage = !isRecording && transcribedText === '' && hasUserStoppedSession;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h1>Real-time Voice Translation</h1>
      <button onClick={handleSessionButtonClick} style={{ padding: '10px 20px', fontSize: '16px' }}>
        {isRecording ? 'Stop Session' : 'Start Session'}
      </button>

      {shouldShowSessionTooShortMessage && (
        <p style={{ color: 'orange', marginTop: '10px' }}>
          Session too short for final translation. Please speak for longer.
        </p>
      )}

      <div style={{ marginTop: '20px' }}>
        <h2>Detected Languages:</h2>
        <p>{detectedLanguages.join(', ') || '...'}</p>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h2>Live Transcription:</h2>
        <p>{transcribedText} <span style={{ color: 'gray' }}>{interimTranscription}</span></p>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h2>English Translation:</h2>
        <p>{englishTranslation || '...'}</p>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h2>Arabic Translation:</h2>
        <p>{arabicTranslation || '...'}</p>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h2>Latency Statistics:</h2>
        <p>STT Latency: {sttLatency !== null ? `${sttLatency} ms` : '...'} (Avg: {avgSttLatency !== null ? `${avgSttLatency} ms` : '...'})</p>
        <p>Translation Latency: {translationLatency !== null ? `${translationLatency} ms` : '...'} (Avg: {avgTranslationLatency !== null ? `${avgTranslationLatency} ms` : '...'})</p>
        <p>Overall Latency (STT + Translation): {overallLatency !== null ? `${overallLatency} ms` : '...'} (Avg: {avgOverallLatency !== null ? `${avgOverallLatency} ms` : '...'})</p>
      </div>
    </div>
  );
}
