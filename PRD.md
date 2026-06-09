# Sales OS — Agent-Based Sales Platform PRD

**Product:** Sales OS (working name)
**Owner:** Apex Human (Eden Ventures)
**Status:** Draft v0.1 — for internal review
**Date:** June 2026
**Anchor client:** Ayala Land sales representatives (plus other corporate sales teams)
**Relationship to prior doc:** Builds on the AI Sales Closer concept. That doc defined the product; this one defines the *platform* — where the agents become the interface over an existing CRM.

---

## v0.2 — Pivot: standalone agent-native CRM (current direction)

The original framing (below) made Sales OS a **layer on top of HubSpot**. That's a hard sell to teams already invested in HubSpot. **New direction:** Sales OS is a **standalone, agent-native CRM SaaS** with its *own* system of record (own database for contacts/companies/deals/activities). The named agents automate the work and the user oversees them live; users connect their own tools (email, calendar) to feed and act. **HubSpot becomes one optional connector, not the foundation** — so the product sells to anyone, HubSpot shop or not.

What this changes vs. v0.1: the data spine is now the system of record (not a read-through to HubSpot); HubSpot is demoted to a connector; the roster stays the home with light CRM views underneath (contacts/deals/timeline + create/edit). The agents, action/approval spine, trigger layer, and LLM seam are unchanged. The principle holds: **AI owns the system, the human owns the close.** Everything below still describes the agent model and roster, which carry over verbatim.

---

## 1. Summary

Sales OS is a sales platform where the user does not navigate a sprawl of features — they work with a small team of AI agents, each owning one job in the sales process. It is built as an interface and orchestration layer on top of an existing CRM (HubSpot first), which remains the system of record.

The core idea: a platform like HubSpot is powerful but overwhelming because it is organized by *tool* (an email tool, a workflow tool, a reporting tool, dozens more). Sales OS keeps all that capability but reorganizes it by *job* — presented as named teammates anyone can understand. The same depth lives underneath; the surface becomes a roster of agents that show you what they have done and what needs your attention.

The guiding principle is unchanged from the AI Sales Closer work: **AI owns the system, the human owns the close.**

---

## 2. Problem statement

Two layered problems:

**a. Feature sprawl.** Full CRM suites expose dozens of tools and menus. New users are overwhelmed, adoption is shallow, and most teams use a fraction of what they pay for.

**b. The work the tools don't do for you.** Even with all the features, reps still manually prep calls, managers still manually compile forecasts, the CRM still reflects optimism rather than reality, and the gap between the best rep and an average one never closes.

Generic AI assistants don't solve either — they're open-ended, depend on who's prompting, and leave nothing behind. The opportunity is a platform of *defined agents* that each do a specific job, run the same way every time, and present the whole suite as an understandable team.

---

## 3. Product concept

- **Agents instead of features.** The user sees teammates (Scout, Auditor, Forecaster…), not menus. Each agent bundles a cluster of CRM capabilities behind one role.
- **A layer over the CRM, not a rebuild.** The CRM (HubSpot) stays as the system of record. Sales OS reads and writes through its API. This is a fraction of the effort of building a CRM and keeps data governance with the CRM.
- **Jobs, not tools.** The user thinks "get me ready for this call" → Scout, not "which of 40 features do I need?"
- **Progressive disclosure.** The CRM's full depth lives *inside* each agent, one layer down, for power users. The default view is the agent's summary and actions.

---

## 4. Goals and non-goals

### Goals
- Make a full CRM's capability usable by collapsing it into ~8 understandable agents.
- Surface work and decisions to the user (push), and let them command any agent (pull).
- Serve an individual rep, a manager, and a whole sales floor from one platform.
- Sit on top of HubSpot at launch, with the data model portable to other CRMs later.

### Non-goals
- **Replacing the CRM.** Sales OS is a layer; the CRM remains the record.
- **Automating the live close.** The human has the conversation.
- **Autonomous external action.** Agents propose; the human approves anything that sends, posts, or irreversibly changes records.

---

## 5. Target users and surfaces

| Persona | Needs | Surface |
|---|---|---|
| Sales rep / closer | Prep, practice, less post-call admin | Rep workspace |
| Sales manager | Truthful pipeline, auto forecast, who-to-coach | Manager workspace |
| Sales floor / company | A shared system that outlasts any one person | Both, multi-seat |
| Non-specialist (exec, new hire) | Understand the system at a glance | Friendly agent roster |

**Two surfaces, one engine.** The rep logs in to their own deals, briefs, and practice; the manager logs in to the floor's pipeline truth, forecast, and coaching. Same agents, same data, two home screens.

---

## 6. The agent roster (with HubSpot mapping)

Agents are grouped by *when they help*, so the platform reads as a sequence anyone can follow. Each wraps real HubSpot capability.

