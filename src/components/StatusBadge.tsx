import type { AgentStatus } from "@/agents/types";

const STYLES: Record<AgentStatus["kind"], { dot: string; text: string; bg: string }> = {
  done: { dot: "bg-green-600", text: "text-emerald-400", bg: "bg-emerald-500/10" },
  needs: { dot: "bg-amber-500", text: "text-amber-400", bg: "bg-amber-500/10" },
  idle: { dot: "bg-ash/30", text: "text-ash", bg: "bg-obsidian" },
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  const s = STYLES[status.kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.bg} ${s.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status.message}
    </span>
  );
}
