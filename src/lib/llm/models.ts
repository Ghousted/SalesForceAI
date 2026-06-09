/**
 * Per-agent model assignment — hot-swappable via llama.cpp + llama-swap.
 *
 * Each agent declares the *kind* of model its job needs; this module resolves
 * that to a concrete model name that llama-swap loads on demand. Swapping the
 * model an agent uses is pure config — no agent code changes — and every name
 * is overridable by env so you can downshift to whatever your hardware runs.
 *
 * The four tiers form a ladder; agents are matched to the smallest model that
 * does their job well, with the interactive role-play getting the "brain".
 *
 *   fast   →  quick, cheap, templated work
 *   worker →  grounded summarization / digests (the platform's default)
 *   mid    →  faithfulness-critical reasoning over evidence (Auditor)
 *   brain  →  open-ended generation & persona (Sparring Partner role-play)
 *
 * The model strings below are the *hot-swap keys* — they must match the model
 * names you define in your llama-swap config (see infra/llama-swap.yaml). They
 * are not magic; rename them to whatever you actually serve.
 */

export type ModelTier = "fast" | "worker" | "mid" | "brain";

/** Hot-swap keys per tier. Override any via env to match your llama-swap config. */
export const MODEL_TIERS: Record<ModelTier, string> = {
  fast: process.env.MODEL_FAST ?? "qwen2.5-3b-instruct",
  worker: process.env.MODEL_WORKER ?? "qwen2.5-7b-instruct",
  mid: process.env.MODEL_MID ?? "qwen2.5-14b-instruct",
  brain: process.env.MODEL_BRAIN ?? "qwen2.5-32b-instruct",
};

interface AgentModelSpec {
  tier: ModelTier;
  temperature: number;
  maxTokens: number;
  reason: string;
}

/**
 * Best model per agent's job. Faithful/factual agents run cold (low temp) on
 * the smallest capable model; the Sparring Partner runs warm on the brain for
 * believable, varied dialogue.
 */
const AGENT_SPECS: Record<string, AgentModelSpec> = {
  dispatcher: {
    tier: "fast",
    temperature: 0.2,
    maxTokens: 80,
    reason:
      "A one-line routing rationale — a small fast model is plenty and keeps lead triage cheap at volume.",
  },
  scout: {
    tier: "worker",
    temperature: 0.3,
    maxTokens: 320,
    reason:
      "Grounded summarization of records into a readable brief — a 7B instruct model does this fast and well.",
  },
  forecaster: {
    tier: "worker",
    temperature: 0.2,
    maxTokens: 260,
    reason:
      "A short, faithful numeric digest — run cold so the figures aren't embellished.",
  },
  auditor: {
    tier: "mid",
    temperature: 0.15,
    maxTokens: 280,
    reason:
      "Flag accuracy is the trust currency (PRD §12). A 14B model reasons more reliably over the evidence; very low temp keeps it honest.",
  },
  "sparring-partner": {
    tier: "brain",
    temperature: 0.75,
    maxTokens: 200,
    reason:
      "Interactive role-play and persona — the brain. Needs a larger model and warmer sampling for natural, in-character reactions.",
  },
  scribe: {
    tier: "brain",
    temperature: 0.5,
    maxTokens: 320,
    reason:
      "Customer-facing email copy — quality matters, so the brain; moderate temp for warm-but-controlled prose.",
  },
  analyst: {
    tier: "worker",
    temperature: 0.3,
    maxTokens: 260,
    reason:
      "Post-call review — grounded reasoning over the interaction; a 7B handles the readout well.",
  },
  coach: {
    tier: "mid",
    temperature: 0.3,
    maxTokens: 180,
    reason:
      "Coaching judgment over a rep's patterns benefits from the mid model; low temp keeps advice grounded.",
  },
};

/** Default for any caller without a specific spec (e.g. future orchestrator). */
const DEFAULT_SPEC: AgentModelSpec = {
  tier: "brain",
  temperature: 0.4,
  maxTokens: 400,
  reason: "Unrouted / orchestration work defaults to the strongest model.",
};

export interface ResolvedAgentModel {
  agent: string;
  model: string;
  tier: ModelTier;
  temperature: number;
  maxTokens: number;
  reason: string;
}

/** Resolve the concrete model + sampling params for an agent. */
export function modelForAgent(agentId?: string): ResolvedAgentModel {
  const spec = (agentId && AGENT_SPECS[agentId]) || DEFAULT_SPEC;
  return {
    agent: agentId ?? "default",
    model: MODEL_TIERS[spec.tier],
    tier: spec.tier,
    temperature: spec.temperature,
    maxTokens: spec.maxTokens,
    reason: spec.reason,
  };
}

/** The full assignment table — handy for docs/debug endpoints. */
export function modelAssignments(): ResolvedAgentModel[] {
  return Object.keys(AGENT_SPECS).map((id) => modelForAgent(id));
}
