import { resolveSceneVariant } from "../world-engine";
import type { CharacterDefinition, CharacterId, GameState, RelationshipStageDefinition, SceneDefinition } from "../types";

export const FALLBACK_RELATIONSHIP_STAGES: RelationshipStageDefinition[] = [
  { id: "stranger", min: 0, name: "初识", addressing: "道友", description: "彼此仍守着礼数。" },
  { id: "familiar", min: 15, name: "相知", addressing: "你", description: "她开始记住你说过的话。" },
  { id: "close", min: 35, name: "心悦", addressing: "名字", description: "牵挂已藏不住。" },
  { id: "devoted", min: 65, name: "同心", addressing: "心上人", description: "愿与你共赴山海。" },
];

export function relationshipStage(character: CharacterDefinition, value: number) {
  const stages = character.relationshipStages?.length ? character.relationshipStages : FALLBACK_RELATIONSHIP_STAGES;
  return [...stages].sort((a, b) => b.min - a.min).find((stage) => value >= stage.min) ?? FALLBACK_RELATIONSHIP_STAGES[0];
}

export function speakerName(speaker: string, characterMap: Record<string, CharacterDefinition>) {
  if (speaker === "player") return "你";
  if (speaker === "narrator") return "旁白";
  return characterMap[speaker as CharacterId]?.name ?? speaker;
}

/** Pure projection consumed by the stage renderer and world controller. */
export function selectWorldScene(game: GameState, scenes: SceneDefinition[], characters: CharacterDefinition[]) {
  const characterMap = Object.fromEntries(characters.map((item) => [item.id, item])) as Record<string, CharacterDefinition>;
  const playableScenes = scenes.filter((item) => item.characters.length > 0 || item.id === "bedroom" || item.id === "spirit-farm");
  const sceneMap = Object.fromEntries(scenes.map((item) => [item.id, item])) as Record<string, SceneDefinition>;
  const baseScene = sceneMap[game.sceneId] ?? playableScenes[0] ?? scenes[0];
  const scene = resolveSceneVariant(baseScene, game);
  const residentIds = scene.characters.filter((id) => {
    const item = characterMap[id];
    const appearances = item?.appearances?.filter((entry) => entry.sceneId === scene.id);
    return appearances?.length ? appearances.some((entry) => entry.mode === "resident") : ((item?.presence?.mode ?? "resident") === "resident");
  });
  const scheduled = game.presentCharacters[scene.id]
    ? [...new Set([...(game.presentCharacters[scene.id] ?? []), ...residentIds])]
    : residentIds;
  const restoredClinic = Boolean(game.flags.medicine_supply_restored);
  const clinicScene = characterMap.liu?.sceneId;
  const presentIds = restoredClinic && scene.id === clinicScene && ["清晨", "上午", "午后"].includes(game.period)
    ? ["liu", ...scheduled.filter((id) => id !== "liu")]
    : scheduled;
  const activeCharacters = presentIds.map((id) => characterMap[id]).filter(Boolean);
  const character = characterMap[game.selectedCharacterId] ?? activeCharacters[0] ?? characters[0];
  return { characterMap, playableScenes, sceneMap, scene, restoredClinic, presentIds, activeCharacters, character };
}
