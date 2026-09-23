import type { PersistentDrawFrame, PersistentVfxProfile } from "../persistent-vfx-types";
import rawProfiles from "../content/persistent-vfx-group-25-30.json";

export const persistentProfiles25To30 = rawProfiles as PersistentVfxProfile[];

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const wrap01 = (value: number) => ((value % 1) + 1) % 1;
const hash01 = (value: number) => wrap01(Math.sin(value * 91.3458 + 17.17) * 47453.5453);

function edgeFade(progress: number) {
  return Math.min(clamp01(progress * 7), clamp01((1 - progress) * 8), 1);
}

function particleCount(frame: PersistentDrawFrame, normal: number, reduced: number) {
  return frame.reducedMotion ? reduced : normal;
}

function traceStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  rays = 4,
) {
  context.save();
  context.translate(x, y);
  context.globalAlpha *= alpha;
  context.fillStyle = color;
  context.beginPath();
  for (let ray = 0; ray < rays * 2; ray += 1) {
    const angle = -Math.PI / 2 + ray / (rays * 2) * TAU;
    const length = ray % 2 === 0 ? radius : radius * 0.22;
    const px = Math.cos(angle) * length;
    const py = Math.sin(angle) * length;
    if (ray === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
  context.restore();
}

function traceDragonBody(
  context: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  color: string,
  accent: string,
  alpha: number,
  width: number,
) {
  if (points.length < 2) return;
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalAlpha *= alpha * 0.26;
  context.strokeStyle = accent;
  context.lineWidth = width * 2.5;
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length - 1; index += 1) {
    const next = points[index + 1];
    context.quadraticCurveTo(points[index][0], points[index][1], (points[index][0] + next[0]) / 2, (points[index][1] + next[1]) / 2);
  }
  context.stroke();
  context.globalAlpha = alpha * 0.68;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length - 1; index += 1) {
    const next = points[index + 1];
    context.quadraticCurveTo(points[index][0], points[index][1], (points[index][0] + next[0]) / 2, (points[index][1] + next[1]) / 2);
  }
  context.stroke();
  context.restore();
}

function drawNorthStarArray(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const stars: Array<[number, number]> = [
    [0.19, 0.22], [0.31, 0.30], [0.43, 0.25], [0.51, 0.38], [0.62, 0.48], [0.72, 0.38], [0.82, 0.24],
  ];
  context.save();
  context.globalCompositeOperation = "lighter";

  const sky = context.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.42, Math.max(width, height) * 0.58);
  sky.addColorStop(0, secondary);
  sky.addColorStop(0.52, "transparent");
  context.globalAlpha = alpha * 0.07;
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.lineCap = "round";
  context.globalAlpha = alpha * 0.34;
  context.strokeStyle = primary;
  context.lineWidth = 1.4;
  context.beginPath();
  stars.forEach(([nx, ny], index) => {
    const x = width * nx;
    const y = height * ny;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  stars.forEach(([nx, ny], index) => {
    const pulse = 0.78 + Math.sin(time * 2.1 + index * 1.37) * 0.22;
    const x = width * nx;
    const y = height * ny;
    const glow = context.createRadialGradient(x, y, 0, x, y, 26 * pulse);
    glow.addColorStop(0, accent);
    glow.addColorStop(0.18, primary);
    glow.addColorStop(1, "transparent");
    context.globalAlpha = alpha * 0.35;
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 26 * pulse, 0, TAU);
    context.fill();
    traceStar(context, x, y, 6.5 * pulse, index % 2 ? primary : accent, alpha * 0.92, 4);
  });

  for (let ring = 0; ring < 3; ring += 1) {
    const pulse = wrap01(time * 0.12 + ring / 3);
    context.globalAlpha = alpha * (1 - pulse) * 0.24;
    context.strokeStyle = ring === 1 ? accent : primary;
    context.lineWidth = 1.3;
    context.beginPath();
    context.ellipse(width * 0.5, height * 0.72, width * (0.08 + pulse * 0.32), height * (0.028 + pulse * 0.1), 0, 0, TAU);
    context.stroke();
  }

  const count = particleCount(frame, 46, 16);
  for (let index = 0; index < count; index += 1) {
    const drift = wrap01(time * (0.018 + index % 5 * 0.0015) + hash01(index));
    const x = width * hash01(index + 37) + Math.sin(time * 0.22 + index) * width * 0.012;
    const y = height * wrap01(hash01(index + 73) - drift * 0.2);
    const blink = 0.24 + 0.5 * (0.5 + Math.sin(time * 1.4 + index * 2.3) * 0.5);
    traceStar(context, x, y, 1.4 + index % 4 * 0.65, index % 6 === 0 ? accent : primary, alpha * blink, 4);
  }
  context.restore();
}

