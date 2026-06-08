"use client";

import { useState } from "react";

export function CommandBar({
  onSubmit,
  busy,
  placeholder,
}: {
  onSubmit: (text: string) => void;
  busy: boolean;
  placeholder: string;
}) {
  const [text, setText] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() && !busy) onSubmit(text);
      }}
      className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 shadow-sm focus-within:border-indigo-300"
    >
      <span className="text-slate-400">⌘</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={busy}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition disabled:opacity-40 enabled:hover:bg-indigo-700"
      >
        {busy ? "…" : "Ask"}
      </button>
    </form>
  );
}
