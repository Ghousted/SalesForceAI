"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; message: string }

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

/** Fire a toast from any client component inside the shell. */
export function useToast() {
  return useContext(ToastContext);
}

const DOT: Record<ToastKind, string> = {
  success: "bg-emerald-400",
  error: "bg-rose-500",
  info: "bg-ember",
};

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[200] flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-ash/15 bg-graphite px-3.5 py-3 text-[13px] text-bone shadow-2xl"
            style={{ animation: "toast-in 0.25s ease-out" }}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[t.kind]}`} />
            <span className="min-w-0 flex-1">{t.message}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </ToastContext.Provider>
  );
}
