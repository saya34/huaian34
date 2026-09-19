import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const lines = (file) => read(file).split(/\r?\n/).length;
const failures = [];

function expect(label, condition) {
  if (!condition) failures.push(label);
  else console.log(`✓ ${label}`);
}

function includesAll(file, snippets) {
  const source = read(file);
  return snippets.every((snippet) => source.includes(snippet));
}

function occursInOrder(file, snippets) {
  const source = read(file);
  let cursor = -1;
  return snippets.every((snippet) => {
    const index = source.indexOf(snippet, cursor + 1);
    cursor = index;
    return index >= 0;
  });
}

expect("UnifiedGameProvider 只保留薄上下文职责", lines("app/game/core/UnifiedGameProvider.tsx") <= 180);
expect("世界入口组件已降至 950 行以内", lines("app/game/GameDemo.tsx") <= 950);
expect("战斗入口组件已降至 1050 行以内", lines("app/game/battle/MowingGame.tsx") <= 1050);
expect("炼丹入口组件已降至 1250 行以内", lines("app/game/alchemy/AlchemyGame.tsx") <= 1250);
expect("炼丹展示层已拆出独立模块", includesAll("app/game/alchemy/AlchemyGame.tsx", ["AlchemyPresentation", "AlchemyMarketOverlay"]));
expect("统一状态的迁移与业务 reducer 已分离", includesAll("app/game/core/UnifiedGameProvider.tsx", ["mergeSave", "reduceGameEffects"]));
expect("世界派生值与状态转换已分离", includesAll("app/game/GameDemo.tsx", ["selectWorldScene", "prepareSceneTransition", "prepareTimeTransition"]));
expect("世界切场景顺序固定", occursInOrder("app/game/world/world-transitions.ts", ["const moved = applyAutomaticGlobalKeys", "resolveScenePresence", "const selectedCharacterId"]));
expect("世界推进时辰顺序固定", occursInOrder("app/game/world/world-transitions.ts", ["const timed = applyAutomaticGlobalKeys", "resolveScenePresence", "if (presence.forcedEvent)", "resolveSeekingEncounter"]));
expect("战前配置以深拷贝锁定", includesAll("app/game/battle/run-session.ts", ["structuredClone(input)", "LockedBattleSession"]));
expect("Canvas 结算有 session 级单次提交门", includesAll("app/game/battle/MowingGame.tsx", ["settledSessionRef.current === activeSession.id", "settledSessionRef.current = activeSession.id", "resolveBattleSettlement"]));
expect("Canvas 引擎释放 RAF、监听与 ResizeObserver", includesAll("app/game/battle/engine.ts", ["cancelAnimationFrame(this.animationFrame)", "this.resizeObserver?.disconnect()", 'removeEventListener("keydown"', 'removeEventListener("keyup"', 'removeEventListener("resize"']));
expect("战败仅保留保险格且不带出临时装备", includesAll("app/game/battle/meta.ts", ['result === "defeat" ? safeBox', 'result === "defeat" ? [] : runEquipment']));
expect("只有胜利发放关卡经验与推进完成记录", includesAll("app/game/battle/settlement-service.ts", ['kind === "victory" ? awardClearExperience']) && includesAll("app/game/core/game-state-reducer.ts", ['effect.result === "victory" ? [...new Set']));
expect("撤离保留所得并承担行动成本，战败不扣行动成本", includesAll("app/game/core/game-state-reducer.ts", ['const settled = effect.result !== "defeat"']));

if (failures.length) {
  console.error("\nComponent boundary check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("\nAll component-boundary and battle-policy checks passed.");
