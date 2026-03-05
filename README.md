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

## Design

See [DESIGN.md](./DESIGN.md) for the full architecture document, including the neuroscience inspiration, the human-vs-agent salience distinction, and the phase roadmap.

## License

MIT

---

*Built by Aj & Aj-AGI. Born from a conversation about what it means to remember.*
