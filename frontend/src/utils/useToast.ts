// src/utils/useToast.ts
// Shared toast hook — dùng chung cho mọi modal/component

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  title: string;
  message: string;
  type: ToastType;
  createdAt: number;
}

export const useToast = (durationMs = 5000) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<number, number>>({});

  const removeToast = useCallback((id: number) => {
    if (timersRef.current[id]) {
      window.clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (title: string, message: string, type: ToastType = "info") => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, title, message, type, createdAt: Date.now() }]);
      timersRef.current[id] = window.setTimeout(() => removeToast(id), durationMs);
    },
    [removeToast, durationMs],
  );

  const clearToasts = useCallback(() => {
    const timers = timersRef.current;
    Object.values(timers).forEach((t) => window.clearTimeout(t));
    timersRef.current = {};
    setToasts([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return { toasts, pushToast, removeToast, clearToasts };
};
