"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { reduceGameEffect } from "../core/game-state-reducer";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { useFeedback } from "../feedback/FeedbackProvider";
import { itemAcquiredFeedback } from "../feedback/item-acquired";
import { sceneObjectRewardById, sceneObjectsFor, type SceneObjectDefinition } from "./content";
import { claimSceneObjectState, reconcileSceneObjectStates } from "./service";

type SceneObjectCss = CSSProperties & {
  "--scene-object-x": string;
  "--scene-object-y": string;
  "--scene-object-scale": number;
  "--scene-object-aspect": number;
  "--scene-object-image": string;
  "--scene-object-position": string;
};

function backgroundPosition(cell: [number, number]) {
  const x = cell[0] === 0 ? 0 : cell[0] === 3 ? 100 : cell[0] * 100 / 3;
  const y = cell[1] === 0 ? 0 : 100;
  return `${x}% ${y}%`;
}

export default function SceneObjectLayer({ sceneId, day, hidden = false }: { sceneId: string; day: number; hidden?: boolean }) {
  const { state, setRomance, transact } = useUnifiedGame();
  const feedback = useFeedback();
  const claiming = useRef(new Set<string>());
  const definitions = useMemo(() => sceneObjectsFor(sceneId), [sceneId]);

  useEffect(() => {
    if (hidden || !definitions.length) return;
    setRomance((current) => {
      const sceneObjectStates = reconcileSceneObjectStates(current.sceneObjectStates, sceneId, day);
      return sceneObjectStates === current.sceneObjectStates ? current : { ...current, sceneObjectStates };
    });
  }, [day, definitions.length, hidden, sceneId, setRomance]);

  if (hidden || !definitions.length) return null;

  const interact = (definition: SceneObjectDefinition) => {
    const runtime = state.romance.sceneObjectStates[definition.id];
    const pending = runtime?.pending;
    if (!pending) return;

    const reward = sceneObjectRewardById(pending.rewardId);
    if (!reward || claiming.current.has(definition.id)) return;
    claiming.current.add(definition.id);
    transact((current) => {
      const livePending = current.romance.sceneObjectStates[definition.id]?.pending;
      if (!livePending || livePending.rewardId !== pending.rewardId || livePending.generatedDay !== pending.generatedDay) return current;
      const timestamp = Date.now();
      const awarded = reduceGameEffect({ ...current, updatedAt: timestamp }, {
        type: "add_item",
        item: {
          itemId: reward.id,
          templateId: reward.id,
          itemType: reward.itemType,
          rarity: reward.rarity,
          amount: pending.amount,
          sourceTags: ["scene-object", definition.sceneId, definition.name],
          displayName: reward.name,
        },
      });
      return {
        ...awarded,
        romance: {
          ...awarded.romance,
          sceneObjectStates: claimSceneObjectState(awarded.romance.sceneObjectStates, definition, day),
        },
      };
    });
    window.setTimeout(() => claiming.current.delete(definition.id), 420);
    feedback.publish(itemAcquiredFeedback({
      name: reward.name,
      amount: pending.amount,
      description: reward.description,
      imageSrc: reward.image,
      rarity: reward.rarity,
      eventId: `scene-object:${definition.id}:${pending.generatedDay}:${pending.rewardId}`,
      presentationOwner: "world",
    }));
  };

  return <div className="scene-object-layer" data-scene={sceneId} aria-label="可交互场景物件">
    {definitions.map((definition) => {
      const runtime = state.romance.sceneObjectStates[definition.id];
      const pending = runtime?.pending;
      const style: SceneObjectCss = {
        "--scene-object-x": `${definition.layout.x}%`,
        "--scene-object-y": `${definition.layout.y}%`,
        "--scene-object-scale": definition.layout.size,
        "--scene-object-aspect": definition.atlasAspect,
        "--scene-object-image": `url(${definition.atlas})`,
        "--scene-object-position": backgroundPosition(definition.cell),
      };
      const status = pending?.tier === "rare" ? "rare" : pending ? "ready" : "quiet";
      return <button
        type="button"
        key={definition.id}
        className={`scene-object scene-object-${status}`}
        style={style}
        onClick={() => interact(definition)}
        aria-label={`${definition.name}：${pending ? `可取得物品${pending.tier === "rare" ? "，稀有灵光" : ""}` : definition.interaction}`}
      >
        <i aria-hidden="true" />
        <span><b>{pending ? pending.tier === "rare" ? "稀珍" : "可拾取" : definition.interaction}</b><small>{definition.name}</small></span>
        {pending && <em aria-hidden="true">{pending.tier === "rare" ? "✦" : "·"}</em>}
      </button>;
    })}
  </div>;
}