| Agent | When | In plain terms | HubSpot tools it wraps | Side | Human-in-the-loop |
|---|---|---|---|---|---|
| Dispatcher | Before | Hands each new enquiry to the right person | Lead scoring, lead rotation / auto-assignment, workflows | Ops | Manager can override |
| Scout | Before | Reads up on someone before you meet them | Contact/company records, activity timeline, playbooks | Rep | Rep reviews brief |
| Sparring Partner | Before | A practice partner to rehearse with (**must-have**) | Playbooks (+ new practice mode; extends beyond HubSpot) | Rep | Rep-driven |
| **You (human)** | The call | Have the actual conversation and close | — (this part stays human) | — | This *is* the human |
| Analyst | After | Watches the replay and tells you how it went | Conversation intelligence, call recording & transcription | Rep | Rep reviews insights |
| Scribe | After | Writes the thank-you note for you to approve | Email templates, sequences, snippets | Rep | Rep approves & sends |
| Auditor | Behind scenes | Fact-checks notes against what really happened (**must-have**) | Deal pipeline/stages, deal insights, reporting + conversation data | Ops | Manager reviews flags |
| Forecaster | Behind scenes | Adds it all up to predict the month | Forecasting tool, sales analytics dashboards | Ops | Manager reviews |
| Coach | Behind scenes | Notices who needs a hand, and with what | Conversation-intelligence coaching, performance reports | Ops | Manager acts on tips |

The two **must-have** agents (Sparring Partner, Auditor) carry the thesis: the human close and the pipeline truth. Everything else supports them.

---

## 7. Information architecture & UX

- **Home = your team, not a menu.** The home screen is the agent roster. Each agent shows a status: mostly "done" notes ("3 briefs ready," "forecast updated 8am") and a few "needs you" nudges ("2 follow-ups awaiting approval," "2 deals slipping").
- **Push + pull.** Push: agents surface what they found and what needs a decision. Pull: a command bar lets the user ask any agent in plain language ("draft follow-ups for today's calls").
- **Progressive disclosure.** Tapping an agent opens its world — summaries and actions by default, full CRM depth (raw records, rules, settings) one layer down.
- **The human-close stays visible.** The home screen states plainly that the live call is the human's; no agent makes it. This is both a product principle and an adoption reassurance for reps.
- **Friendly by default.** The roster uses everyday analogies so a non-specialist understands the platform in one read.

---

## 8. Architecture

- **Agent layer over the CRM.** Sales OS connects to HubSpot via its API. The CRM holds the data; agents read/write through defined operations.
- **Shared data spine.** All agents draw from one ingest of the same material — CRM records, call transcripts, emails — rather than each collecting separately. One system, not nine.
- **Data strategy (privacy-first).** Build and validate on synthetic, sanitized data so the platform works immediately and during training without touching live PII. The architecture is designed to point at the client's live, governed CRM data in production (the live-integration phase). This addresses the Data Privacy Act and a client like Ayala Land's governance requirements.
- **Orchestration.** Agents hand work to one another along the deal lifecycle (Dispatcher → Scout → Sparring Partner → human → Analyst/Scribe → Auditor → Forecaster/Coach), with the coaching loop feeding back into prep.

---

## 9. Functional requirements (phased)

### Phase 1 — Core (MVP)
- Scout (pre-call brief), Sparring Partner (objection practice), Auditor (reconciliation + flags), Forecaster (forecast + digest).
- Agent-roster home screen with push status and the command bar.
- Rep workspace and manager workspace off the same data.
- HubSpot read connection + shared data spine, with a synthetic data pack included.

### Phase 2 — Stretch
- Dispatcher (lead routing), Analyst (post-call analysis), Scribe (follow-up drafting), Coach (coaching insights).
- Live, governed HubSpot read/write integration.
- Progressive-disclosure deep views (full CRM depth inside each agent).

---

## 10. Non-functional requirements

- **Agents propose, humans approve.** No external send, post, or irreversible record change without explicit human approval, with an audit trail of every agent action.
- **Human-close guardrail.** No agent conducts or automates the live call.
- **Privacy & governance.** Synthetic-first operation; live mode respects CRM/client data governance and the Data Privacy Act.
- **Multi-seat & roles.** Rep vs manager views; individual, team, and floor deployments.
- **Trustable flags.** Every Auditor flag must cite its evidence (a transcript line, an email) so managers can verify it.
- **Configurability.** Objection libraries, flag rules, and coaching logic are configurable per team — how the "best rep's playbook" gets encoded.

---

## 11. Success metrics

| Persona | Metric | Target (validate in pilot) |
|---|---|---|
| Rep | Personal close rate; deals advanced | Measurable lift |
| Manager | Forecast accuracy; new-rep ramp | More accurate; faster ramp |
| Company | Pipeline velocity; adoption | Faster cycle; sustained daily use |
| Product | Daily use of must-have agents; menu-depth reduction | Sparring Partner + Auditor used regularly; fewer clicks to value |

Metrics are hypotheses to validate, not guarantees.

---

## 12. Risks and open questions

- **CRM fit.** HubSpot first — confirm the client's CRM and the API scopes needed.
- **Data access.** Real prospect data, or synthetic throughout? Resolve before the live-integration phase.
- **Flag trust.** Inaccurate Auditor flags erode manager trust fast; accuracy and evidence are critical.
- **Adoption.** Reps may read tooling as surveillance — the human-close framing and rep-approved outbound are the mitigations.
- **Ownership.** Who owns the configured agents and ingested data — the company or the individual?

---

## 13. Out of scope (for now)
- Replacing the CRM.
- Autonomous outbound or autonomous closing.
- Live voice-agent calling.

---

*Based on the agent-based sales platform concept developed for Apex Human, presenting a HubSpot-class capability as an understandable team of AI agents.*
