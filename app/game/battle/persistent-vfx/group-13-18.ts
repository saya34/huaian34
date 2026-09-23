import type { PersistentDrawFrame, PersistentVfxProfile } from "../persistent-vfx-types";
import rawProfiles from "../content/persistent-vfx-group-13-18.json";

export const persistentProfiles13To18 = rawProfiles as PersistentVfxProfile[];

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const wrap01 = (value: number) => ((value % 1) + 1) % 1;

function edgeFade(progress: number) {
  return Math.min(clamp01(progress * 7), clamp01((1 - progress) * 8), 1);
}

function countFor(frame: PersistentDrawFrame, normal: number, reduced: number) {
  return frame.reducedMotion ? reduced : normal;
}

function tracePetal(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  color: string,
  alpha: number,
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.globalAlpha *= alpha;
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(0, -size);
  context.bezierCurveTo(size * 0.9, -size * 0.35, size * 0.72, size * 0.65, 0, size);
  context.bezierCurveTo(-size * 0.72, size * 0.65, -size * 0.9, -size * 0.35, 0, -size);
  context.fill();
  context.restore();
}

function traceFeather(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  rotation: number,
  color: string,
  alpha: number,
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.globalAlpha *= alpha;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = Math.max(0.8, length * 0.045);
  context.beginPath();
  context.moveTo(0, length * 0.58);
  context.quadraticCurveTo(length * 0.48, 0, 0, -length * 0.58);
  context.quadraticCurveTo(-length * 0.28, 0, 0, length * 0.58);
  context.fill();
  context.globalAlpha *= 0.7;
  context.beginPath();
  context.moveTo(0, -length * 0.52);
  context.lineTo(0, length * 0.76);
  context.stroke();
  context.restore();
}

function drawSpringReturn(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = countFor(frame, 62, 22);
  context.save();
  context.globalCompositeOperation = "lighter";

  const ground = context.createLinearGradient(0, height * 0.54, 0, height);
  ground.addColorStop(0, "transparent");
  ground.addColorStop(1, secondary);
  context.globalAlpha = 0.12 * alpha;
  context.fillStyle = ground;
  context.fillRect(0, height * 0.5, width, height * 0.5);

  for (let ring = 0; ring < 4; ring += 1) {
    const pulse = wrap01(time * 0.22 + ring * 0.25);
    context.globalAlpha = alpha * (1 - pulse) * 0.32;
    context.strokeStyle = ring % 2 ? primary : accent;
    context.lineWidth = 1.4 + (1 - pulse) * 1.5;
    context.beginPath();
    context.ellipse(width * 0.5, height * 0.72, width * (0.09 + pulse * 0.31), height * (0.035 + pulse * 0.12), 0, 0, TAU);
    context.stroke();
  }

  context.lineCap = "round";
  for (let vine = 0; vine < 7; vine += 1) {
    const side = vine % 2 === 0 ? -1 : 1;
    const lane = Math.ceil((vine + 1) / 2) / 4;
    const baseX = width * (0.5 + side * (0.16 + lane * 0.31));
    context.globalAlpha = alpha * 0.22;
    context.strokeStyle = primary;
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(baseX, height);
    context.bezierCurveTo(
      baseX + side * width * 0.07,
      height * 0.82,
      baseX - side * width * 0.055,
      height * 0.68,
      baseX + side * width * 0.02,
      height * 0.54,
    );
    context.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const lane = (index + 0.5) / count;
    const fall = wrap01(time * (0.036 + (index % 7) * 0.0026) + index * 0.6180339);
    const x = width * wrap01(lane + Math.sin(time * 0.48 + index * 2.17) * 0.045);
    const y = height * (-0.08 + fall * 1.16);
    const size = 2.4 + (index % 5) * 0.7;
    tracePetal(context, x, y, size, time * 0.42 + index * 1.31, index % 3 === 0 ? accent : primary, alpha * (0.25 + (index % 4) * 0.09));
  }
  context.restore();
}

