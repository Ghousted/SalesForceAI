/**
 * Provider-agnostic LLM interface.
 *
 * The PRD leaves the model vendor "to decide later", so agents depend only on
 * this interface — never on a concrete SDK. Today the default is a deterministic
 * stub that composes a readable narrative from the structured facts an agent
 * passes in, so the whole platform runs and demos with no API key.
 *
 * To wire a real provider later, implement `LLMProvider` (e.g. an Anthropic
 * Claude or OpenAI adapter) and return it from `getLLM()` based on
 * `process.env.LLM_PROVIDER`. No agent code changes.
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
   * Optional structured payload the stub can use to compose a grounded answer
   * without a real model. Real providers can ignore this.
   */
  grounding?: unknown;
}

export interface LLMProvider {
  readonly name: string;
  complete(req: LLMCompletionRequest): Promise<string>;
}

/**
 * Deterministic stub. It does not invent facts — it echoes a lightly-formatted
 * version of the grounded `user` content so output is traceable to real data.
 * This is intentionally not "smart"; it is a seam for a real model.
 */
class StubProvider implements LLMProvider {
  readonly name = "stub";

  async complete(req: LLMCompletionRequest): Promise<string> {
    // The stub simply returns the pre-composed `user` payload, which agents
    // build from real spine data. Swapping in a model replaces this with a
    // genuine generation step.
    return req.user.trim();
  }
}

let cached: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (cached) return cached;

  const choice = (process.env.LLM_PROVIDER ?? "stub").toLowerCase();
  switch (choice) {
    // case "anthropic": cached = new AnthropicProvider(); break;
    // case "openai":    cached = new OpenAIProvider(); break;
    case "stub":
    default:
      cached = new StubProvider();
      break;
  }
  return cached;
}
