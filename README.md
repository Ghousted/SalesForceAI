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
- **Provider-agnostic LLM seam with per-agent models** — agents depend on an `LLMProvider` interface, not a vendor SDK. Ships with a deterministic **stub** (zero infrastructure) and a **llama.cpp** adapter. Each agent is matched to the best open-source model for its job, **hot-swappable via [llama-swap](https://github.com/mostlygeek/llama-swap)** — no agent code changes. If the model server is down, agents fall back to grounded text so the platform never breaks.

**All four Phase 1 agents are now live.** The other four (Dispatcher, Analyst, Scribe, Coach — all Phase 2) render on the roster with their push status and are tagged as upcoming.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

- `/` — Rep workspace
- `/manager` — Manager workspace

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`.

By default (`LLM_PROVIDER=stub`) it runs with **no model server** — the stub returns grounded text. To run with real local models, see below.

## Running with local models (llama.cpp, per-agent hot-swap)

Each agent uses the best open-source model for its job, loaded on demand via [llama-swap](https://github.com/mostlygeek/llama-swap) (one OpenAI-compatible endpoint that swaps GGUFs by model name):

| Agent | Tier | Default model | Why |
|---|---|---|---|
| Scout | worker | `qwen2.5-7b-instruct` | Fast, grounded summarization into a brief |
| Forecaster | worker | `qwen2.5-7b-instruct` | Short, faithful numeric digest (cold sampling) |
| Auditor | mid | `qwen2.5-14b-instruct` | Flag accuracy is the trust currency — stronger reasoning over evidence |
| Sparring Partner | **brain** | `qwen2.5-32b-instruct` | Interactive role-play & persona — the brain, warmer sampling |

```bash
# 1. Serve the models (edit GGUF paths/quants in infra/llama-swap.yaml first)
llama-swap --config infra/llama-swap.yaml --listen :8080

# 2. Point Sales OS at it
echo "LLM_PROVIDER=llamacpp" >> .env.local
echo "LLAMACPP_BASE_URL=http://localhost:8080/v1" >> .env.local
npm run dev
```

Inspect the live mapping at **`GET /api/models`**. Swapping an agent's model is pure config — change a tier in `.env` (`MODEL_WORKER`, `MODEL_MID`, `MODEL_BRAIN`, …) or the per-agent tier in `src/lib/llm/models.ts`; no agent code changes. If the server is unreachable, agents fall back to grounded text so a demo never breaks. Downshift quants/models to fit your VRAM — the mapping is unchanged.

### Low-RAM machines (≈8 GB): single model, no swap

llama-swap only keeps one model resident, so on ~8 GB you can't run the full ladder. Run **one** `llama-server` with a small model and point every tier at it (`.env.local` already does this). The easy path:

```bash
brew install llama.cpp     # one-time: provides llama-server (Metal-accelerated)
npm run model              # downloads Qwen2.5-3B (once) + serves it on :8080
# in another terminal:
npm run dev
```

`npm run model` (see `scripts/model.sh`) downloads the GGUF on first run and is idempotent — if a server is already healthy on `:8080` it no-ops. Override defaults via env: `MODEL_FILE`, `MODEL_URL`, `PORT`, `CTX`, `NGL`.

> **Why not `llama-server -hf …`?** llama.cpp's built-in Hugging Face downloader currently **hangs** on HF's Xet/CAS storage backend (0 bytes, no error). The script fetches the GGUF with `curl` and launches with `-m` instead.

A single `llama-server` ignores the per-request model name and serves whatever's loaded, so all four agents use the one 3B. Move to a bigger box → switch to llama-swap and point the tiers at different models; no code changes.

## Automation (action spine + Dispatcher)

Agents don't just report — they propose actions that, with approval, write to the CRM. The spine (`src/lib/actions/`) is agent-agnostic:

- **Queue** — every proposed action lands in `src/lib/actions/store.ts`; the header **Inbox** is the approval UI.
- **Policy** (`policy.ts`) — per-agent autonomy: `ask` (propose → one-tap approve, default) or `auto` (act without asking, e.g. `AUTONOMY_DISPATCHER=auto`). External sends (`send-email`) are always `ask` — *the human owns the close*.
- **Executor + gated writes** (`executor.ts`, `src/lib/data/writes.ts`) — approved actions run against HubSpot (live) or the in-memory pack (synthetic); failures are captured on the action, never crash.

Two automated agents ship on the spine:
- **Dispatcher** — finds unassigned leads, scores + routes each to the least-loaded rep, queues an `assign-owner` action. Approving sets the contact's owner in HubSpot (needs `crm.objects.contacts.write`).
- **Scribe** — drafts a follow-up email grounded in the prospect's last interaction, queues a `send-email` action (always gated). Approving **logs the email to the HubSpot timeline** (needs `crm.objects.emails.write`); it does *not* transmit — wiring a connected inbox for real send is a deliberate later step.

## Live data (HubSpot, read-only)

The app defaults to the synthetic pack. To run against a live HubSpot CRM:

1. In HubSpot, create a **Private App** with read scopes: `crm.objects.contacts.read`, `crm.objects.companies.read`, `crm.objects.deals.read`, `crm.objects.owners.read`, plus the activity scopes (`sales-email-read` and calls/meetings/notes read).
2. Set env:

```bash
DATA_SOURCE=hubspot
HUBSPOT_ACCESS_TOKEN=pat-xxxxxxxx
# SALESOS_REP_ID=<owner id>   # optional; defaults to the first owner
```

Only the **data layer** changes — `src/lib/data/hubspot.ts` maps HubSpot owners/companies/contacts/deals/activities into the same `CrmSnapshot` the agents already read, so Scout, Auditor, Forecaster and the Sparring Partner work unchanged. The snapshot is fetched on demand and cached (`DATA_TTL_MS`, default 60 s). It's **read-only** — writes stay out (agents propose, humans approve). If the token is missing or a fetch fails, the spine logs it and falls back to synthetic so the app never hard-stops. Two optional custom contact/deal properties enrich the mapping if present: `salesos_persona` (contact) and `salesos_property` (deal); otherwise sensible fallbacks are used.

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
    data/spine.ts         Shared data spine: sync queries + async ensureSnapshot() cache
    data/source.ts        Source selection (synthetic | hubspot)
    data/synthetic.ts     The sanitized Ayala Land pack
    data/hubspot.ts       HubSpot v3 read adapter → CrmSnapshot (read-only)
    llm/provider.ts       LLM seam: stub + llama.cpp adapter (per-agent models)
    llm/models.ts         Per-agent model assignment (hot-swap tiers)
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
2. Phase 2 agents: Dispatcher, Analyst, Scribe, Coach.
3. Gated HubSpot **writes** (Scribe sends, deal-stage corrections) — agent proposes, human approves, with an audit trail.
