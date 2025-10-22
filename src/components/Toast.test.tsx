import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastProvider, useToast } from './Toast';

// A dummy component to use the useToast hook
const TestComponent: React.FC = () => {
  const { addToast } = useToast();
  return (
    <div>
      <button onClick={() => addToast('Success message', 'success')}>Show Success</button>
      <button onClick={() => addToast('Error message', 'error', 100)}>Show Error (short)</button>
    </div>
  );
};

describe('Toast Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders ToastProvider and TestComponent without crashing', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    expect(screen.getByText('Show Success')).toBeInTheDocument();
  });

  it('adds and displays a success toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByText('Success message').closest('.toast')).toHaveClass('bg-green-500');
  });

  it('dismisses a toast after its duration', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Error (short)'));
    expect(screen.getByText('Error message')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(100); // Advance time by toast duration
    });

    expect(screen.queryByText('Error message')).not.toBeInTheDocument();
  });

  it('dismisses a toast when the close button is clicked', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();

    fireEvent.click(screen.getByText('×')); // Click the dismiss button
    expect(screen.queryByText('Success message')).not.toBeInTheDocument();
  });

  it('throws error if useToast is not used within ToastProvider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow('useToast must be used within a ToastProvider');
    consoleErrorSpy.mockRestore();
  });
});
