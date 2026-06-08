"use client";

import type { AgentCardVM } from "@/lib/home/viewModel";
import { StatusBadge } from "./StatusBadge";

const SIDE_TAG: Record<string, string> = {
  rep: "For you",
  ops: "Ops",
  human: "Human",
};

export function AgentCard({
  vm,
  onOpen,
}: {
  vm: AgentCardVM;
  onOpen?: (id: string) => void;
}) {
  const { meta, status } = vm;
  const isHuman = meta.side === "human";
  const clickable = meta.implemented;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onOpen?.(meta.id)}
      className={[
        "group flex h-full w-full flex-col rounded-xl border p-4 text-left transition",
        isHuman
          ? "border-rose-200 bg-rose-50"
          : "border-[var(--border)] bg-white",
        clickable
          ? "cursor-pointer hover:border-indigo-300 hover:shadow-sm"
          : "cursor-default",
      ].join(" ")}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--foreground)]">
              {meta.name}
            </h3>
            {meta.mustHave && (
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                Must-have
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {meta.plainDescription}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          {SIDE_TAG[meta.side]}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <StatusBadge status={status} />
        {clickable ? (
          <span className="text-xs font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100">
            Open →
          </span>
        ) : (
          !isHuman && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {meta.phase === 2 ? "Phase 2" : "Soon"}
            </span>
          )
        )}
      </div>
    </button>
  );
}
