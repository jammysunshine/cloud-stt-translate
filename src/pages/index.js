
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

  const sttLatenciesHistory = useRef([]);
  const translationLatenciesHistory = useRef([]);
  const overallLatenciesHistory = useRef([]);

  const [avgSttLatency, setAvgSttLatency] = useState(null);
  const [avgTranslationLatency, setAvgTranslationLatency] = useState(null);
  const [avgOverallLatency, setAvgOverallLatency] = useState(null);

  const MAX_HISTORY_SIZE = 20; // Keep history of last 20 latency values

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
    // ... existing code ...
  };

  const shouldShowSessionTooShortMessage = !isRecording && !hasFinalTranscription && transcribedText === '' && hasUserStoppedSession;

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
