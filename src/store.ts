import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { MemoryEntry } from "./types.js";

/** Load memories from a JSON file. Returns empty array if file doesn't exist. */
export function loadStore(path: string): MemoryEntry[] {
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data as MemoryEntry[];
  } catch {
    return [];
  }
}

/** Save memories to a JSON file. Creates parent directories if needed. */
export function saveStore(path: string, entries: MemoryEntry[]): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(entries, null, 2), "utf-8");
}
