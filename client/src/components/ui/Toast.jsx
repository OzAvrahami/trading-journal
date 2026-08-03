import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react';
import { IconButton } from './IconButton.jsx';

const ToastContext = createContext(null);

const presentation = {
  success: { Icon: CheckCircle, className: 'border-positive bg-positive-soft text-positive' },
  error: { Icon: WarningCircle, className: 'border-negative bg-negative-soft text-negative' },
  info: { Icon: Info, className: 'border-information bg-information-soft text-information' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const toast = useMemo(() => ({
    success: (message) => addToast(message, 'success'),
    error: (message) => addToast(message, 'error'),
    info: (message) => addToast(message, 'info'),
  }), [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-end gap-2 adaptive:bottom-4 adaptive:start-auto adaptive:end-4"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Notifications"
      >
        {toasts.map(({ id, message, type }) => {
          const { Icon, className } = presentation[type];
          return (
            <div key={id} role="status" className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border px-3 py-2.5 text-sm shadow-overlay ${className}`}>
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-primary">{message}</span>
              <IconButton label="Dismiss notification" variant="tertiary" size="sm" className="-me-1 -mt-1" onClick={() => dismiss(id)}>
                <X size={15} aria-hidden="true" />
              </IconButton>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be inside ToastProvider');
  return context;
}
