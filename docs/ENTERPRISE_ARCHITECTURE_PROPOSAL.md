# Enterprise Architecture Proposal — Reference Document

> **Status:** Reference only, not adopted. Written by Fable (blank-slate, no
> visibility into Poold's real code) in response to a prompt for "the ideal
> infra/architecture for an extremely flexible, multi-sport, multi-format
> pick'em platform." Reviewed against Poold's actual codebase in a chat
> session on **2026-07-15**. Kept here so the thinking survives past that one
> conversation — the actionable takeaway is **F6 in `docs/BACKLOG.md`**, not
> this document; read that first.
>
> **One-paragraph verdict:** This is the correct design for a platform running
> many sports and formats at real scale (thousands of pools, provider
> failover, corrections, audit requirements). It is not a fit to build now —
> most of it (fact ledger, provider capability registry, correction/
> supersession semantics, event-streaming queue) is machinery Poold doesn't
> need at current scale and would cost months to build and maintain. The part
> worth taking today is the **philosophy** — deterministic, replayable scoring
> and "stale is fine, wrong is not" — and the **one structural gap it exposes**:
> Poold has no shared contract for "a scoring format," so a second format
> would currently be built by copy-pasting `scoring.js`/`tierBuilder.js`
> rather than plugging into an interface. See F6 for the concrete, sized-down
> fix and its trigger condition.

---

## The original proposal (verbatim)

*A blank-slate design for a multi-sport, multi-format social pick'em platform. No money movement, no custody, no settlement — competition state only.*

### 0. Design thesis

Every hard requirement in the brief — structurally different formats, provider heterogeneity, late corrections, rule evolution, persistent per-format state, historical integrity — collapses into one architectural commitment:

> **Scoring is a pure, deterministic function: `standings = fold(ruleset_version, picks, facts)` — where facts live in an append-only ledger and all mutable state is a disposable projection.**

If that holds, corrections are recomputes, duplicates are no-ops, out-of-order delivery is a sort, rule changes are version pins, and format state is always rebuildable. Every section below exists to protect that invariant or to make it fast.

The system is organized into three planes plus a spine:

```
┌─────────────────────────────────────────────────────────────┐
│  INGESTION PLANE          provider adapters, normalization  │
│  (all sport & provider mess lives here)                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ canonical facts
┌──────────────────────────▼──────────────────────────────────┐
│  FACTS LEDGER (the spine)   append-only, versioned,         │
│  idempotent, totally ordered per event                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ fold via format engines
┌──────────────────────────▼──────────────────────────────────┐
│  CONTEST PLANE            pools, picks, format engines,     │
│  scoring workers, standings projections                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ materialized projections
┌──────────────────────────▼──────────────────────────────────┐
│  READ / DELIVERY PLANE    leaderboard reads, realtime push, │
│  cross-pool user history                                    │
└─────────────────────────────────────────────────────────────┘
```

### 1. Domain model

#### 1.1 The two independent dimensions

**Sport** and **format** never touch each other directly. They meet only through two mediating abstractions:

- The **Event Catalog** (sport-shaped, format-agnostic): what real-world things exist to predict on — games, rounds, tournaments, seasons, and the entities inside them (teams, players, markets).
- The **Fact Vocabulary** (typed, sport-parameterized): what resolved truths can exist — `event_outcome`, `player_stat_line`, `prop_resolution`, `standings_snapshot`, `event_status_change`.

A format engine declares which fact types it consumes (its *data contract*). A sport declares which fact types its providers can emit (its *capability attestation*). The intersection of those two sets determines which (sport, format) pairs are offerable. Neither side knows the other's internals. Adding a sport = new catalog entries + adapters emitting existing fact types (or new ones). Adding a format = new engine consuming existing fact types. Neither is a core rewrite.

#### 1.2 Core entities

```
Sport            (id, name, catalog schema hints)
Season           (sport_id, label, start/end)
Event            (season_id, type: game|round|tournament, scheduled_time,
                  status: scheduled|live|final|amended, entities[])
Entity           (event-scoped participants: teams, players, markets)

Provider         (id, name, capability attestations[])
Fact             (id, fact_type, event_id, entity_refs[], payload JSONB,
                  provider_id, provider_seq, version, supersedes_fact_id?,
                  idempotency_key UNIQUE, observed_at, recorded_at)

FormatEngine     (code module, versioned; see §3)
Ruleset          (format_id, version, parameters JSONB, engine_version pin,
                  immutable once referenced)

Pool             (id, name, sport_id, format_id, ruleset_version PIN,
                  season/event scope, visibility, finality_policy)
Membership       (pool_id, user_id, role: commissioner|member, joined_at)
PickWindow       (pool_id, scope ref, opens_at, locks_at)
Pick             (pool_id, user_id, window_id, payload JSONB (per-format
                  schema), submitted_at, immutable after lock)

StateCheckpoint  (pool_id, as_of_fact_cursor, format_state JSONB,
                  engine_version, ruleset_version — disposable)
Standings        (pool_id, projection, as_of_fact_cursor, finality flags
                  — disposable)
```

Two things are load-bearing:

1. **Facts and Picks are the only durable truths.** Checkpoints and standings carry a fact-cursor watermark and can be deleted and rebuilt at any time. This is what makes the system correctable and auditable forever.
2. **Pools pin a ruleset version at creation.** Rulesets are immutable once referenced. A "rule change" is a new version that only new pools can select. A completed 2026 pool replayed in 2029 produces byte-identical standings. Mid-contest retroactive drift is structurally impossible, not just discouraged.

#### 1.3 Facts: the contract in detail

Every fact carries:

- **`fact_type`** — from a governed vocabulary with versioned JSON Schemas. Payloads are validated at the ledger boundary; malformed provider data is quarantined, never ingested.
- **`idempotency_key`** — deterministic hash of `(provider, event, fact_type, entity_refs, provider_seq)`. Duplicate and late redelivery dedupes at insert via unique constraint. Retries are free.
- **`version` / `supersedes_fact_id`** — corrections are new fact versions, never mutations. The "current truth" for any (event, fact_type, entity) is the max version; history is preserved for audit and for explaining amended standings to users.
- **`provider_seq` + `observed_at`** — out-of-order delivery is handled by sorting on provider sequence within the fold, not by hoping the network is polite.

Fact-type governance matters more than it sounds: this vocabulary is the system's real API. It should be reviewed like a public interface — additive changes cheap, breaking changes require a new versioned type.

### 2. Ingestion plane

#### 2.1 Provider adapters

One adapter per (provider, sport). Each adapter:

1. Pulls or receives raw payloads (webhook, poll, or stream — provider's choice, adapter's problem).
2. Archives the **raw payload verbatim** to cold object storage keyed by receipt time. This is the escape hatch for every future bug: if an adapter mis-normalized something last March, you re-run the fixed adapter over archived payloads and emit correction facts. You never lose truth to a normalization bug.
3. Normalizes into canonical facts and writes them to the ledger.
4. Maintains an **entity-mapping table** (provider's IDs → canonical entity IDs). Cross-provider identity resolution is an ingestion-plane problem and never leaks into the core.

Adapters are stateless workers; their only durable state is the mapping table and a per-provider cursor. Any adapter can crash and resume.

#### 2.2 Multi-provider strategy and the capability registry

The **capability registry** records, per (provider, sport, fact_type): supported? at what latency tier? at what reliability grade? This drives three things:

- **Offerability**: a pool cannot offer a contest whose format's data contract isn't attested by at least one provider (or the manual adapter, below). You structurally never accept picks you cannot grade. Prop-creation UIs are *generated* from the attested vocabulary.
- **Failover**: fact types attested by multiple providers get a priority order. If the primary stalls (watchdog on expected-cadence per event type), the secondary's facts are already flowing or can be activated; the ledger's idempotency and versioning make dual-feeding safe — worst case is a superseding version, never a conflict.
- **Cost control**: expensive granular feeds (player props) are only subscribed for sports/markets with active pools demanding them.

#### 2.3 Human adjudication as a first-class provider

A **commissioner-resolution adapter** lets pool commissioners (or staff) resolve propositions through the exact same fact pipeline: same idempotency, same versioning, same correction semantics, plus an audit trail of who resolved what. Consequences:

- Exotic props degrade gracefully to manual resolution instead of being unbuildable.
- Nothing downstream distinguishes human facts from feed facts.
- Disputes are handled by superseding fact versions — the same mechanism as provider corrections.

This one decision converts the brief's sharpest constraint ("providers may not resolve what props need") from a blocker into a latency/UX tier.

#### 2.4 Liveness, not just correctness

Correct-but-stale is survivable; silent stalls are not. Each event in a live window has an expected fact cadence (from the sport's catalog hints). A watchdog alerts on cadence violations and can trigger provider failover. Pools display data freshness ("scores as of 8:42 PM") so staleness is visible, never mistaken for finality.

### 3. Format engines

#### 3.1 The interface — deliberately four methods

```
interface FormatEngine<PickT, StateT> {
  dataContract(): FactType[]                      // what it needs to resolve
  validatePick(pick: PickT, state: StateT,
               window: PickWindow): Result        // structural + stateful rules
  reduce(state: StateT, facts: Fact[],
         picks: Pick[], ruleset: Ruleset): StateT // the fold step — pure
  projectStandings(state: StateT): Leaderboard    // what the core renders
}
```

`reduce` must be **pure and deterministic**: no clocks, no I/O, no randomness, ruleset parameters passed in. This is enforced by construction (engines run in a sandboxed worker context with no ambient capabilities) and by test (§9). Purity is what makes replay, correction, and audit trivially correct.

#### 3.2 How each format maps — the five axes, held independently

| Axis | Pick'em | Survivor | Season | Props |
|---|---|---|---|---|
| **Pick cadence** | per event | per round | once (or draft) | many per event |
| **Prediction type** | discrete outcome | discrete + no-reuse constraint | allocation held over time | outcome / magnitude / boolean |
| **Cross-event state** | none (StateT = ∅) | alive-set + used-pick history | cumulative standings, locked picks | none per prop |
| **Scoring model** | binary or confidence-weighted | elimination | cumulative fold over snapshots | per-prop grading incl. closeness |
| **Data contract** | `event_outcome` | `event_outcome` | `standings_snapshot`, `event_outcome` | `prop_resolution`, `player_stat_line` |

The design points worth noticing:

- **Statelessness is the degenerate case, not a special case.** Pick'em's `StateT` is the empty struct. Survivor and season use the same machinery with non-empty state. There is no `if (format.hasState)` branch anywhere in the core.
- **Pick cadence lives in the core, driven by catalog + engine metadata**, not inside engines. The core opens/locks PickWindows from event schedules; the engine only declares its window pattern (per-event, per-round, per-season, per-market). Lock enforcement — the integrity rule that picks are immutable after lock and invisible to other members before it — is core policy, identical for every format.
- **Confidence/weighted variants are ruleset parameters** of the pick'em engine, not new engines. Engines are structural; rulesets are parametric. This is the discipline that stops engine proliferation.

#### 3.3 State checkpoints and the ordering invariant

Format state is checkpointed after each fold batch with its fact-cursor watermark. Checkpoints are pure derivatives — corrupt or suspect state is fixed by deleting the checkpoint and replaying from the ledger (or from the last trusted checkpoint).

One genuine operational invariant falls out of `validatePick` needing current state: **a pick window may not open until the pool's state projection has caught up to all facts from the prior window's scope.** Concretely: survivor round N+1 picks cannot open until round N's eliminations are folded — otherwise an eliminated member could pick, or a member could reuse a team the state hadn't yet recorded. This is enforced as a hard gate in the window scheduler (window opens only when `checkpoint.cursor ≥ scope watermark`), with alerting when a gate holds a window past its scheduled open. This is the one place where the "stale is fine" philosophy does *not* apply, and it's named explicitly so nobody discovers it in production.

#### 3.4 Engine versioning

Engines are versioned code; rulesets pin an engine version. Old engine versions stay loadable for as long as any pool references them (in practice: engines are small pure modules, keeping N versions alive is cheap). A bug fix that changes scoring behavior is a *new* engine version — existing pools keep the pinned behavior unless a deliberate, logged, pool-visible migration is run. Determinism-over-time beats cleverness here.

### 4. Scoring pipeline

#### 4.1 Flow

```
fact inserted → outbox event → router (which pools subscribe to this
event/fact_type?) → per-pool scoring tasks → engine.reduce →
checkpoint + standings projection → realtime push
```

- **Transactional outbox** on the facts table guarantees no fact is ever ingested-but-unscored. The router consumes the outbox with at-least-once delivery; idempotency comes from fold determinism plus cursor watermarks (re-delivering facts below a pool's cursor is a no-op).
- **Subscription index** (event_id, fact_type → pool_ids) makes fan-out O(interested pools), not O(all pools).
- **Partitioning**: scoring tasks are keyed by pool_id — all facts for one pool fold serially (correctness), different pools fold in parallel (throughput). An NFL Sunday with 14 concurrent games and 50k active pools is embarrassingly parallel by construction.

#### 4.2 Corrections and finality

A superseding fact version triggers recompute for subscribed pools — mechanically identical to normal scoring, replaying from the last checkpoint at or before the corrected fact's position. The interesting design is *social*, handled by a per-pool **finality policy**:

- **Settlement window** (e.g., 48h after event final, configurable per sport — stat corrections have known windows): corrections recompute and update standings silently.
- **Post-finality**: the recompute still runs — truth is truth — but standings are flagged **amended**, the pool is notified, and the pre-amendment standings remain viewable. The system never silently un-wins someone's pool; it also never knowingly displays wrong results.
- For elimination formats, post-finality corrections that would *un-eliminate* someone get commissioner discretion (reinstate vs. honor-the-result), expressed as a commissioner fact — again, same pipeline.

#### 4.3 What "correct under provider chaos" means, precisely

- **Duplicates** → dropped at insert (idempotency key).
- **Out-of-order** → sorted by provider_seq inside the fold batch; facts arriving below a cursor trigger a bounded replay from the nearest checkpoint.
- **Late** → same as a correction: replay from checkpoint.
- **Conflicting providers** → capability-registry priority decides the winning version; the losing fact is retained, superseded, and auditable.
- **Provider outage mid-event** → facts stall, standings go visibly stale (freshness UI), watchdog fires, failover provider activates, ledger dedupes the overlap. Users see delay, never corruption.

### 5. Read & delivery plane

- **Standings projections** are materialized per pool, updated by the fold, versioned by fact-cursor. Leaderboard reads never touch scoring or the ledger — they hit the projection (cache-fronted). The read path's worst failure mode is *stale*, never *wrong* — the only acceptable failure mode for a leaderboard.
- **Realtime**: WebSocket/SSE push keyed by pool_id, fed by projection-update events. Clients also poll-on-focus as a fallback; realtime is an enhancement, not a correctness dependency.
- **Cross-pool user history** is its own projection keyed by user_id, built from the same fold outputs (each fold emits per-member deltas). It's denormalized and eventually consistent by design — a user's lifetime record does not need to be transactionally coupled to live scoring.
- **Multi-tenancy**: pool_id partitions every contest-plane table; row-level security enforces membership at the query layer as defense in depth on top of application checks. Cross-pool views only ever read the user-history projection, never other pools' internals.

### 6. Concrete stack

Chosen for the "lightweight, low-maintenance, minimal moving parts" goal — boring where boring wins, with clear upgrade paths where scale might demand them.

| Layer | Choice | Why |
|---|---|---|
| Primary store | **PostgreSQL** (facts, picks, pools, projections; JSONB payloads + schema validation at boundary) | One database covers ledger, OLTP, and projections at this scale. Declarative partitioning on facts (by month) and contest tables (by pool hash). RLS for tenancy. |
| Queue / outbox | **Postgres-backed job queue** (e.g., transactional outbox + SKIP LOCKED workers) | At-least-once, transactional with fact inserts, zero extra infrastructure. Swap to Kafka/Redpanda only if fan-out throughput demonstrably demands it — the ledger schema doesn't change either way. |
| Services | **Single deployable modular monolith** (API, router, scoring workers, adapters as separate processes of one codebase) | Format engines and adapters are module boundaries, not network boundaries. Extract adapters or scoring to separate deployments *when scaling pressure is measured*, not speculatively. |
| Language | TypeScript or Go throughout; engines as pure sandboxed modules | Shared types between pick schemas, fact schemas, and client. |
| Cache / realtime | **Redis** (projection cache, pub/sub for push) | The one piece of non-Postgres infra that earns its keep on day one. |
| Raw archive | **Object storage (S3-class)** | Verbatim provider payloads, cheap, append-only. |
| Delivery | CDN-fronted API; SSE/WS for live pools | |
| Infra | Containers on a managed platform (ECS/Fly/Cloud Run tier); IaC from day one | Ops load stays near zero until scale forces choices. |

The deliberate bet: **Postgres-as-ledger over event-streaming infra.** The fold model is what matters; the transport is swappable. A fact table with an outbox gives every semantic guarantee Kafka would, at this scale, with one moving part instead of five. The schema and the engine interface are transport-agnostic, so this is a reversible decision — the rare kind worth taking cheaply.

### 7. Scaling analysis

**Read path** (dominant load): leaderboards are cache-fronted projections; scales with Redis + read replicas essentially indefinitely.

**Write path**: fact volume is bounded by real-world sport, not by users — a full NFL slate at player-stat granularity is thousands of facts/hour, trivial. Fan-out (facts × subscribed pools) is the real multiplier; it's bounded by the subscription index and parallel per-pool workers. At ~10⁵ active pools on a peak Sunday with prop-heavy formats, the Postgres queue is still comfortable; past ~10⁶–10⁷ fold tasks/hour, promote the outbox consumer to a streaming platform — a contained change behind the router interface.

**Growth by dimension**:
- **New sport** → catalog entries + one adapter + capability attestation. Zero core changes.
- **New format** → one engine module + ruleset schema + pick-payload schema. Zero core changes.
- **New provider** → one adapter + registry rows. Zero core changes.
- **Hot pool** (a 10k-member public-ish pool later): per-pool serial folding is the ceiling; it's a generous one (folds are microseconds of pure computation), and sharding a single pool's fold by member is possible inside the engine contract if ever needed.

### 8. Failure-mode walkthrough

| Failure | Impact | Recovery |
|---|---|---|
| Provider outage mid-event | Standings stale, visibly timestamped | Watchdog → failover provider; ledger dedupes overlap |
| Scoring worker crash mid-fold | That pool's standings stale | Resume from checkpoint cursor; at-least-once redelivery; fold determinism makes reprocessing safe |
| Bad adapter deploy (mis-normalized facts) | Wrong facts in ledger | Re-run fixed adapter over raw archive → superseding correction facts → recompute. Nothing lost. |
| Postgres primary failover | Brief write pause; reads keep serving from cache/replicas | Managed HA; outbox guarantees no ingested-unscored gaps |
| Redis loss | Realtime push down, cache cold | Clients poll-on-focus; projections rebuild cache; no data loss possible (Redis holds no truth) |
| Engine bug discovered post-season | Historical pools scored wrong | New engine version; deliberate, logged, pool-notified recompute — or preserved as-was per policy. The *choice* exists because replay exists. |

Single point of failure honestly named: **Postgres**. That is a deliberate consolidation — one excellent, well-understood, HA-configured SPOF beats five mediocre ones. Everything else in the system is stateless or disposable.

### 9. Correctness engineering

- **Property-based tests per engine**: fold determinism (same inputs ⇒ identical state, across shuffled fact arrival orders below the sort), no-reuse invariants for survivor, monotonic elimination (nobody un-eliminates without a correction fact), standings conservation for season.
- **Golden replay suite**: recorded real seasons replayed through each engine version in CI; any diff in historical standings fails the build. This is the regression net that makes "keep historical pools correct forever" a tested property, not a hope.
- **Chaos harness for ingestion**: synthetic provider that duplicates, reorders, delays, and corrects facts; asserts final standings match the clean-feed run.
- **Ledger audit job**: continuously verifies projections match a fresh fold on sampled pools; drift pages someone.

### 10. Sequencing

1. **Foundation** — ledger + outbox, catalog, one sport adapter, pick'em engine, pools/picks/windows, projections. (The full spine, thinnest slice.)
2. **Stateful formats** — survivor, then season; checkpointing, window-gating invariant, replay tooling. This is where the fold model earns or loses its keep — do it second, not last.
3. **Corrections & finality** — supersession, amended standings UX, commissioner facts.
4. **Props** — capability registry, granular feeds, commissioner-resolution adapter, generated prop creation.
5. **Second sport + second provider** — proves both extension axes with real friction, before habits calcify.
6. **Scale hardening** — measured, not speculative: cache tuning, queue promotion if warranted, read replicas.

### 11. Where this design could be lying to me

Adversarial pass, per the brief:

1. **"Everything is a discrete fact" strains at continuous formats.** Season scoring against evolving standings works via `standings_snapshot` facts, but snapshot cadence is now a correctness-adjacent design parameter: too coarse and season scoring is lumpy; too fine and slow sports generate noise. Mitigation: cadence is a per-(sport, event-type) catalog setting, and season engines score against *final-per-scoring-period* snapshots by contract, making cadence a UX knob rather than a scoring input. But the tension is real and should be revisited when the first leaderboard-style sport (golf) ships.
2. **The pick-window gate is a hidden availability dependency.** §3.3's invariant means a stalled fold can delay opening survivor picks. That's the correct trade (integrity over availability for pick validity), but it converts "scoring is async and relaxed" into "scoring has a deadline before every window" — an SLO that must be monitored explicitly.
3. **The four-method engine interface will be pressured to grow.** Draft-style season pools (turn-taking, exclusivity across members) push on `validatePick` needing *other members'* in-flight actions — a coordination shape the interface doesn't cleanly express. Likely resolution: drafts are a *pick-acquisition protocol* in the core (like windows), not engine logic. Flagging it now so the fifth method fight happens deliberately.
4. **Entity mapping is the unglamorous failure reservoir.** Cross-provider player-identity resolution is where silent wrongness enters (wrong player's stat line grades a prop). Mitigation: mapping-confidence scores, human review queue for low-confidence links, and the raw archive for retroactive repair — but this deserves ongoing ownership, not a one-time build.
5. **No-money constraint, guarded structurally.** There is no value ledger anywhere in this design, and there must never be — including "convenience" features like entry-fee IOU tracking or side-bet tallies, which reintroduce custody-adjacent and regulatory exposure through the back door. Recommended as a standing architectural review checklist item, not a one-time decision.
6. **The monolith bet assumes team shape.** Modular monolith is right for a small team; if adapter development is ever outsourced or parallelized across teams, extract the ingestion plane first — it has the cleanest seam (facts in, nothing out).

### Appendix A — Worked example: one Sunday, one survivor pool

1. 1:00 PM games kick off. Provider webhooks land; adapters archive raw, emit `event_status_change(live)` and periodic `event_outcome` candidates; final whistles emit `event_outcome` facts.
2. Outbox → router: subscription index says pool #4471 (survivor, NFL, week 7) subscribes to 8 of today's events.
3. Pool-4471 fold task: sorts new facts by provider_seq, loads checkpoint (state: 9 members alive, used-pick sets), runs survivor `reduce` — two members picked losers, state marks them eliminated, standings project 7 alive.
4. Checkpoint + projection written with cursor; Redis pub/sub pushes the update; members' apps update live.
5. Tuesday: a stat correction flips one Sunday game's outcome (rare but real). Superseding fact lands; pool is inside its 48h settlement window → silent recompute reinstates one member, standings update, freshness note shows the amendment source.
6. Wednesday: week 8 window is gated until the week-7 fold cursor covers all week-7 finals — then opens; eliminated members' pick UI is read-only; alive members can't select teams in their used-pick set (validatePick against current state).

Every step above is either an idempotent insert or a deterministic fold — nothing in the happy path or the correction path required special-case machinery.

---

## Review findings (2026-07-15 chat session)

**What Poold already has that mirrors this design, at a much smaller scale:**
- Per-schema sport isolation (`public` core + `golf` schema) ≈ the proposal's sport/format separation. Verified sound for adding a second *sport* — additive, not a rewrite.
- `golf.leaderboard_cache` (append-only, timestamped rows) ≈ a snapshot-shaped facts ledger — arguably the *correct* native shape for golf specifically, which the proposal's own §11.1 flags as its weakest fit ("continuous"/leaderboard-style sports strain the discrete-fact model).
- `src/utils/playerMatch.js` (layered name resolution, refuses ambiguous matches rather than guessing) independently arrived at the same answer as §11.4 ("entity mapping is the unglamorous failure reservoir").
- `computeScores` in `src/utils/scoring.js` is already a pure, deterministic fold of `(picks, leaderboard snapshot, scores_to_keep)` — the proposal's central invariant (§0), just unnamed and untested.
- `public.pool_standings` (scaffolded, unwired — see BACKLOG F1) is exactly the proposal's "standings projection" read plane, already half-built.

**What's genuinely missing, and the one gap worth closing proactively:** no shared **format contract**. `scoring.js` and `tierBuilder.js` encode "golf" and "pick'em-style scoring" as one inseparable unit. A second *format* (survivor, season-long, props — even still within golf) has nothing to plug into and would be built by copying and diverging those two files. Tracked as **F6** in `docs/BACKLOG.md`, with a trigger condition (format #2, not pool count or sport count) and a sized-down fix (a 4-ish-method interface extracted from existing code, not the full ledger/outbox/registry machinery above).

**What should NOT be built now:** the fact ledger, idempotency keys, provider capability registry, correction/supersession semantics, watchdog/failover, Redis, object storage, event queue. All of it is real and correct for a platform running many sports/providers/formats at real scale — none of it is earned by Poold's current traffic. Revisit if/when: multiple live data providers per sport are needed, corrections to historical scores become a recurring real event (not hypothetical), or fan-out load is actually measured to strain client-side/Postgres-only computation.
