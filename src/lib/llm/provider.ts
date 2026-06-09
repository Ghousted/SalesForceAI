import { modelForAgent } from "./models";

/**
 * Provider-agnostic LLM interface.
 *
 * Agents depend only on this interface — never on a concrete SDK or model. Two
 * providers ship:
 *
 *   stub      — deterministic, no server. Echoes the grounded `user` payload so
 *               the whole platform runs and demos with zero infrastructure.
 *   llamacpp  — talks to a local llama.cpp OpenAI-compatible endpoint. With
 *               llama-swap in front, each agent's request names its own model
 *               and the right GGUF is hot-loaded on demand (see ./models.ts and
 *               infra/llama-swap.yaml).
 *
 * Select via `LLM_PROVIDER` (default: stub). No agent code changes either way.
 */

export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMCompletionRequest {
  /** Instruction describing the agent's job. */
  system: string;
  /** The structured facts / task for this call. */
  user: string;
  /**
   * Which agent is calling. Resolves the per-agent model + sampling params
   * (./models.ts). Omit for the default (brain) model.
   */
  agent?: string;
  /**
   * Optional structured payload the stub can use to compose a grounded answer
   * without a real model. Real providers ignore this.
   */
  grounding?: unknown;
}

export interface LLMProvider {
  readonly name: string;
  complete(req: LLMCompletionRequest): Promise<string>;
}

/**
 * Deterministic stub. It does not invent facts — it returns the grounded `user`
 * content so output is traceable to real data. A seam, not a model.
 */
class StubProvider implements LLMProvider {
  readonly name = "stub";

  async complete(req: LLMCompletionRequest): Promise<string> {
    return req.user.trim();
  }
}

/**
 * OpenAI-compatible chat adapter — one class for every `/v1/chat/completions`
 * endpoint: local **llama.cpp** (with llama-swap for hot-swappable GGUFs) and
 * hosted providers (**OpenAI, Groq, Together**, …). Only the base URL, key, and
 * model names differ; per-agent model selection (`modelForAgent`) is unchanged.
 * If the endpoint is unreachable it falls back to the grounded `user` text so a
 * model outage never takes the platform down.
 */
class OpenAICompatibleProvider implements LLMProvider {
  constructor(
    readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly timeoutMs: number,
  ) {}

  async complete(req: LLMCompletionRequest): Promise<string> {
    const cfg = modelForAgent(req.agent);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          temperature: cfg.temperature,
          max_tokens: cfg.maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`${this.name} HTTP ${res.status} for model ${cfg.model}`);
      }
      const data = await res.json();
      const text: string | undefined = data?.choices?.[0]?.message?.content;
      if (!text || !text.trim()) throw new Error("empty completion");
      return text.trim();
    } catch (err) {
      console.warn(
        `[llm] ${this.name} failed for agent=${cfg.agent} model=${cfg.model}: ${String(err)} — falling back to grounded text.`,
      );
      return req.user.trim();
    } finally {
      clearTimeout(timer);
    }
  }
}

const stripSlash = (u: string) => u.replace(/\/+$/, "");

let cached: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (cached) return cached;

  const choice = (process.env.LLM_PROVIDER ?? "stub").toLowerCase();
  const timeout = Number(process.env.LLM_TIMEOUT_MS ?? 60_000);
  switch (choice) {
    case "llamacpp":
      cached = new OpenAICompatibleProvider(
        "llamacpp",
        stripSlash(process.env.LLAMACPP_BASE_URL ?? "http://localhost:8080/v1"),
        process.env.LLAMACPP_API_KEY,
        timeout,
      );
      break;
    case "openai": // any hosted OpenAI-compatible endpoint (OpenAI, Groq, Together…)
      cached = new OpenAICompatibleProvider(
        "openai",
        stripSlash(process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"),
        process.env.OPENAI_API_KEY,
        timeout,
      );
      break;
    case "stub":
    default:
      cached = new StubProvider();
      break;
  }
  return cached;
}