function drawNinefoldPillFlame(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const cx = width * 0.5;
  const cy = height * 0.62;
  const radiusX = Math.min(width * 0.31, 250);
  const radiusY = Math.min(height * 0.17, 105);
  const count = countFor(frame, 48, 18);
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let orbit = 0; orbit < 9; orbit += 1) {
    const angle = orbit / 9 * TAU + time * 0.34;
    const x = cx + Math.cos(angle) * radiusX;
    const y = cy + Math.sin(angle) * radiusY;
    const pulse = 0.78 + Math.sin(time * 3.1 + orbit * 1.7) * 0.2;
    const glow = context.createRadialGradient(x, y, 0, x, y, 17 * pulse);
    glow.addColorStop(0, accent);
    glow.addColorStop(0.34, primary);
    glow.addColorStop(1, "transparent");
    context.globalAlpha = alpha * 0.72;
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 18 * pulse, 0, TAU);
    context.fill();
    context.globalAlpha = alpha * 0.86;
    context.fillStyle = orbit % 2 ? primary : accent;
    context.beginPath();
    context.ellipse(x, y, 5.2 * pulse, 7.2 * pulse, angle, 0, TAU);
    context.fill();
  }

  for (let layer = 0; layer < 3; layer += 1) {
    context.globalAlpha = alpha * (0.22 - layer * 0.045);
    context.strokeStyle = layer === 1 ? primary : secondary;
    context.lineWidth = 2.6 - layer * 0.5;
    context.setLineDash([7 + layer * 3, 10 + layer * 2]);
    context.lineDashOffset = -time * (22 + layer * 11);
    context.beginPath();
    context.ellipse(cx, cy, radiusX * (0.68 + layer * 0.17), radiusY * (0.68 + layer * 0.17), 0, 0, TAU);
    context.stroke();
  }
  context.setLineDash([]);

  for (let index = 0; index < count; index += 1) {
    const life = wrap01(time * (0.12 + (index % 5) * 0.008) + index * 0.3819);
    const spiral = index * 2.39996 + time * 1.25 + life * 5.4;
    const spread = width * (0.04 + life * 0.49);
    const x = cx + Math.cos(spiral) * spread;
    const y = height * (0.78 - life * 0.72) + Math.sin(spiral) * height * 0.025;
    const r = 1.2 + (1 - life) * 3.8;
    context.globalAlpha = alpha * (1 - life) * 0.68;
    context.fillStyle = index % 4 === 0 ? accent : index % 2 ? primary : secondary;
    context.beginPath();
    context.arc(x, y, r, 0, TAU);
    context.fill();
  }
  context.restore();
}

function drawMoonDew(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = countFor(frame, 52, 20);
  context.save();
  context.globalCompositeOperation = "lighter";

  const moonX = width * 0.78;
  const moonY = height * 0.18;
  const moonR = Math.min(width, height) * 0.095;
  const moonGlow = context.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 2.5);
  moonGlow.addColorStop(0, accent);
  moonGlow.addColorStop(0.18, primary);
  moonGlow.addColorStop(1, "transparent");
  context.globalAlpha = alpha * 0.16;
  context.fillStyle = moonGlow;
  context.beginPath();
  context.arc(moonX, moonY, moonR * 2.5, 0, TAU);
  context.fill();
  context.globalAlpha = alpha * 0.42;
  context.strokeStyle = accent;
  context.lineWidth = Math.max(1.5, moonR * 0.08);
  context.beginPath();
  context.arc(moonX, moonY, moonR, -Math.PI * 0.42, Math.PI * 0.76);
  context.stroke();

  const veil = context.createLinearGradient(0, 0, 0, height);
  veil.addColorStop(0, primary);
  veil.addColorStop(0.55, "transparent");
  veil.addColorStop(1, secondary);
  context.globalAlpha = alpha * 0.065;
  context.fillStyle = veil;
  context.fillRect(0, 0, width, height);

  for (let index = 0; index < count; index += 1) {
    const fall = wrap01(time * (0.044 + (index % 6) * 0.003) + index * 0.7548776);
    const x = width * wrap01(index * 0.6180339 + Math.sin(time * 0.31 + index) * 0.018);
    const y = height * (-0.1 + fall * 1.2);
    const length = 5 + (index % 6) * 1.5;
    context.globalAlpha = alpha * (0.2 + (index % 4) * 0.075);
    context.strokeStyle = index % 5 === 0 ? accent : primary;
    context.lineWidth = 1 + (index % 3) * 0.35;
    context.beginPath();
    context.moveTo(x, y - length);
    context.quadraticCurveTo(x + length * 0.5, y, x, y + length * 0.6);
    context.quadraticCurveTo(x - length * 0.5, y, x, y - length);
    context.stroke();
  }

  for (let ring = 0; ring < 5; ring += 1) {
    const pulse = wrap01(time * 0.15 + ring * 0.2);
    context.globalAlpha = alpha * (1 - pulse) * 0.23;
    context.strokeStyle = ring % 2 ? primary : accent;
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(width * (0.18 + ring * 0.16), height * (0.74 + (ring % 2) * 0.08), width * (0.025 + pulse * 0.105), height * (0.008 + pulse * 0.032), 0, 0, TAU);
    context.stroke();
  }
  context.restore();
}

