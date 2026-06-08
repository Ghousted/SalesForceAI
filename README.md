# Sales OS

An agent-based sales platform that sits **on top of** a CRM (HubSpot first) rather than replacing it. The user doesn't navigate a sprawl of features — they work with a small team of named AI agents, each owning one job in the sales process.

> **Guiding principle:** AI owns the system, the human owns the close.

See [`PRD.md`](./PRD.md) for the full product definition.

## What's built (tracer-bullet slice)

This repo is the **Phase 1 foundation**, built as one working vertical rather than many shallow stubs:

- **Agent-roster home screen** — the home _is_ your team, grouped by when each agent helps (Before → The call → After → Behind the scenes). Each agent shows a push status ("3 briefs ready", "1 deal note looks optimistic"). Rep and Manager surfaces share one engine.
- **Scout, end-to-end** — produces a grounded pre-call brief: who the prospect is, where the deal stands, fresh signals to act on, talking points, open risks, and a full activity timeline. Every line traces to a real record.
- **Auditor, end-to-end** (must-have) — reconciles each deal's recorded state (stage, the rep's confidence) against the actual activity and raises **cited flags** where the record is more optimistic than the evidence supports. Computes an "optimism gap" — the pipeline valued at rep confidence vs. at the evidence. A clean deal produces no flags (no crying wolf). Every flag carries its evidence (PRD §10).
- **Forecaster, end-to-end** — "adds it all up to predict the month." Builds directly on the Auditor: rolls each deal's evidence-based confidence into a month forecast and shows the **honest number next to the rep number**, with commit / best-case / pipeline buckets, a per-month pipeline breakdown, and the deals inflating the forecast most. The inflators sum to the Auditor's optimism gap.
- **Sparring Partner, end-to-end** (must-have) — an **interactive, multi-turn** practice partner. It role-plays the prospect, raising objections grounded in that prospect's real persona, deal, and recent messages (Elena gets a leasing/flexibility objection from her husband's question; Ramon, a "don't rush me" from his relationship persona). It scores each answer (acknowledged / addressed / concrete / effort), reacts in character, and ends with a session scorecard. Stateless: recomputed from the transcript each turn.
- **Command bar** — plain-language pull, routed to the right agent ("brief me on Elena" → Scout; "check my pipeline" → Auditor; "forecast the month" → Forecaster; "practice with Elena" → Sparring Partner).
- **Shared data spine** — all agents read the same material through one module, today fed by a **synthetic, sanitized** Ayala Land real-estate data pack (no live PII).
- **Provider-agnostic LLM seam** — agents depend on an `LLMProvider` interface, not a vendor SDK. Runs fully on a deterministic stub with no API key; a real model drops in later.

**All four Phase 1 agents are now live.** The other four (Dispatcher, Analyst, Scribe, Coach — all Phase 2) render on the roster with their push status and are tagged as upcoming.

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
    api/audit/route.ts    POST { repId? } → runs Auditor (omit repId = whole floor)
    api/forecast/route.ts POST { repId? } → runs Forecaster
    api/spar/route.ts     POST { contactId, answers[] } → runs a Sparring session
    api/command/route.ts  POST { text, repId } → command router
  agents/
    types.ts              Roster + run-result types (incl. evidence/provenance)
    registry.ts           The 8-agent roster (PRD §6)
    scout.ts              Scout — pre-call briefs
    auditor.ts            Auditor — deal reconciliation + cited flags (exports auditBook)
    forecaster.ts         Forecaster — month forecast built on the Auditor's confidence
    sparring.ts           Sparring Partner — grounded objections, scoring, scorecard
  lib/
    data/                 The shared data spine (types, synthetic pack, queries)
    llm/provider.ts       Provider-agnostic LLM seam (stub by default)
    command/router.ts     Plain-language → agent routing
    home/viewModel.ts     Builds the roster home view-model + push statuses
    format.ts             Shared PHP/date formatting
  components/             Workspace, AgentCard, CommandBar, ScoutBriefView, AuditReportView…
```

### Key design decisions

- **A layer, not a rebuild.** The CRM stays the system of record. Swapping the synthetic pack for live HubSpot means re-implementing only `lib/data/spine.ts`.
- **Grounded, not generated.** Agent structure (signals, timeline, evidence) is deterministic and cites its sources; only the narrative sentence routes through the LLM seam. This keeps output trustworthy even on the stub.
- **Vendor-undecided by design.** `LLM_PROVIDER` selects the provider; the default `stub` needs no key. See `.env.example`.

## Next slices

Phase 1 is feature-complete (all four MVP agents). Toward Phase 2:

1. Multi-rep data so the manager surface rolls up the whole floor (Auditor/Forecaster already accept an omitted `repId` to cover everyone).
2. Wire a live `LLMProvider` (Anthropic/OpenAI) behind the existing seam — the Sparring Partner's role-play and every agent narrative upgrade with no shape change.
3. Phase 2 agents: Dispatcher, Analyst, Scribe, Coach.
4. Live, governed HubSpot read/write.
