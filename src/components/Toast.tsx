import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContextType {
  addToast: (message: string, type?: ToastMessage['type']) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [mounted, setMounted] = useState(false); // New state to track mount status

  useEffect(() => {
    setMounted(true); // Set mounted to true once component mounts on client
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {mounted && createPortal( // Conditionally render createPortal
        <div className="toast-container">
          {toasts.map((toast) => (
            <Toast key={toast.id} {...toast} onDismiss={() => removeToast(toast.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

interface ToastProps extends ToastMessage {
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, onDismiss }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000); // Dismiss after 5 seconds
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const typeClasses = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  };

  return (
    <div className={`toast ${typeClasses[type]} text-white p-3 rounded shadow-lg mb-2`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-3 font-bold">
        &times;
      </button>
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