function drawSevenStarExecution(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = particleCount(frame, 58, 20);
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let strike = 0; strike < 7; strike += 1) {
    const phase = wrap01(time * 0.24 + strike / 7);
    const impact = Math.exp(-Math.pow((phase - 0.54) * 12, 2));
    const laneX = width * (0.12 + strike * 0.126);
    const groundY = height * (0.68 + (strike % 3) * 0.075);
    const lean = (strike % 2 ? -1 : 1) * width * 0.075;
    context.globalAlpha = alpha * impact * 0.72;
    context.strokeStyle = strike % 2 ? primary : accent;
    context.lineWidth = 2.4 + impact * 4.2;
    context.beginPath();
    context.moveTo(laneX + lean, -height * 0.05);
    context.lineTo(laneX, groundY);
    context.stroke();

    const spearY = -height * 0.16 + phase * height * 0.92;
    context.globalAlpha = alpha * (0.2 + impact * 0.78);
    context.strokeStyle = accent;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(laneX + lean * (1 - phase), spearY - height * 0.12);
    context.lineTo(laneX, spearY + height * 0.035);
    context.stroke();
    traceStar(context, laneX, spearY + height * 0.035, 5.5 + impact * 6, accent, alpha * (0.45 + impact * 0.5), 4);

    context.globalAlpha = alpha * impact * 0.58;
    context.strokeStyle = primary;
    context.lineWidth = 1.6;
    context.beginPath();
    context.ellipse(laneX, groundY, width * (0.015 + impact * 0.065), height * (0.006 + impact * 0.02), 0, 0, TAU);
    context.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const fall = wrap01(time * (0.075 + index % 5 * 0.004) + hash01(index + 11));
    const x = width * hash01(index + 97);
    const y = height * (-0.08 + fall * 1.16);
    context.globalAlpha = alpha * (1 - fall) * 0.55;
    context.strokeStyle = index % 5 === 0 ? accent : secondary;
    context.lineWidth = 0.8 + index % 3 * 0.45;
    context.beginPath();
    context.moveTo(x + 5, y - 15);
    context.lineTo(x, y);
    context.stroke();
  }
  context.restore();
}

function drawFallingComets(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = particleCount(frame, 68, 24);
  context.save();
  context.globalCompositeOperation = "lighter";

  const floorGlow = context.createLinearGradient(0, height * 0.56, 0, height);
  floorGlow.addColorStop(0, "transparent");
  floorGlow.addColorStop(1, secondary);
  context.globalAlpha = alpha * 0.09;
  context.fillStyle = floorGlow;
  context.fillRect(0, height * 0.45, width, height * 0.55);

  for (let comet = 0; comet < 3; comet += 1) {
    const phase = wrap01(time * 0.115 + comet * 0.333);
    const eased = phase * phase * (3 - 2 * phase);
    const startX = width * (0.92 - comet * 0.21);
    const startY = -height * (0.18 + comet * 0.05);
    const endX = width * (0.18 + comet * 0.3);
    const endY = height * (0.72 + (comet % 2) * 0.1);
    const x = startX + (endX - startX) * eased;
    const y = startY + (endY - startY) * eased;
    const tail = 52 + comet * 18;
    const angle = Math.atan2(endY - startY, endX - startX);
    const glow = context.createRadialGradient(x, y, 0, x, y, 34);
    glow.addColorStop(0, accent);
    glow.addColorStop(0.24, primary);
    glow.addColorStop(1, "transparent");
    context.globalAlpha = alpha * 0.68;
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 34, 0, TAU);
    context.fill();
    context.globalAlpha = alpha * 0.74;
    context.strokeStyle = comet === 1 ? accent : primary;
    context.lineWidth = 4.8 - comet * 0.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - Math.cos(angle) * tail, y - Math.sin(angle) * tail);
    context.stroke();
    context.fillStyle = accent;
    context.beginPath();
    context.arc(x, y, 5.8, 0, TAU);
    context.fill();

    const impact = Math.exp(-Math.pow((phase - 0.97) * 26, 2));
    context.globalAlpha = alpha * impact * 0.62;
    context.strokeStyle = accent;
    context.lineWidth = 2.2;
    context.beginPath();
    context.ellipse(endX, endY, width * (0.035 + impact * 0.1), height * (0.012 + impact * 0.038), 0, 0, TAU);
    context.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const life = wrap01(time * (0.08 + index % 6 * 0.005) + hash01(index + 23));
    const origin = index % 3;
    const baseX = width * (0.18 + origin * 0.3);
    const baseY = height * (0.72 + (origin % 2) * 0.1);
    const angle = -Math.PI * (0.12 + hash01(index + 43) * 0.76);
    const distance = width * (0.025 + life * (0.08 + hash01(index + 61) * 0.13));
    const x = baseX + Math.cos(angle) * distance;
    const y = baseY + Math.sin(angle) * distance + life * life * height * 0.12;
    context.globalAlpha = alpha * (1 - life) * 0.54;
    context.fillStyle = index % 7 === 0 ? accent : index % 2 ? primary : secondary;
    context.beginPath();
    context.arc(x, y, 1.3 + index % 4 * 0.7, 0, TAU);
    context.fill();
  }
  context.restore();
}

