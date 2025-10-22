import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from './index';
import { ToastProvider } from '../components/Toast';

// Mock the client logger to prevent console output during tests
jest.mock('../utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

// Mock MediaRecorder and related APIs
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  ondataavailable: jest.fn(),
  state: 'inactive',
};

Object.defineProperty(global, 'MediaRecorder', {
  writable: true,
  value: jest.fn(() => mockMediaRecorder),
});

const mockMediaStream = {
  getAudioTracks: () => [{
    getSettings: () => ({ sampleRate: 48000 }),
    onended: jest.fn(),
    stop: jest.fn(),
  }],
  // Add getTracks method
  getTracks: jest.fn(() => ([{
    stop: jest.fn(),
    getSettings: () => ({ sampleRate: 48000 }),
  }]))
};

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(() => Promise.resolve(mockMediaStream)),
  },
  writable: true,
});

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  onopen: jest.fn(),
  onmessage: jest.fn(),
  onclose: jest.fn(),
  onerror: jest.fn(),
};

global.WebSocket = jest.fn(() => mockWebSocket);

describe('HomePage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockMediaRecorder.state = 'inactive'; // Reset state for each test
    mockMediaRecorder.ondataavailable = jest.fn(); // Reset ondataavailable
    mockWebSocket.readyState = 1; // Reset WebSocket state to OPEN
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders the home page with initial state', () => {
    render(
      <ToastProvider>
        <HomePage />
      </ToastProvider>
    );
    expect(screen.getByText('Real-time Voice Translation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Session' })).toBeInTheDocument();
  });

  it('starts recording session', async () => {
    render(
      <ToastProvider>
        <HomePage />
      </ToastProvider>
    );

    await act(async () => { // Wrap in act
      fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    });

    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true }));
    await waitFor(() => expect(global.WebSocket).toHaveBeenCalled());

    // Simulate WebSocket open
    await act(async () => { // Wrap in act
      mockWebSocket.onopen();
    });
    await waitFor(() => expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ sampleRate: 48000 })));

    // Simulate config_ack from server
    await act(async () => { // Wrap in act
      mockWebSocket.onmessage({ data: JSON.stringify({ type: 'config_ack' }) });
    });

    await waitFor(() => expect(mockMediaRecorder.start).toHaveBeenCalledWith(1000));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop Session' })).toBeInTheDocument());
  });

  it('stops recording session', async () => {
    render(
      <ToastProvider>
        <HomePage />
      </ToastProvider>
    );

    // Start the session first
    await act(async () => { // Wrap in act
      fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    });
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    await act(async () => { // Wrap in act
      mockWebSocket.onopen();
    });
    await act(async () => { // Wrap in act
      mockWebSocket.onmessage({ data: JSON.stringify({ type: 'config_ack' }) });
    });
    mockMediaRecorder.state = 'recording'; // Set state to recording

    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop Session' })).toBeInTheDocument());
    await act(async () => { // Wrap in act
      fireEvent.click(screen.getByRole('button', { name: 'Stop Session' }));
    });

    await waitFor(() => expect(mockMediaRecorder.stop).toHaveBeenCalled());
    await waitFor(() => expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'stopRecording' })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Session' })).toBeInTheDocument());
  });

  it('processes WebSocket transcription messages', async () => {
    render(
      <ToastProvider>
        <HomePage />
      </ToastProvider>
    );

    await act(async () => { // Wrap in act
      fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    });
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    await act(async () => { // Wrap in act
      mockWebSocket.onopen();
    });
    await act(async () => { // Wrap in act
      mockWebSocket.onmessage({ data: JSON.stringify({ type: 'config_ack' }) });
    });
    mockMediaRecorder.state = 'recording';

    // Simulate interim transcription
    await act(async () => {
      mockWebSocket.onmessage({
        data: JSON.stringify({
          transcription: 'hello',
          isFinal: false,
          language: 'en-US',
          sttLatencyMs: 100,
          translationDurationMs: null,
        }),
      });
    });
    expect(screen.getByText('hello', { exact: false })).toHaveStyle('color: rgb(128, 128, 128)'); // Interim text

    // Simulate final transcription
    await act(async () => { // Wrap in act
      mockWebSocket.onmessage({
        data: JSON.stringify({
          transcription: 'world',
          isFinal: true,
          language: 'en-US',
          sttLatencyMs: 200,
          translationDurationMs: 50,
          enTranslation: 'world',
          arTranslation: 'عالم',
        }),
      });
    });

    // Wait for UI updates to complete
    await waitFor(() => {
      const liveTranscriptionElement = screen.getByText('Live Transcription:').nextElementSibling;
      expect(liveTranscriptionElement).toHaveTextContent('world');
    });

    // Wait for translations to update
    await waitFor(() => {
      expect(screen.getByText('English Translation:').nextElementSibling).toHaveTextContent('world');
    });
    await waitFor(() => {
      expect(screen.getByText('Arabic Translation:').nextElementSibling).toHaveTextContent('عالم');
    });
    // Wait for latency values to update - checking each latency stat separately with more flexible text matching
    await waitFor(() => {
      const sttLatencyElement = screen.getByText(/STT Latency:/i).closest('p');
      expect(sttLatencyElement.textContent).toContain('200.00 ms');
    });
    await waitFor(() => {
      const translationLatencyElement = screen.getByText(/Translation Latency:/i).closest('p');
      expect(translationLatencyElement.textContent).toContain('50.00 ms');
    });
    await waitFor(() => {
      const overallLatencyElement = screen.getByText(/Overall Latency \(STT \+ Translation\):/i).closest('p');
      expect(overallLatencyElement.textContent).toContain('250.00 ms');
    });
  });

  it('shows error toast on WebSocket error', async () => {
    render(
      <ToastProvider>
        <HomePage />
      </ToastProvider>
    );

    await act(async () => { // Wrap in act
      fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    });
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    await act(async () => { // Wrap in act
      mockWebSocket.onopen();
    });
    await act(async () => { // Wrap in act
      mockWebSocket.onmessage({ data: JSON.stringify({ type: 'config_ack' }) });
    });
    mockMediaRecorder.state = 'recording';

    await act(async () => { // Wrap in act
      mockWebSocket.onerror({ message: 'Test WebSocket error' });
    });

    await waitFor(() => expect(screen.getByText('WebSocket error: Test WebSocket error')).toBeInTheDocument());
  });

  it('handles session timeout', async () => {
    render(
      <ToastProvider>
        <HomePage />
      </ToastProvider>
    );

    await act(async () => { // Wrap in act
      fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    });
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    await act(async () => { // Wrap in act
      mockWebSocket.onopen();
    });
    await act(async () => { // Wrap in act
      mockWebSocket.onmessage({ data: JSON.stringify({ type: 'config_ack' }) });
    });
    mockMediaRecorder.state = 'recording';

    await act(async () => { // Wrap in act
      jest.advanceTimersByTime(30 * 1000); // Advance time by SESSION_LIMIT_SECONDS
    });

    await waitFor(() => expect(mockMediaRecorder.stop).toHaveBeenCalled());
    await waitFor(() => expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'stopRecording' })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Session' })).toBeInTheDocument());
  });

  it('displays "Session too short" message if session stops without transcription', async () => {
    render(
      <ToastProvider>
        <HomePage />
      </ToastProvider>
    );

    await act(async () => { // Wrap in act
      fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    });
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    await act(async () => { // Wrap in act
      mockWebSocket.onopen();
    });
    await act(async () => { // Wrap in act
      mockWebSocket.onmessage({ data: JSON.stringify({ type: 'config_ack' }) });
    });
    mockMediaRecorder.state = 'recording';

    await act(async () => { // Wrap in act
      fireEvent.click(screen.getByRole('button', { name: 'Stop Session' })); // Stop immediately
    });

    await waitFor(() => expect(screen.getByText('Session too short for final translation. Please speak for longer.')).toBeInTheDocument());
  });
});
