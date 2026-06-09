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
 * llama.cpp adapter (OpenAI-compatible `/v1/chat/completions`).
 *
 * Per-agent model selection is hot-swappable: each call names its model and,
 * with llama-swap in front, that GGUF is loaded on demand. If the server is
 * unreachable, it falls back to the grounded `user` text so the app never
 * breaks during a demo.
 */
class LlamaCppProvider implements LLMProvider {
  readonly name = "llamacpp";
  private readonly baseUrl = (
    process.env.LLAMACPP_BASE_URL ?? "http://localhost:8080/v1"
  ).replace(/\/+$/, "");
  private readonly apiKey = process.env.LLAMACPP_API_KEY;
  private readonly timeoutMs = Number(process.env.LLAMACPP_TIMEOUT_MS ?? 60_000);

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
        throw new Error(`llama.cpp HTTP ${res.status} for model ${cfg.model}`);
      }
      const data = await res.json();
      const text: string | undefined = data?.choices?.[0]?.message?.content;
      if (!text || !text.trim()) throw new Error("empty completion");
      return text.trim();
    } catch (err) {
      // Resilient fallback: return the grounded input so a missing/slow model
      // server never takes the platform down.
      console.warn(
        `[llm] llama.cpp failed for agent=${cfg.agent} model=${cfg.model}: ${String(
          err,
        )} — falling back to grounded text.`,
      );
      return req.user.trim();
    } finally {
      clearTimeout(timer);
    }
  }
}

let cached: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (cached) return cached;

  const choice = (process.env.LLM_PROVIDER ?? "stub").toLowerCase();
  switch (choice) {
    case "llamacpp":
      cached = new LlamaCppProvider();
      break;
    case "stub":
    default:
      cached = new StubProvider();
      break;
  }
  return cached;
}
