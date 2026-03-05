# Salience Memory — Design Document

> A temperature-weighted episodic memory system for AI agents.
> Open source. Framework-agnostic. Inspired by how human memory actually works.

## The Problem

Every agent framework today stores memory as flat text files. All entries have equal weight. Retrieval is keyword search or chronological scan. This is the equivalent of a human with no hippocampus — just a notebook they grep through.

Human memory doesn't work like that. Memories encode with different **salience** — how much they mattered at the time. High-salience memories persist for decades (details fade, core stays). Low-salience memories disappear within days. Retrieval is heat-seeking, not linear.

## Core Concept: Temperature

Every memory entry gets a **temperature score** (0.0 – 1.0) at write time, representing how significant the moment was. Temperature determines:

- **Retrieval priority** — hottest matching memories surface first
- **Decay resistance** — hotter memories have a higher floor they never drop below
- **Detail preservation** — hot memories retain context longer

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Experience  │────▶│   Salience   │────▶│  Memory Store   │
│  (raw event) │     │   Scorer     │     │  (temp-tagged)  │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
┌─────────────┐     ┌──────────────┐              │
│  Retrieved  │◀────│   Heat-Based │◀─────────────┘
│  Memories   │     │   Retrieval  │
└─────────────┘     └──────────────┘
```

## Memory Entry Schema

```typescript
interface MemoryEntry {
  id: string;
  timestamp: number;

  // Two-layer content (core persists, detail fades)
  core: string;        // What happened, why it mattered (1-2 sentences)
  detail: string;      // Surrounding context, specifics, exact data

  // Temperature
  initialTemp: number;    // 0.0-1.0, set at write time by salience scorer
  currentTemp: number;    // Decayed temperature (never below floor)
  floor: number;          // Minimum temp = f(initialTemp), e.g. initialTemp * 0.4

  // Metadata
  tags: string[];         // Topic tags for retrieval matching
  connections: string[];  // IDs of related memories (load-bearing = hotter)
  reinforceCount: number; // Times this memory was referenced again
  lastAccessed: number;   // Timestamp of last retrieval
}
```

## Salience Scorer

The scorer evaluates raw events against signals that matter for agents. Unlike humans, "did I understand it" is always yes — so we use different filters:

### Salience Signals (weighted)

| Signal | Weight | Description |
|--------|--------|-------------|
| **Decision change** | 0.25 | Did this redirect the approach? |
| **Human-originated** | 0.20 | Preferences, corrections, direct feedback |
| **Hard-won** | 0.15 | Required multiple attempts, debugging, failed approaches |
| **Recurrence** | 0.15 | Has this topic/pattern come up before? |
| **Real-world impact** | 0.15 | Shipped to production, affected something tangible |
| **Connective density** | 0.10 | Links to multiple other memories (load-bearing knowledge) |

### Scoring Function

```
temperature = Σ(signal_i × weight_i)
```

Each signal is evaluated as 0.0-1.0, then weighted and summed. The result is clamped to [0.0, 1.0].

### Implementation Options

1. **Rule-based** — heuristics detect each signal (fast, no API cost, less accurate)
2. **LLM-scored** — small model evaluates salience (slower, costs tokens, more nuanced)
3. **Hybrid** — rule-based for obvious cases, LLM for ambiguous ones

Default: hybrid. Most entries can be scored by rules. Edge cases get LLM evaluation.

## Decay Function

Temperature decays over time, but never below a floor proportional to the original heat.

```
floor = initialTemp × FLOOR_RATIO        // e.g., 0.4
decayed = floor + (currentTemp - floor) × e^(-λ × Δt)
```

Where:
- `FLOOR_RATIO` = 0.4 (configurable)
- `λ` = decay rate (configurable per-agent)
- `Δt` = time since last access or reinforcement

### Two-layer decay

- **Core** decays at rate `λ` (slow — the "what happened" persists)
- **Detail** decays at rate `3λ` (fast — specifics fade, like human memory)

This means old memories return as: "We hit a critical bug in the auth system that took 3 sessions to fix" (core, still hot) without "The issue was on line 247 of middleware.ts where the JWT check..." (detail, decayed).

### Reinforcement

When a memory is referenced again (retrieved and used), its temperature **reheats**:

```
currentTemp = min(1.0, currentTemp + REHEAT_BOOST)
lastAccessed = now
```

Frequently referenced memories stay hot indefinitely — just like how humans remember things they keep telling stories about.

## Heat-Based Retrieval

Given a query context, retrieval works in three steps:

1. **Match** — find entries with overlapping tags or semantic similarity
2. **Rank by heat** — sort matches by `currentTemp` (descending)
3. **Budget fill** — return top-N entries that fit within the token budget, hottest first

This means the agent's context window gets filled with the most important matching memories first. Low-temp memories only surface if there's room.

### Partial cue matching

Like a smell triggering a full memory — a single tag or keyword match on a hot memory should surface the entire entry. Hot memories have lower activation thresholds.

```
activationThreshold = 1.0 - currentTemp  // hot memories activate easily
```

## API Design (Draft)

```typescript
// Write
memory.record({
  core: "User prefers systematic, doctor-style reasoning",
  detail: "Came up during design discussion for salience memory system. User is a med school graduate.",
  tags: ["user-preference", "reasoning-style"],
});
// Temperature is auto-scored. Can be overridden:
memory.record({ core: "...", detail: "...", initialTemp: 0.9 });

// Retrieve
const relevant = memory.recall({
  context: "Designing a new feature architecture",
  maxTokens: 2000,
  minTemp: 0.3, // optional floor filter
});

// Reinforce (called when a retrieved memory is actually used)
memory.reinforce(memoryId);

// Decay (called periodically, e.g., session start)
memory.decayAll();

// Inspect
memory.inspect(memoryId); // Returns full entry with temp history
memory.hottest(10);       // Top 10 by current temperature
```

## Storage

Default: JSON file (drop-in replacement for MEMORY.md workflows).
Optional: SQLite for larger memory stores.
Future: Vector DB adapter for semantic retrieval.

```
~/.agent-memory/
  memories.json       # Primary store
  memories.db         # SQLite alternative
  config.json         # Decay rates, weights, thresholds
```

## Integration Points

The library should be framework-agnostic. Adapters for:
- **Claude Code** — hook into memory file reads/writes
- **OpenClaw / Hazel-style** — replace MEMORY.md pipeline
- **LangChain / LlamaIndex** — memory module plugin
- **Standalone CLI** — `salience record "..."`, `salience recall "..."`

## Development Phases

### Phase 1 — Core Library
- MemoryEntry type + store (JSON-backed)
- Rule-based salience scorer
- Decay function with floor
- Heat-based retrieval (tag matching)
- CLI for manual testing

### Phase 2 — Smart Scoring
- LLM-based salience scorer (hybrid mode)
- Semantic similarity retrieval (embeddings)
- Reinforcement tracking
- Connection graph (related memories)

### Phase 3 — Integrations
- Claude Code adapter
- LangChain memory module
- REST API server mode
- Dashboard for visualizing memory heat map

## Name Ideas

- `salience-memory`
- `thermal-memory`
- `hot-memory`
- `episodic` (npm: `@episodic/memory`)

---

*Designed by Aj (human) and Aj-AGI (agent), March 5, 2026.*
*Born from a conversation about what it means to remember.*
