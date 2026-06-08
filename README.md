# Sales OS

An agent-based sales platform that sits **on top of** a CRM (HubSpot first) rather than replacing it. The user doesn't navigate a sprawl of features — they work with a small team of named AI agents, each owning one job in the sales process.

> **Guiding principle:** AI owns the system, the human owns the close.

See [`PRD.md`](./PRD.md) for the full product definition.

## What's built (tracer-bullet slice)

This repo is the **Phase 1 foundation**, built as one working vertical rather than many shallow stubs:

- **Agent-roster home screen** — the home _is_ your team, grouped by when each agent helps (Before → The call → After → Behind the scenes). Each agent shows a push status ("3 briefs ready", "1 deal note looks optimistic"). Rep and Manager surfaces share one engine.
- **Scout, end-to-end** — the one fully-wired agent. Produces a grounded pre-call brief: who the prospect is, where the deal stands, fresh signals to act on, talking points, open risks, and a full activity timeline. Every line traces to a real record.
- **Command bar** — plain-language pull ("brief me on Elena") routed to the right agent.
- **Shared data spine** — all agents read the same material through one module, today fed by a **synthetic, sanitized** Ayala Land real-estate data pack (no live PII).
- **Provider-agnostic LLM seam** — agents depend on an `LLMProvider` interface, not a vendor SDK. Runs fully on a deterministic stub with no API key; a real model drops in later.

The other seven agents (Dispatcher, Sparring Partner, Analyst, Scribe, Auditor, Forecaster, Coach) render on the roster with their push status and are tagged as upcoming.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

- `/` — Rep workspace
- `/manager` — Manager workspace

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`.

## Architecture

```
src/
  app/
    page.tsx              Rep workspace (server) → Workspace
    manager/page.tsx      Manager workspace (server) → Workspace
    api/scout/route.ts    POST { contactId } → runs Scout
    api/command/route.ts  POST { text, repId } → command router
  agents/
    types.ts              Roster + run-result types (incl. evidence/provenance)
    registry.ts           The 8-agent roster (PRD §6)
    scout.ts              Scout — the one implemented agent
  lib/
    data/                 The shared data spine (types, synthetic pack, queries)
    llm/provider.ts       Provider-agnostic LLM seam (stub by default)
    command/router.ts     Plain-language → agent routing
    home/viewModel.ts     Builds the roster home view-model + push statuses
  components/             Workspace, AgentCard, CommandBar, ScoutBriefView…
```

### Key design decisions

- **A layer, not a rebuild.** The CRM stays the system of record. Swapping the synthetic pack for live HubSpot means re-implementing only `lib/data/spine.ts`.
- **Grounded, not generated.** Agent structure (signals, timeline, evidence) is deterministic and cites its sources; only the narrative sentence routes through the LLM seam. This keeps output trustworthy even on the stub.
- **Vendor-undecided by design.** `LLM_PROVIDER` selects the provider; the default `stub` needs no key. See `.env.example`.

## Next slices

1. **Sparring Partner** (must-have) — objection-practice mode.
2. **Auditor** (must-have) — reconcile rep notes/confidence against activity, with cited flags.
3. **Forecaster** — month forecast + manager digest, real multi-rep roll-up.
4. Wire a live `LLMProvider` (Anthropic/OpenAI) behind the existing seam.
5. Live, governed HubSpot read/write (Phase 2).
