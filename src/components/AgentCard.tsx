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
  const { meta, status, displayName, enabled } = vm;
  const isHuman = meta.side === "human";
  const clickable = meta.implemented && enabled;
  const renamed = displayName !== meta.name;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onOpen?.(meta.id)}
      className={[
        "agent-card group flex h-full w-full flex-col rounded-xl border p-4 text-left transition",
        isHuman
          ? "border-rose-500/30 bg-rose-500/10"
          : "border-[var(--border)] bg-graphite",
        !enabled ? "opacity-55" : "",
        clickable
          ? "cursor-pointer hover:border-ember hover:shadow-sm"
          : "cursor-default",
      ].join(" ")}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--foreground)]">
              {displayName}
            </h3>
            {renamed && (
              <span className="text-[10px] font-medium text-ash/70">{meta.name}</span>
            )}
            {meta.mustHave && (
              <span className="rounded bg-ember-smoke px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ember">
                Must-have
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {meta.plainDescription}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-ash/10 px-2 py-0.5 text-[10px] font-medium text-ash">
          {SIDE_TAG[meta.side]}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <StatusBadge status={status} />
        {clickable ? (
          <span className="text-xs font-medium text-ember opacity-0 transition group-hover:opacity-100">
            Open →
          </span>
        ) : (
          !isHuman && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-ash/70">
              {meta.phase === 2 ? "Phase 2" : "Soon"}
            </span>
          )
        )}
      </div>
    </button>
  );
}
