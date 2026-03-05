#!/usr/bin/env node

import { ThermalMemory } from "./thermal.js";
import { parseArgs } from "node:util";

const HELP = `
thermal-memory — Temperature-weighted episodic memory for AI agents

Usage:
  thermal record <core> [--detail <text>] [--tags <a,b,c>] [--temp <0.0-1.0>]
  thermal recall [--context <text>] [--tags <a,b,c>] [--limit <n>] [--min-temp <0.0-1.0>]
  thermal hottest [--limit <n>]
  thermal inspect <id>
  thermal reinforce <id>
  thermal forget <id>
  thermal stats
  thermal export
  thermal help
`.trim();

function createMemory(): ThermalMemory {
  const storePath = process.env.THERMAL_STORE || undefined;
  return new ThermalMemory(storePath ? { storePath } : undefined);
}

function formatTemp(t: number): string {
  const bar = "█".repeat(Math.round(t * 10)) + "░".repeat(10 - Math.round(t * 10));
  return `${bar} ${(t * 100).toFixed(0)}%`;
}

function formatEntry(e: { id: string; core: string; detail: string; currentTemp: number; initialTemp: number; floor: number; tags: string[]; reinforceCount: number; createdAt: number; connections: string[] }): string {
  const age = Date.now() - e.createdAt;
  const hours = Math.floor(age / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const ageStr = days > 0 ? `${days}d ago` : hours > 0 ? `${hours}h ago` : "just now";

  return [
    `  ID:    ${e.id}`,
    `  Temp:  ${formatTemp(e.currentTemp)} (initial: ${(e.initialTemp * 100).toFixed(0)}%, floor: ${(e.floor * 100).toFixed(0)}%)`,
    `  Core:  ${e.core}`,
    e.detail ? `  Detail: ${e.detail.slice(0, 120)}${e.detail.length > 120 ? "..." : ""}` : null,
    e.tags.length > 0 ? `  Tags:  ${e.tags.join(", ")}` : null,
    `  Age:   ${ageStr}  |  Reinforced: ${e.reinforceCount}x  |  Connections: ${e.connections.length}`,
  ].filter(Boolean).join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  const mem = createMemory();

  switch (command) {
    case "record": {
      const core = args[1];
      if (!core) {
        console.error("Error: core text is required.\nUsage: thermal record <core> [--detail <text>] [--tags <a,b>] [--temp <0-1>]");
        process.exit(1);
      }
      const { values } = parseArgs({
        args: args.slice(2),
        options: {
          detail: { type: "string", short: "d" },
          tags: { type: "string", short: "t" },
          temp: { type: "string" },
        },
        allowPositionals: true,
      });
      const entry = mem.record({
        core,
        detail: values.detail,
        tags: values.tags?.split(",").map((s) => s.trim()).filter(Boolean),
        initialTemp: values.temp ? parseFloat(values.temp) : undefined,
      });
      mem.save();
      console.log(`Recorded memory (temp: ${(entry.currentTemp * 100).toFixed(0)}%):\n`);
      console.log(formatEntry(entry));
      break;
    }

    case "recall": {
      const { values } = parseArgs({
        args: args.slice(1),
        options: {
          context: { type: "string", short: "c" },
          tags: { type: "string", short: "t" },
          limit: { type: "string", short: "n" },
          "min-temp": { type: "string" },
        },
        allowPositionals: true,
      });
      const results = mem.recall({
        context: values.context,
        tags: values.tags?.split(",").map((s) => s.trim()).filter(Boolean),
        limit: values.limit ? parseInt(values.limit) : 10,
        minTemp: values["min-temp"] ? parseFloat(values["min-temp"]) : undefined,
      });
      mem.save(); // save decay updates
      if (results.length === 0) {
        console.log("No matching memories found.");
      } else {
        console.log(`Found ${results.length} memories:\n`);
        results.forEach((e, i) => {
          console.log(`[${i + 1}]`);
          console.log(formatEntry(e));
          console.log();
        });
      }
      break;
    }

    case "hottest": {
      const limit = args[1] ? parseInt(args[1]) : 10;
      const results = mem.hottest(limit);
      mem.save();
      if (results.length === 0) {
        console.log("No memories stored yet.");
      } else {
        console.log(`Top ${results.length} hottest memories:\n`);
        results.forEach((e, i) => {
          console.log(`[${i + 1}]`);
          console.log(formatEntry(e));
          console.log();
        });
      }
      break;
    }

    case "inspect": {
      const id = args[1];
      if (!id) { console.error("Usage: thermal inspect <id>"); process.exit(1); }
      const entry = mem.get(id);
      if (!entry) { console.error("Memory not found."); process.exit(1); }
      console.log(formatEntry(entry));
      break;
    }

    case "reinforce": {
      const id = args[1];
      if (!id) { console.error("Usage: thermal reinforce <id>"); process.exit(1); }
      const entry = mem.reinforce(id);
      if (!entry) { console.error("Memory not found."); process.exit(1); }
      mem.save();
      console.log(`Reinforced. New temp: ${(entry.currentTemp * 100).toFixed(0)}%`);
      console.log(formatEntry(entry));
      break;
    }

    case "forget": {
      const id = args[1];
      if (!id) { console.error("Usage: thermal forget <id>"); process.exit(1); }
      const ok = mem.forget(id);
      if (!ok) { console.error("Memory not found."); process.exit(1); }
      mem.save();
      console.log("Memory forgotten.");
      break;
    }

    case "stats": {
      const all = mem.all();
      if (all.length === 0) {
        console.log("No memories stored yet.");
        break;
      }
      const temps = all.map((e) => e.currentTemp);
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      const max = Math.max(...temps);
      const min = Math.min(...temps);
      const hot = all.filter((e) => e.currentTemp >= 0.7).length;
      const warm = all.filter((e) => e.currentTemp >= 0.3 && e.currentTemp < 0.7).length;
      const cold = all.filter((e) => e.currentTemp < 0.3).length;

      console.log(`Thermal Memory Stats`);
      console.log(`────────────────────`);
      console.log(`Total memories: ${all.length}`);
      console.log(`Avg temp:       ${(avg * 100).toFixed(0)}%`);
      console.log(`Range:          ${(min * 100).toFixed(0)}% – ${(max * 100).toFixed(0)}%`);
      console.log(`Hot (≥70%):     ${hot}`);
      console.log(`Warm (30-69%):  ${warm}`);
      console.log(`Cold (<30%):    ${cold}`);
      break;
    }

    case "export": {
      const all = mem.all();
      console.log(JSON.stringify(all, null, 2));
      break;
    }

    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
