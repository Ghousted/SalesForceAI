import { AsyncLocalStorage } from "node:async_hooks";
import { DEFAULT_WORKSPACE_ID } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Request-scoped tenancy via AsyncLocalStorage. Each server entry point (page or
 * route handler) runs its body inside `withTenant(...)`, which resolves the
 * workspace from the session once and pins it with `store.run(...)` for the
 * whole async subtree — so the synchronous data layer reads the right workspace
 * with no cross-request races.
 *
 * `store.run()` (not `enterWith()`) is required: enterWith inside an awaited
 * helper does not propagate back to the caller's continuation, whereas run()
 * wraps the body so every read within it — across awaits — sees the value.
 *
 * Outside a request (e.g. the background scheduler) there's no store, so
 * `currentWorkspaceId()` falls back to the default workspace.
 */

const store = new AsyncLocalStorage<string>();

export function currentWorkspaceId(): string {
  return store.getStore() ?? DEFAULT_WORKSPACE_ID;
}

/** Run `fn` with the workspace resolved from the current session. */
export async function withTenant<T>(fn: () => T | Promise<T>): Promise<T> {
  let ws = DEFAULT_WORKSPACE_ID;
  try {
    const user = await getCurrentUser();
    if (user) ws = user.workspaceId;
  } catch {
    /* no request context → default workspace */
  }
  return store.run(ws, fn);
}

/** Run `fn` pinned to an explicit workspace (background jobs, scripts). */
export function runInWorkspace<T>(workspaceId: string, fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(store.run(workspaceId, fn));
}

/** Wrap a route handler so its whole body runs inside the resolved tenant. */
export function tenantRoute<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return (...args: A) => withTenant(() => handler(...args));
}
