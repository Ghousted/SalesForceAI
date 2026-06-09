/**
 * Next.js runs `register()` once when the server boots. We use it to start the
 * in-process trigger scheduler so agents fire on their own — no request needed.
 * Node runtime only (skip edge); opt out with TRIGGERS_AUTORUN=false.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureScheduler } = await import("@/lib/triggers/runner");
    ensureScheduler();
  }
}