function drawVermillionPhoenix(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = countFor(frame, 70, 26);
  const cx = width * 0.5;
  const cy = height * 0.57;
  context.save();
  context.globalCompositeOperation = "lighter";

  const fireFloor = context.createLinearGradient(0, height * 0.47, 0, height);
  fireFloor.addColorStop(0, "transparent");
  fireFloor.addColorStop(0.72, secondary);
  fireFloor.addColorStop(1, primary);
  context.globalAlpha = alpha * 0.1;
  context.fillStyle = fireFloor;
  context.fillRect(0, height * 0.4, width, height * 0.6);

  for (let wing = -1; wing <= 1; wing += 2) {
    for (let layer = 0; layer < 4; layer += 1) {
      const beat = Math.sin(time * 2.1 + layer * 0.45) * height * 0.015;
      context.globalAlpha = alpha * (0.28 - layer * 0.045);
      context.strokeStyle = layer % 2 ? primary : accent;
      context.lineWidth = 4.2 - layer * 0.7;
      context.beginPath();
      context.moveTo(cx + wing * width * 0.018, cy + layer * 5);
      context.bezierCurveTo(
        cx + wing * width * (0.13 + layer * 0.025),
        cy - height * (0.13 + layer * 0.035) + beat,
        cx + wing * width * (0.32 + layer * 0.035),
        cy - height * (0.19 - layer * 0.012) - beat,
        cx + wing * width * (0.48 - layer * 0.025),
        cy - height * (0.05 - layer * 0.038),
      );
      context.stroke();
    }
  }

  context.globalAlpha = alpha * 0.35;
  context.strokeStyle = accent;
  context.lineWidth = 2.2;
  context.beginPath();
  context.moveTo(cx, cy - height * 0.16);
  context.quadraticCurveTo(cx + width * 0.06, cy - height * 0.035, cx, cy + height * 0.13);
  context.quadraticCurveTo(cx - width * 0.06, cy - height * 0.035, cx, cy - height * 0.16);
  context.stroke();

  for (let index = 0; index < count; index += 1) {
    const rise = wrap01(time * (0.095 + (index % 7) * 0.006) + index * 0.41421356);
    const lane = wrap01(index * 0.6180339);
    const x = width * lane + Math.sin(time * 0.8 + index * 1.9) * width * 0.025;
    const y = height * (1.08 - rise * 1.18);
    const size = 2 + (index % 6) * 0.75 + (1 - rise) * 2;
    context.globalAlpha = alpha * (0.2 + (1 - rise) * 0.52);
    context.fillStyle = index % 5 === 0 ? accent : index % 2 ? primary : secondary;
    context.beginPath();
    context.moveTo(x, y - size * 1.7);
    context.quadraticCurveTo(x + size, y - size * 0.15, x, y + size);
    context.quadraticCurveTo(x - size * 0.7, y, x, y - size * 1.7);
    context.fill();
  }
  context.restore();
}

