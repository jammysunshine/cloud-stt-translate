
// src/pages/index.js

import { useState, useRef } from 'react';

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

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const sampleRateRef = useRef(null);
  const wsRef = useRef(null); // WebSocket instance

  // This function will now be called when a transcription is received via WebSocket
    const processWebSocketMessage = (data) => {
      if (data.transcription) {
        // Update latencies if present
        if (data.sttLatencyMs !== undefined) {
          setSttLatency(data.sttLatencyMs.toFixed(2));
        }
        if (data.translationDurationMs !== undefined) {
          setTranslationLatency(data.translationDurationMs.toFixed(2));
        }
        if (data.sttLatencyMs !== undefined && data.translationDurationMs !== undefined) {
          setOverallLatency((data.sttLatencyMs + data.translationDurationMs).toFixed(2));
        } else if (data.sttLatencyMs !== undefined) {
          setOverallLatency(data.sttLatencyMs.toFixed(2)); // Only STT latency if no translation
        }

        if (data.isFinal) {
          setTranscribedText(prev => prev + ' ' + data.transcription);
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
            setEnglishTranslation(prev => prev + ' ' + data.enTranslation);
          }
          if (data.arTranslation) {
            setArabicTranslation(prev => prev + ' ' + data.arTranslation);
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
        console.error('WebSocket error from server:', data.error);
        alert(`Server Error: ${data.error}`);
      }
    };

  const handleSessionButtonClick = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'stopRecording' }));
        // Give server a moment to send final results before closing
        setTimeout(() => {
          if (wsRef.current) {
            wsRef.current.close();
          }
        }, 5000); // 5-second delay
      }
      setIsRecording(false);
      setHasUserStoppedSession(true); // User explicitly stopped the session
    } else {
      // Start recording
      // Reset states for a new session
      setTranscribedText('');
      setEnglishTranslation('');
      setArabicTranslation('');
      setDetectedLanguages([]);
      setInterimTranscription('');
      setHasFinalTranscription(false);
      setHasUserStoppedSession(false); // Reset when starting a new session
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Get the sample rate from the audio track
        const track = stream.getAudioTracks()[0];
        const settings = track.getSettings();
        sampleRateRef.current = settings.sampleRate;
        console.log(`Audio sample rate detected: ${sampleRateRef.current}`);

        track.onended = () => {
          console.log('Audio track ended.');
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        };

        // Initialize WebSocket connection to the dedicated WebSocket server
        // Use NEXT_PUBLIC_WEBSOCKET_URL environment variable for deployment
        const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3001`;
        const ws = new WebSocket(websocketUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          const configMessage = JSON.stringify({
            sampleRate: sampleRateRef.current,
          });
          ws.send(configMessage);
        };

        ws.onmessage = (event) => {
          console.log('Received message from WebSocket:', event.data);
          const data = JSON.parse(event.data);
          if (data.type === 'config_ack') {
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                try {
                  ws.send(event.data);
                } catch (error) {
                  console.error('Client-side error sending audio data:', error);
                  alert(`Client Error: ${error.message}`);
                  ws.close(1011, 'Client-side audio send error');
                }
              }
            };

            mediaRecorder.start(1000); // Send chunks every 1 second
            setIsRecording(true);

          } else {
            try {
              processWebSocketMessage(data);
            } catch (error) {
              console.error('Client-side error processing WebSocket message:', error);
              alert(`Client Error: ${error.message}`);
              ws.close(1011, 'Client-side processing error');
            }
          }
        };

        ws.onclose = (event) => {
          console.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
          if (isRecording) {
            setIsRecording(false);
            alert('Recording stopped due to WebSocket disconnection.');
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          alert('WebSocket connection error.');
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
        console.error('Error accessing microphone or setting up WebSocket:', error);
        alert('Could not access microphone or establish connection. Please check permissions and server.');
      }
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h1>Real-time Voice Translation</h1>
      <button onClick={handleSessionButtonClick} style={{ padding: '10px 20px', fontSize: '16px' }}>
        {isRecording ? 'Stop Session' : 'Start Session'}
      </button>

      {!isRecording && !hasFinalTranscription && transcribedText === '' && hasUserStoppedSession && (
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
        <p>STT Latency: {sttLatency !== null ? `${sttLatency} ms` : '...'}</p>
        <p>Translation Latency: {translationLatency !== null ? `${translationLatency} ms` : '...'}</p>
        <p>Overall Latency (STT + Translation): {overallLatency !== null ? `${overallLatency} ms` : '...'}</p>
      </div>
    </div>
  );
}
