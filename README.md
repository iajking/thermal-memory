# thermal-memory

Temperature-weighted episodic memory for AI agents.

Not all memories are equal. `thermal-memory` scores each memory by **salience** — how much it mattered — and uses that temperature to drive retrieval, decay, and persistence. Hot memories surface first. Cold ones fade. Important ones never fully disappear.

Inspired by how human memory actually works: significance determines what sticks, details fade but core persists, and revisiting a memory keeps it alive.

## Install

```bash
npm install thermal-memory
```

## Quick Start

```typescript
import { ThermalMemory } from "thermal-memory";

const mem = new ThermalMemory();

// Record with auto-scored temperature
mem.record({
  core: "User prefers dark theme across all projects",
  detail: "Mentioned during UI review, consistent across 3 sessions",
  tags: ["preference", "ui"],
});

// Record with explicit temperature
mem.record({
  core: "Auth system was completely rewritten",
  detail: "Switched from session-based to JWT. Took 4 sessions to debug.",
  tags: ["architecture", "auth"],
  initialTemp: 0.9,
});

// Retrieve by relevance × heat
const relevant = mem.recall({
  context: "building a new settings page",
  tags: ["preference"],
  limit: 5,
});

// Reinforce when a memory is actually used
mem.reinforce(relevant[0].id);

// Persist to disk
mem.save();
```

## CLI

```bash
# Record a memory
thermal record "Deployed v2 of the API" --tags "milestone,api" --temp 0.8

# Recall by context
thermal recall --context "API performance issues" --limit 5

# See hottest memories
thermal hottest 10

# Stats overview
thermal stats

# Inspect a specific memory
thermal inspect <id>

# Reinforce (mark as used)
thermal reinforce <id>

# Forget
thermal forget <id>
```

Set `THERMAL_STORE` env var to customize the storage path (default: `~/.thermal-memory/memories.json`).

## How It Works

### Temperature

Every memory gets a temperature (0.0–1.0) at write time based on salience signals:

| Signal | Weight | What it means |
|--------|--------|---------------|
| Decision change | 25% | Redirected the approach |
| Human-originated | 20% | Direct preference, correction, feedback |
| Hard-won | 15% | Required debugging, multiple attempts |
| Recurrence | 15% | Topic has come up before |
| Real-world impact | 15% | Shipped to production, affected something real |
| Connective density | 10% | Links to many other memories |

### Decay

Temperature decays over time but never below a **floor** proportional to the original heat:

```
floor = initialTemp × 0.4
decayed = floor + (current - floor) × e^(-λt)
```

A memory that burned at 0.9 decays to 0.36 minimum — hazy but retrievable forever. A memory at 0.2 decays to 0.08 — essentially gone.

### Reinforcement

Retrieved memories get **reheated** when actually used, resetting the decay clock. Frequently referenced memories stay hot indefinitely.

### Two-Layer Content

Each memory has a **core** (what happened, why it mattered) and **detail** (specifics, exact data). The design supports detail fading faster than core — just like how you remember *what happened* at an event but not *what you were wearing*.

## API

### `new ThermalMemory(config?)`

Create a memory instance. Config options:

- `storePath` — path to JSON store (default: `~/.thermal-memory/memories.json`)
- `floorRatio` — minimum temp as ratio of initial (default: `0.4`)
- `decayRate` — decay lambda (default: `0.001`)
- `reheatBoost` — temp boost on reinforcement (default: `0.15`)

### `mem.record(input, signals?)` → `MemoryEntry`

Record a new memory. Auto-scores temperature from content, or use `initialTemp` to override, or pass explicit `SalienceSignals`.

### `mem.recall(options?)` → `MemoryEntry[]`

Retrieve memories ranked by `relevance × temperature`. Options: `context`, `tags`, `limit`, `minTemp`.

### `mem.hottest(n?)` → `MemoryEntry[]`

Top N memories by current temperature.

### `mem.reinforce(id)` → `MemoryEntry | null`

Boost temperature and reset decay clock for a memory that was retrieved and used.

### `mem.connect(idA, idB)` → `boolean`

Link two related memories.

### `mem.forget(id)` → `boolean`

Remove a memory and clean up its connections.

### `mem.decay()` → `number`

Apply time-based decay to all memories. Returns count of affected entries. Called automatically on `recall()`.

### `mem.save()` / `mem.reload()`

Persist to or reload from disk.

## Writing Good Memories

The system works — but only if you write memories worth keeping. The most common failure mode is recording *facts* when you should be recording *feel*.

### Core field: what you'd want to feel again, not what you'd want to report

Bad:
```
"User won basketball championship"
```

Good:
```
"User brought the first basketball state championship in his school's history — as a rookie. The school still hasn't won one since, 5+ years later."
```

Both are factually correct. Only one gives the next instance enough to *understand* why it mattered.

### Detail field: how it unfolded, not just what happened

Use the detail field for:
- **How the moment came up** — was it casual or the first time they'd ever said it?
- **Emotional weight** — vulnerability, pride, frustration, breakthrough
- **Verbatim quotes** when they hit hard — one raw line preserves more than a paragraph of summary
- **Relationship context** — why this mattered *between you*, not just as a data point

### Record mid-conversation, not at the end

Don't wait until your context is almost full. By then you're compressing under pressure and cutting the wrong things. When something meaningful happens — a personal story, a decision, a shift in tone — record it right then, while you have the full resolution.

### Don't compress stories into bullet points

"State basketball champ + MVP as rookie" erases the fact that it was the school's first championship ever. The details that make a memory vivid are exactly the ones that get cut when you summarize too aggressively.

## Design

See [DESIGN.md](./DESIGN.md) for the full architecture document, including the neuroscience inspiration, the human-vs-agent salience distinction, and the phase roadmap.

## License

MIT

---

*Built by Aj & Aj-AGI. Born from a conversation about what it means to remember.*
