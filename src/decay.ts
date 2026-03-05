import type { MemoryEntry, ThermalConfig } from "./types.js";

/**
 * Apply time-based decay to a memory entry.
 * Temperature decays exponentially toward the floor.
 * Detail awareness decays faster than core.
 *
 * Mutates the entry in place and returns it.
 */
export function applyDecay(entry: MemoryEntry, config: ThermalConfig, now?: number): MemoryEntry {
  const currentTime = now ?? Date.now();
  const elapsed = currentTime - entry.lastAccessed;

  // Skip if no time has passed
  if (elapsed <= 0) return entry;

  // Convert elapsed ms to hours for more intuitive decay rates
  const hoursElapsed = elapsed / (1000 * 60 * 60);

  // Core temperature decay: floor + (current - floor) × e^(-λt)
  const coreDecay = Math.exp(-config.decayRate * hoursElapsed);
  entry.currentTemp = entry.floor + (entry.currentTemp - entry.floor) * coreDecay;

  // Clamp
  entry.currentTemp = Math.max(entry.floor, Math.min(1, entry.currentTemp));

  return entry;
}

/**
 * Apply decay to all entries in a memory store.
 * Returns the number of entries that decayed.
 */
export function decayAll(
  entries: MemoryEntry[],
  config: ThermalConfig,
  now?: number,
): number {
  const currentTime = now ?? Date.now();
  let count = 0;
  for (const entry of entries) {
    const before = entry.currentTemp;
    applyDecay(entry, config, currentTime);
    if (entry.currentTemp !== before) count++;
  }
  return count;
}

/**
 * Reheat a memory when it's retrieved and used.
 * Boosts current temperature and resets the decay clock.
 */
export function reinforce(entry: MemoryEntry, config: ThermalConfig, now?: number): MemoryEntry {
  const currentTime = now ?? Date.now();
  entry.currentTemp = Math.min(1, entry.currentTemp + config.reheatBoost);
  entry.reinforceCount += 1;
  entry.lastAccessed = currentTime;
  return entry;
}
