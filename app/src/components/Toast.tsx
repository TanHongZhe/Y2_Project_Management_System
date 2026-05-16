'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastAPI {
  success: (msg: string, opts?: { action?: ToastItem['action']; duration?: number }) => void;
  error:   (msg: string, opts?: { action?: ToastItem['action']; duration?: number }) => void;
  info:    (msg: string, opts?: { action?: ToastItem['action']; duration?: number }) => void;
  warning: (msg: string, opts?: { action?: ToastItem['action']; duration?: number }) => void;
}

const ToastCtx = createContext<ToastAPI | null>(null);

export function useToast(): ToastAPI {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}

const ICONS: Record<ToastType, string> = { success: '✓', error: '✕', info: 'i', warning: '!' };

function ToastEl({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [out, setOut] = useState(false);

  const dismiss = useCallback(() => {
    setOut(true);
    setTimeout(() => onDismiss(item.id), 220);
  }, [item.id, onDismiss]);

  useEffect(() => {
    const t = setTimeout(dismiss, item.duration);
    return () => clearTimeout(t);
  }, [dismiss, item.duration]);

  return (
    <div className={`toast toast-${item.type}${out ? ' toast-exit' : ''}`} role="alert">
      <span className="toast-icon">{ICONS[item.type]}</span>
      <span className="toast-msg">{item.message}</span>
      {item.action && (
        <button className="toast-action-btn" onClick={() => { item.action!.onClick(); dismiss(); }}>
          {item.action.label}
        </button>
      )}
      <button className="toast-close-btn" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((type: ToastType, message: string, opts?: { action?: ToastItem['action']; duration?: number }) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(ts => [...ts.slice(-4), { id, type, message, duration: opts?.duration ?? 4000, action: opts?.action }]);
  }, []);

  const dismiss = useCallback((id: string) => setToasts(ts => ts.filter(t => t.id !== id)), []);

  const api: ToastAPI = {
    success: (m, o) => add('success', m, o),
    error:   (m, o) => add('error',   m, o),
    info:    (m, o) => add('info',    m, o),
    warning: (m, o) => add('warning', m, o),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map(t => <ToastEl key={t.id} item={t} onDismiss={dismiss} />)}
      </div>
    </ToastCtx.Provider>
  );
}
