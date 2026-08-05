import { useEffect, useId, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { IconButton } from './IconButton.jsx';
import { useTranslation } from 'react-i18next';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({ open, onClose, title, children, size = 'md' }) {
  const { t } = useTranslation();
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;

    restoreFocusRef.current = document.activeElement;
    const panel = panelRef.current;
    const focusables = () => [...(panel?.querySelectorAll(FOCUSABLE) || [])];
    const initialTarget = panel?.querySelector('[data-autofocus]') || focusables()[0] || panel;
    initialTarget?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        panel?.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-testid="modal-backdrop"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-lg border border-strong bg-surface shadow-overlay ${sizes[size]}`}
      >
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-default px-5 py-3">
          <h2 id={titleId} className="text-base font-semibold text-primary">{title}</h2>
          <IconButton label={t('shell.closeDialog')} variant="tertiary" size="sm" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
