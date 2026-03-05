import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { ThermalMemory } from "./thermal.js";
import { scoreFromSignals } from "./scorer.js";
import { applyDecay, reinforce } from "./decay.js";
import { resolveConfig } from "./config.js";
import type { MemoryEntry } from "./types.js";

function tmpStore(): string {
  const dir = mkdtempSync(join(tmpdir(), "thermal-test-"));
  return join(dir, "memories.json");
}

describe("ThermalMemory", () => {
  it("records a memory and retrieves it", () => {
    const path = tmpStore();
    const mem = new ThermalMemory({ storePath: path });

    const entry = mem.record({
      core: "User prefers dark theme",
      detail: "Mentioned during UI discussion",
      tags: ["preference", "ui"],
      initialTemp: 0.8,
    });

    assert.equal(mem.size, 1);
    assert.equal(entry.core, "User prefers dark theme");
    assert.equal(entry.initialTemp, 0.8);
    assert.equal(entry.currentTemp, 0.8);
    assert.equal(entry.floor, 0.8 * 0.4); // default floorRatio

    const results = mem.recall({ tags: ["preference"] });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, entry.id);

    rmSync(path, { force: true });
  });

  it("persists to disk and reloads", () => {
    const path = tmpStore();
    const mem1 = new ThermalMemory({ storePath: path });
    mem1.record({ core: "Test persistence", initialTemp: 0.5 });
    mem1.save();

    const mem2 = new ThermalMemory({ storePath: path });
    assert.equal(mem2.size, 1);
    assert.equal(mem2.all()[0].core, "Test persistence");

    rmSync(path, { force: true });
  });

  it("hottest returns entries sorted by temperature", () => {
    const path = tmpStore();
    const mem = new ThermalMemory({ storePath: path });

    mem.record({ core: "Cold memory", initialTemp: 0.2 });
    mem.record({ core: "Hot memory", initialTemp: 0.9 });
    mem.record({ core: "Warm memory", initialTemp: 0.5 });

    const top = mem.hottest(3);
    assert.equal(top[0].core, "Hot memory");
    assert.equal(top[1].core, "Warm memory");
    assert.equal(top[2].core, "Cold memory");

    rmSync(path, { force: true });
  });

  it("reinforcement boosts temperature", () => {
    const path = tmpStore();
    const mem = new ThermalMemory({ storePath: path });

    const entry = mem.record({ core: "Reinforceable", initialTemp: 0.5 });
    const before = entry.currentTemp;
    mem.reinforce(entry.id);
    const after = mem.get(entry.id)!.currentTemp;

    assert.ok(after > before, "Temperature should increase after reinforcement");
    assert.equal(mem.get(entry.id)!.reinforceCount, 1);

    rmSync(path, { force: true });
  });

  it("forget removes a memory and its connections", () => {
    const path = tmpStore();
    const mem = new ThermalMemory({ storePath: path });

    const a = mem.record({ core: "Memory A", initialTemp: 0.5 });
    const b = mem.record({ core: "Memory B", initialTemp: 0.5 });
    mem.connect(a.id, b.id);

    assert.ok(mem.get(a.id)!.connections.includes(b.id));
    mem.forget(a.id);
    assert.equal(mem.size, 1);
    assert.equal(mem.get(b.id)!.connections.length, 0);

    rmSync(path, { force: true });
  });
});

describe("Scorer", () => {
  it("scores from explicit signals", () => {
    const temp = scoreFromSignals({
      decisionChange: 1.0,
      humanOriginated: 1.0,
    });
    // 1.0 * 0.25 + 1.0 * 0.20 = 0.45
    assert.ok(temp >= 0.44 && temp <= 0.46, `Expected ~0.45, got ${temp}`);
  });

  it("all signals at max produces 1.0", () => {
    const temp = scoreFromSignals({
      decisionChange: 1.0,
      humanOriginated: 1.0,
      hardWon: 1.0,
      recurrence: 1.0,
      realWorldImpact: 1.0,
      connectiveDensity: 1.0,
    });
    assert.equal(temp, 1.0);
  });

  it("all signals at zero produces 0.0", () => {
    const temp = scoreFromSignals({});
    assert.equal(temp, 0);
  });
});

describe("Decay", () => {
  it("decays temperature toward floor over time", () => {
    const config = resolveConfig();
    const entry: MemoryEntry = {
      id: "test",
      createdAt: 0,
      core: "test",
      detail: "",
      initialTemp: 0.8,
      currentTemp: 0.8,
      floor: 0.32, // 0.8 * 0.4
      tags: [],
      connections: [],
      reinforceCount: 0,
      lastAccessed: 0,
    };

    // Simulate 100 hours passing
    applyDecay(entry, config, 100 * 60 * 60 * 1000);

    assert.ok(entry.currentTemp < 0.8, "Should have decayed");
    assert.ok(entry.currentTemp >= 0.32, "Should not drop below floor");
  });

  it("reinforcement reheats temperature", () => {
    const config = resolveConfig();
    const entry: MemoryEntry = {
      id: "test",
      createdAt: 0,
      core: "test",
      detail: "",
      initialTemp: 0.8,
      currentTemp: 0.4,
      floor: 0.32,
      tags: [],
      connections: [],
      reinforceCount: 0,
      lastAccessed: 0,
    };

    reinforce(entry, config);
    assert.equal(entry.currentTemp, 0.4 + config.reheatBoost);
    assert.equal(entry.reinforceCount, 1);
  });

  it("temperature never exceeds 1.0 after reinforcement", () => {
    const config = resolveConfig();
    const entry: MemoryEntry = {
      id: "test",
      createdAt: 0,
      core: "test",
      detail: "",
      initialTemp: 1.0,
      currentTemp: 0.95,
      floor: 0.4,
      tags: [],
      connections: [],
      reinforceCount: 0,
      lastAccessed: 0,
    };

    reinforce(entry, config);
    assert.ok(entry.currentTemp <= 1.0);
  });
});
