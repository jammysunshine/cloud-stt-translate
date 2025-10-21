
// src/pages/index.js

import { useState, useRef } from 'react';

export default function HomePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [englishTranslation, setEnglishTranslation] = useState('');
  const [arabicTranslation, setArabicTranslation] = useState('');
  const [detectedLanguages, setDetectedLanguages] = useState([]);
  const [interimTranscription, setInterimTranscription] = useState('');

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const sampleRateRef = useRef(null);
  const wsRef = useRef(null); // WebSocket instance

  // This function will now be called when a transcription is received via WebSocket
  const processWebSocketMessage = (data) => {
    if (data.transcription) {
      if (data.isFinal) {
        console.log('Final Transcription received, updating state.');
        setTranscribedText(prev => prev + ' ' + data.transcription);
        setInterimTranscription(''); // Clear interim when final is received

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
        console.log('Interim Transcription received, updating interim state.');
        setInterimTranscription(data.transcription); // Update interim
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
        wsRef.current.close();
      }
      setIsRecording(false);
    } else {
      // Start recording
      // Reset states for a new session
      setTranscribedText('');
      setEnglishTranslation('');
      setArabicTranslation('');
      setDetectedLanguages([]);
      setInterimTranscription('');
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
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.hostname}:3001`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          const configMessage = JSON.stringify({
            sampleRate: sampleRateRef.current,
          });
          console.log('Sending config message:', configMessage);
          ws.send(configMessage);
        };

        ws.onmessage = (event) => {
          console.log('Received message from WebSocket:', event.data);
          const data = JSON.parse(event.data);
          if (data.type === 'config_ack') {
            console.log('Received config_ack from server. Starting media recorder.');
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                console.log('Sending audio data chunk, size:', event.data.size);
                try {
                  ws.send(event.data);
                } catch (error) {
                  console.error('Client-side error sending audio data:', error);
                  alert(`Client Error: ${error.message}`);
                  ws.close(1011, 'Client-side audio send error');
                }
              }
            };

            mediaRecorder.start(5000); // Send chunks every 5 seconds
            setIsRecording(true);

            mediaRecorder.onstop = () => {
              console.log('MediaRecorder stopped. Attempting to restart...');
              if (isRecording) { // Only restart if the user hasn't explicitly stopped the session
                // Close the current WebSocket connection to trigger a new config message on reconnect
                if (ws.readyState === WebSocket.OPEN) {
                  ws.close(1000, 'MediaRecorder stopped, restarting');
                }
                // The handleSessionButtonClick will be called again to restart the session
                // This will create a new WebSocket and MediaRecorder
                handleSessionButtonClick();
              }
            };

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
    </div>
  );
}