function drawBlackTideDragon(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = particleCount(frame, 52, 18);
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let wave = 0; wave < 5; wave += 1) {
    const baseY = height * (0.76 + wave * 0.055);
    context.globalAlpha = alpha * (0.22 - wave * 0.027);
    context.strokeStyle = wave % 2 ? primary : secondary;
    context.lineWidth = 1.2 + wave * 0.45;
    context.beginPath();
    context.moveTo(-width * 0.08, baseY);
    for (let step = 0; step <= 12; step += 1) {
      const x = width * step / 12;
      const y = baseY + Math.sin(time * 0.65 + step * 0.82 + wave) * height * (0.018 + wave * 0.003);
      context.lineTo(x, y);
    }
    context.stroke();
  }

  const points: Array<[number, number]> = [];
  for (let segment = 0; segment < 14; segment += 1) {
    const t = segment / 13;
    points.push([
      width * (-0.06 + t * 1.12),
      height * (0.64 - Math.sin(t * TAU * 1.45 + time * 0.52) * 0.13 - t * 0.18),
    ]);
  }
  traceDragonBody(context, points, primary, secondary, alpha, 5.2);
  const head = points[points.length - 1];
  const headGlow = context.createRadialGradient(head[0], head[1], 0, head[0], head[1], 34);
  headGlow.addColorStop(0, accent);
  headGlow.addColorStop(0.22, primary);
  headGlow.addColorStop(1, "transparent");
  context.globalAlpha = alpha * 0.34;
  context.fillStyle = headGlow;
  context.beginPath();
  context.arc(head[0], head[1], 34, 0, TAU);
  context.fill();
  context.globalAlpha = alpha * 0.78;
  context.fillStyle = primary;
  context.beginPath();
  context.ellipse(head[0], head[1], 15, 9, -0.25, 0, TAU);
  context.fill();
  traceStar(context, head[0] + 5, head[1] - 2, 2.2, accent, alpha, 4);

  for (let index = 0; index < count; index += 1) {
    const rise = wrap01(time * (0.038 + index % 7 * 0.0025) + hash01(index + 29));
    const x = width * hash01(index + 131) + Math.sin(time * 0.37 + index) * width * 0.018;
    const y = height * (1.08 - rise * 1.2);
    const size = 1.5 + index % 5 * 0.75;
    context.globalAlpha = alpha * (1 - rise) * 0.4;
    context.fillStyle = index % 6 === 0 ? accent : index % 2 ? primary : secondary;
    context.beginPath();
    context.arc(x, y, size, 0, TAU);
    context.fill();
  }
  context.restore();
}

function drawJadeDragonRise(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = particleCount(frame, 64, 22);
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let current = 0; current < 8; current += 1) {
    const phase = wrap01(time * 0.19 + current / 8);
    const y = height * (0.88 - phase * 0.78);
    const x = width * (0.1 + phase * 0.8 + Math.sin(phase * TAU * 1.5 + current) * 0.07);
    const length = width * (0.08 + (1 - phase) * 0.08);
    context.globalAlpha = alpha * Math.sin(phase * Math.PI) * 0.34;
    context.strokeStyle = current % 3 === 0 ? accent : primary;
    context.lineWidth = 1.6 + current % 3 * 0.55;
    context.beginPath();
    context.moveTo(x - length, y + length * 0.35);
    context.quadraticCurveTo(x - length * 0.28, y - length * 0.25, x, y);
    context.stroke();
  }

  const points: Array<[number, number]> = [];
  for (let segment = 0; segment < 16; segment += 1) {
    const t = segment / 15;
    points.push([
      width * (0.14 + Math.sin(t * Math.PI * 1.5 + time * 0.38) * 0.16 + t * 0.58),
      height * (0.96 - t * 0.87),
    ]);
  }
  traceDragonBody(context, points, primary, accent, alpha, 4.8);
  const head = points[points.length - 1];
  context.globalAlpha = alpha * 0.75;
  context.fillStyle = primary;
  context.beginPath();
  context.ellipse(head[0], head[1], 13, 8, -0.6, 0, TAU);
  context.fill();
  context.strokeStyle = accent;
  context.lineWidth = 1.4;
  context.beginPath();
  context.moveTo(head[0] - 2, head[1] - 5);
  context.lineTo(head[0] - 12, head[1] - 17);
  context.moveTo(head[0] + 4, head[1] - 4);
  context.lineTo(head[0] + 14, head[1] - 15);
  context.stroke();

  for (let index = 0; index < count; index += 1) {
    const rise = wrap01(time * (0.055 + index % 6 * 0.003) + hash01(index + 41));
    const lane = hash01(index + 181);
    const x = width * lane + Math.sin(time * 0.5 + index * 1.7) * width * 0.025;
    const y = height * (1.05 - rise * 1.17);
    const size = 2.2 + index % 5 * 0.8;
    context.save();
    context.translate(x, y);
    context.rotate(-0.55 + Math.sin(time * 0.4 + index) * 0.5);
    context.globalAlpha = alpha * (0.18 + (1 - rise) * 0.42);
    context.fillStyle = index % 5 === 0 ? accent : index % 2 ? primary : secondary;
    context.beginPath();
    context.ellipse(0, 0, size * 0.42, size, 0, 0, TAU);
    context.fill();
    context.restore();
  }
  context.restore();
}

