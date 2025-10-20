
// src/pages/index.js

import { useState, useRef } from 'react';

export default function HomePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [englishTranslation, setEnglishTranslation] = useState('');
  const [arabicTranslation, setArabicTranslation] = useState('');
  const [detectedLanguages, setDetectedLanguages] = useState([]);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const sampleRateRef = useRef(null);

  const getTranslation = async (text, sourceLang, targetLang) => {
    console.log(`Requesting translation for: "${text}" to ${targetLang}`);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, sourceLang, targetLang }),
      });
      const result = await response.json();
      console.log(`Received translation result for ${targetLang}:`, result);
      return result.translatedText;
    } catch (error) {
      console.error(`Error translating to ${targetLang}:`, error);
      return ''; // Return empty string on error
    }
  };

  const sendAudioChunk = async (chunk) => {
    if (chunk.size === 0) return;
    console.log('Sending audio chunk to backend...');
    try {
      const response = await fetch('/api/process-speech', {
        method: 'POST',
        body: chunk,
        headers: {
          'Content-Type': 'audio/webm',
          'X-Sample-Rate': sampleRateRef.current,
        },
      });
      const result = await response.json();
      console.log('Received transcription result from backend:', result);

      if (result.text) {
        console.log('Transcription received, updating state and requesting translations.');
        setTranscribedText(prev => prev + ' ' + result.text);

        // Update detected languages
        if (result.language && !detectedLanguages.includes(result.language)) {
          setDetectedLanguages(prev => [...prev, result.language]);
        }
        
        const [enTranslation, arTranslation] = await Promise.all([
          getTranslation(result.text, result.language, 'en'),
          getTranslation(result.text, result.language, 'ar'),
        ]);

        console.log('Setting translation states:', { enTranslation, arTranslation });
        setEnglishTranslation(prev => prev + ' ' + enTranslation);
        setArabicTranslation(prev => prev + ' ' + arTranslation);
      } else {
        console.log('No transcription text received in the result.');
      }
    } catch (error) {
      console.error('Error sending audio chunk:', error);
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
      setIsRecording(false);
    } else {
      // Start recording
      // Reset states for a new session
      setTranscribedText('');
      setEnglishTranslation('');
      setArabicTranslation('');
      setDetectedLanguages([]);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Get the sample rate from the audio track
        const track = stream.getAudioTracks()[0];
        const settings = track.getSettings();
        sampleRateRef.current = settings.sampleRate;
        console.log(`Audio sample rate detected: ${sampleRateRef.current}`);

        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          sendAudioChunk(event.data);
        };

        // Stop and release microphone if the user closes the tab
        window.addEventListener('beforeunload', () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        });

        // Send audio chunks every 5 seconds
        mediaRecorder.start(5000);
        setIsRecording(true);
      } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone. Please check permissions.');
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
        <p>{transcribedText || '...'}</p>
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
