export type FishingEncounterPhase = "waiting" | "bite" | "give-take" | "bar";
export type GiveTakeCommand = "reel" | "release";

function hash01(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) value = Math.imul(value ^ seed.charCodeAt(index), 16777619);
  return (value >>> 0) / 4294967296;
}

export function createFishingEncounter(seed: string, rarity: number) {
  const safeRarity = Math.max(1, Math.min(5, Math.round(rarity)));
  const waitingMs = 1450 + Math.round(hash01(`${seed}:wait`) * 1550);
  const biteWindowMs = Math.max(900, 1750 - safeRarity * 105);
  const giveTakePattern = Array.from({ length: 3 + (safeRarity >= 5 ? 1 : 0) }, (_, index): GiveTakeCommand => hash01(`${seed}:give-take:${index}`) > .5 ? "reel" : "release");
  return { waitingMs, biteWindowMs, giveTakePattern };
}

export function resolveGiveTakeStep(input: { expected: GiveTakeCommand; actual: GiveTakeCommand; balance: number }) {
  const correct = input.expected === input.actual;
  const balance = Math.max(-2, Math.min(3, input.balance + (correct ? 1 : -1)));
  return { correct, balance, failed: balance <= -2 };
}