function drawVermilionChiDragon(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = particleCount(frame, 76, 26);
  const cx = width * 0.5;
  const cy = height * 0.62;
  context.save();
  context.globalCompositeOperation = "lighter";

  const aura = context.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) * 0.42);
  aura.addColorStop(0, accent);
  aura.addColorStop(0.22, primary);
  aura.addColorStop(0.62, secondary);
  aura.addColorStop(1, "transparent");
  context.globalAlpha = alpha * (0.07 + Math.sin(time * 1.7) * 0.012);
  context.fillStyle = aura;
  context.beginPath();
  context.arc(cx, cy, Math.min(width, height) * 0.42, 0, TAU);
  context.fill();

  const points: Array<[number, number]> = [];
  for (let segment = 0; segment < 22; segment += 1) {
    const t = segment / 21;
    const angle = time * 0.58 + t * TAU * 1.85;
    const radiusX = width * (0.31 - t * 0.2);
    const radiusY = height * (0.16 - t * 0.095);
    points.push([cx + Math.cos(angle) * radiusX, cy - t * height * 0.3 + Math.sin(angle) * radiusY]);
  }
  traceDragonBody(context, points, primary, accent, alpha, 5.6);
  const head = points[points.length - 1];
  context.globalAlpha = alpha * 0.85;
  context.fillStyle = primary;
  context.beginPath();
  context.ellipse(head[0], head[1], 14, 8.5, -0.2, 0, TAU);
  context.fill();
  context.strokeStyle = accent;
  context.lineWidth = 1.8;
  context.beginPath();
  context.moveTo(head[0] - 3, head[1] - 5);
  context.lineTo(head[0] - 12, head[1] - 15);
  context.moveTo(head[0] + 4, head[1] - 5);
  context.lineTo(head[0] + 13, head[1] - 14);
  context.stroke();

  for (let ring = 0; ring < 4; ring += 1) {
    const pulse = wrap01(time * 0.18 + ring * 0.25);
    context.globalAlpha = alpha * (1 - pulse) * 0.3;
    context.strokeStyle = ring % 2 ? primary : accent;
    context.lineWidth = 1.5 + (1 - pulse) * 1.4;
    context.beginPath();
    context.ellipse(cx, cy, width * (0.07 + pulse * 0.3), height * (0.025 + pulse * 0.11), 0, 0, TAU);
    context.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const rise = wrap01(time * (0.085 + index % 7 * 0.004) + hash01(index + 53));
    const angle = hash01(index + 211) * TAU + time * 0.32;
    const radius = width * (0.04 + hash01(index + 239) * 0.46);
    const x = cx + Math.cos(angle) * radius;
    const y = height * (1.06 - rise * 1.15) + Math.sin(angle) * height * 0.045;
    const size = 1.8 + index % 6 * 0.72;
    context.globalAlpha = alpha * (1 - rise) * 0.68;
    context.fillStyle = index % 7 === 0 ? accent : index % 2 ? primary : secondary;
    context.beginPath();
    context.moveTo(x, y - size * 1.8);
    context.quadraticCurveTo(x + size, y - size * 0.1, x, y + size);
    context.quadraticCurveTo(x - size * 0.75, y, x, y - size * 1.8);
    context.fill();
  }
  context.restore();
}

export function drawPersistentVfx25To30(effectId: string, frame: PersistentDrawFrame): boolean {
  switch (effectId) {
    case "north-star-array":
      drawNorthStarArray(frame);
      return true;
    case "seven-star-execution":
      drawSevenStarExecution(frame);
      return true;
    case "falling-comet-array":
      drawFallingComets(frame);
      return true;
    case "black-tide-dragon":
      drawBlackTideDragon(frame);
      return true;
    case "jade-dragon-rise":
      drawJadeDragonRise(frame);
      return true;
    case "vermilion-chi-dragon":
      drawVermilionChiDragon(frame);
      return true;
    default:
      return false;
  }
}
