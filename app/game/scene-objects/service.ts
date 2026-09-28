import type { SceneObjectRuntimeState, SceneObjectPendingReward } from "../types";
import { sceneObjectsFor, type SceneObjectDefinition, type SceneObjectRewardEntry } from "./content";

function hash(input: string) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function unit(seed: string) {
  return hash(seed) / 0xffffffff;
}

function integerBetween(range: [number, number], seed: string) {
  const [minimum, maximum] = range;
  if (maximum <= minimum) return minimum;
  return minimum + Math.floor(unit(seed) * (maximum - minimum + 1));
}

function weightedReward(pool: SceneObjectRewardEntry[], seed: string) {
  const total = pool.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (!pool.length || total <= 0) return undefined;
  let cursor = unit(seed) * total;
  for (const entry of pool) {
    cursor -= Math.max(0, entry.weight);
    if (cursor <= 0) return entry;
  }
  return pool[pool.length - 1];
}

function nextReadyDay(definition: SceneObjectDefinition, day: number, salt: string) {
  return day + integerBetween(definition.production.intervalDays, `${definition.id}:${day}:${salt}:interval`);
}

function generatePending(definition: SceneObjectDefinition, day: number): SceneObjectPendingReward | undefined {
  const cycleSeed = `${definition.id}:${day}`;
  if (unit(`${cycleSeed}:spawn`) > definition.production.spawnChance) return undefined;
  const rare = definition.production.rarePool.length > 0 && unit(`${cycleSeed}:rare`) < definition.production.rareChance;
  const pool = rare ? definition.production.rarePool : definition.production.commonPool;
  const entry = weightedReward(pool, `${cycleSeed}:reward`);
  if (!entry) return undefined;
  return {
    rewardId: entry.id,
    amount: integerBetween(entry.amount, `${cycleSeed}:amount`),
    generatedDay: day,
    ...(rare ? {} : { expiresDay: day + 3 }),
    tier: rare ? "rare" : "common",
  };
}

export function reconcileSceneObjectStates(
  current: Record<string, SceneObjectRuntimeState>,
  sceneId: string,
  day: number,
) {
  let changed = false;
  const next = { ...current };
  for (const definition of sceneObjectsFor(sceneId)) {
    let runtime = current[definition.id];
    if (!runtime) {
      runtime = {
        nextReadyDay: day + Math.max(0, definition.production.initialDelayDays),
        interactions: 0,
      };
      changed = true;
    }
    if (runtime.pending?.expiresDay !== undefined && day >= runtime.pending.expiresDay) {
      runtime = {
        ...runtime,
        pending: undefined,
        nextReadyDay: nextReadyDay(definition, day, "expired"),
      };
      changed = true;
    }
    if (!runtime.pending && day >= runtime.nextReadyDay) {
      // Materialize on the first visit after the timer matures. This prevents a
      // newly seen find from being born already expired after a long absence.
      const pending = generatePending(definition, day);
      runtime = pending
        ? { ...runtime, pending }
        : { ...runtime, nextReadyDay: nextReadyDay(definition, day, "quiet") };
      changed = true;
    }
    next[definition.id] = runtime;
  }
  return changed ? next : current;
}

export function touchSceneObjectState(
  current: Record<string, SceneObjectRuntimeState>,
  definition: SceneObjectDefinition,
) {
  const runtime = current[definition.id];
  if (!runtime) return current;
  return {
    ...current,
    [definition.id]: { ...runtime, interactions: runtime.interactions + 1 },
  };
}

export function claimSceneObjectState(
  current: Record<string, SceneObjectRuntimeState>,
  definition: SceneObjectDefinition,
  day: number,
) {
  const runtime = current[definition.id];
  if (!runtime?.pending) return current;
  return {
    ...current,
    [definition.id]: {
      nextReadyDay: nextReadyDay(definition, day, "claimed"),
      lastClaimedDay: day,
      interactions: runtime.interactions + 1,
    },
  };
}
