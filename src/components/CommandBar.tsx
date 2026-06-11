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
      className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-graphite px-4 py-2.5 shadow-sm focus-within:border-ember"
    >
      <span className="text-ash/70">⌘</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={busy}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-ash/70"
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-bone transition disabled:opacity-40 enabled:hover:bg-ember"
      >
        {busy ? "…" : "Ask"}
      </button>
    </form>
  );
}