function drawEmeraldPhoenix(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = countFor(frame, 58, 20);
  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";

  for (let current = 0; current < 8; current += 1) {
    const lane = (current + 0.5) / 8;
    const drift = Math.sin(time * 0.52 + current * 1.5) * height * 0.055;
    context.globalAlpha = alpha * (0.12 + (current % 3) * 0.035);
    context.strokeStyle = current % 2 ? primary : secondary;
    context.lineWidth = 1.2 + (current % 3) * 0.65;
    context.beginPath();
    context.moveTo(-width * 0.08, height * lane + drift);
    context.bezierCurveTo(
      width * 0.22,
      height * (lane - 0.2) - drift,
      width * 0.7,
      height * (lane + 0.17) + drift,
      width * 1.08,
      height * (lane - 0.04),
    );
    context.stroke();
  }

  const cx = width * 0.52;
  const cy = height * 0.59;
  for (let arc = 0; arc < 3; arc += 1) {
    const phase = time * (0.36 + arc * 0.08) + arc * 1.7;
    context.globalAlpha = alpha * (0.2 - arc * 0.035);
    context.strokeStyle = arc === 1 ? accent : primary;
    context.lineWidth = 2.1 - arc * 0.35;
    context.setLineDash([12 + arc * 5, 19 + arc * 4]);
    context.lineDashOffset = -time * (34 + arc * 9);
    context.beginPath();
    context.ellipse(cx, cy, width * (0.13 + arc * 0.095), height * (0.07 + arc * 0.052), phase * 0.06, 0, TAU);
    context.stroke();
  }
  context.setLineDash([]);

  for (let index = 0; index < count; index += 1) {
    const travel = wrap01(time * (0.055 + (index % 5) * 0.004) + index * 0.271828);
    const wave = Math.sin(travel * TAU * 1.4 + index * 1.37);
    const x = width * (-0.08 + travel * 1.16);
    const y = height * wrap01(index * 0.6180339 + 0.08) + wave * height * 0.045;
    const length = 7 + (index % 6) * 1.8;
    traceFeather(context, x, y, length, -0.7 + wave * 0.22, index % 5 === 0 ? accent : primary, alpha * (0.22 + (index % 4) * 0.075));
  }
  context.restore();
}

function drawWhitePhoenix(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = countFor(frame, 54, 20);
  const cx = width * 0.5;
  const cy = height * 0.58;
  context.save();
  context.globalCompositeOperation = "lighter";

  const halo = context.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) * 0.43);
  halo.addColorStop(0, accent);
  halo.addColorStop(0.18, primary);
  halo.addColorStop(0.52, secondary);
  halo.addColorStop(1, "transparent");
  context.globalAlpha = alpha * (0.075 + Math.sin(time * 1.4) * 0.015);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(cx, cy, Math.min(width, height) * 0.43, 0, TAU);
  context.fill();

  for (let wing = -1; wing <= 1; wing += 2) {
    for (let plume = 0; plume < 6; plume += 1) {
      const lift = Math.sin(time * 1.2 + plume * 0.28) * height * 0.012;
      context.globalAlpha = alpha * (0.2 - plume * 0.018);
      context.strokeStyle = plume % 3 === 0 ? accent : primary;
      context.lineWidth = 2.7 - plume * 0.22;
      context.beginPath();
      context.moveTo(cx + wing * width * 0.025, cy + plume * 3);
      context.quadraticCurveTo(
        cx + wing * width * (0.18 + plume * 0.037),
        cy - height * (0.17 + plume * 0.01) + lift,
        cx + wing * width * (0.43 - plume * 0.018),
        cy - height * (0.08 - plume * 0.026),
      );
      context.stroke();
    }
  }

  for (let ring = 0; ring < 4; ring += 1) {
    const pulse = wrap01(time * 0.13 + ring * 0.25);
    context.globalAlpha = alpha * (1 - pulse) * 0.26;
    context.strokeStyle = ring % 2 ? primary : accent;
    context.lineWidth = 1.4;
    context.beginPath();
    context.ellipse(cx, cy, width * (0.07 + pulse * 0.31), height * (0.035 + pulse * 0.16), 0, 0, TAU);
    context.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const rise = wrap01(time * (0.042 + (index % 6) * 0.003) + index * 0.57721);
    const x = width * wrap01(index * 0.6180339 + Math.sin(time * 0.25 + index) * 0.025);
    const y = height * (1.1 - rise * 1.22);
    const sway = Math.sin(time * 0.5 + index * 1.91);
    traceFeather(
      context,
      x,
      y,
      8 + (index % 7) * 1.65,
      sway * 0.65,
      index % 4 === 0 ? accent : index % 3 === 0 ? secondary : primary,
      alpha * (0.2 + (index % 5) * 0.065),
    );
  }
  context.restore();
}

export function drawPersistentVfx13To18(effectId: string, frame: PersistentDrawFrame): boolean {
  switch (effectId) {
    case "spring-return-bloom":
      drawSpringReturn(frame);
      return true;
    case "ninefold-pill-flame":
      drawNinefoldPillFlame(frame);
      return true;
    case "moon-dew-revival":
      drawMoonDew(frame);
      return true;
    case "vermillion-phoenix":
      drawVermillionPhoenix(frame);
      return true;
    case "emerald-phoenix-song":
      drawEmeraldPhoenix(frame);
      return true;
    case "white-phoenix-nirvana":
      drawWhitePhoenix(frame);
      return true;
    default:
      return false;
  }
}
