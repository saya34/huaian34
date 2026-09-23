import type { PersistentDrawFrame, PersistentVfxProfile } from "../persistent-vfx-types";
import profileSource from "../content/persistent-vfx-group-07-12.json";

const TAU = Math.PI * 2;

export const persistentProfiles07To12: PersistentVfxProfile[] = profileSource.map((profile) => ({
  ...profile,
  particleKind: profile.particleKind as PersistentVfxProfile["particleKind"],
}));

function rgba(hex: string, alpha: number) {
  const raw = hex.replace("#", "");
  const normalized = raw.length === 3 ? raw.split("").map((part) => `${part}${part}`).join("") : raw;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

function phase(index: number, salt = 0) {
  const value = Math.sin((index + 1) * 91.17 + salt * 43.61) * 43758.5453;
  return value - Math.floor(value);
}

function glowStroke(context: CanvasRenderingContext2D, color: string, alpha: number, width: number, blur: number) {
  context.strokeStyle = rgba(color, alpha);
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = color;
  context.shadowBlur = blur;
}

function drawEllipseRing(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  color: string,
  alpha: number,
  width: number,
  rotation = 0,
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  glowStroke(context, color, alpha, width, 12);
  context.beginPath();
  context.ellipse(0, 0, radiusX, radiusY, 0, 0, TAU);
  context.stroke();
  context.restore();
}

function drawLotusPetal(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  width: number,
  rotation: number,
  color: string,
  alpha: number,
  filled = false,
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.beginPath();
  context.moveTo(0, -length * 0.54);
  context.bezierCurveTo(width, -length * 0.22, width * 0.72, length * 0.34, 0, length * 0.54);
  context.bezierCurveTo(-width * 0.72, length * 0.34, -width, -length * 0.22, 0, -length * 0.54);
  context.closePath();
  context.shadowColor = color;
  context.shadowBlur = 10;
  if (filled) {
    context.fillStyle = rgba(color, alpha * 0.32);
    context.fill();
  }
  glowStroke(context, color, alpha, Math.max(0.8, width * 0.08), 10);
  context.stroke();
  context.restore();
}

function drawFeather(
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
  glowStroke(context, color, alpha, Math.max(0.75, length * 0.025), 8);
  context.beginPath();
  context.moveTo(0, length * 0.5);
  context.quadraticCurveTo(length * 0.13, 0, 0, -length * 0.5);
  context.quadraticCurveTo(-length * 0.17, -length * 0.06, 0, length * 0.5);
  context.stroke();
  context.beginPath();
  context.moveTo(0, -length * 0.4);
  context.lineTo(0, length * 0.58);
  context.stroke();
  context.restore();
}

function drawRune(
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
  glowStroke(context, color, alpha, Math.max(1, size * 0.08), 8);
  context.strokeRect(-size * 0.38, -size * 0.5, size * 0.76, size);
  context.beginPath();
  context.moveTo(-size * 0.25, -size * 0.08);
  context.lineTo(size * 0.24, -size * 0.08);
  context.moveTo(0, -size * 0.34);
  context.lineTo(0, size * 0.34);
  context.moveTo(-size * 0.22, size * 0.18);
  context.lineTo(size * 0.22, size * 0.18);
  context.stroke();
  context.restore();
}

function drawSilverMoonLotus(frame: PersistentDrawFrame) {
  const { context, width, height, time, primary, secondary, accent, reducedMotion } = frame;
  const motion = reducedMotion ? 0.18 : 1;
  const t = time * motion;
  const min = Math.min(width, height);
  const x = width * 0.5;
  const y = height * 0.59;
  context.save();
  context.globalCompositeOperation = "lighter";

  const moon = context.createRadialGradient(x, height * 0.22, 0, x, height * 0.22, min * 0.24);
  moon.addColorStop(0, rgba(accent, 0.2));
  moon.addColorStop(0.48, rgba(primary, 0.08));
  moon.addColorStop(1, "transparent");
  context.fillStyle = moon;
  context.fillRect(0, 0, width, height * 0.62);
  drawEllipseRing(context, x, height * 0.22, min * 0.14, min * 0.14, accent, 0.24, 1.4);

  for (let ring = 0; ring < 3; ring += 1) {
    const count = 8 + ring * 4;
    const radius = min * (0.07 + ring * 0.072);
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * TAU + t * (ring % 2 ? -0.16 : 0.12);
      drawLotusPetal(
        context,
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius * 0.52,
        min * (0.095 + ring * 0.025),
        min * 0.022,
        angle + Math.PI / 2,
        ring === 1 ? secondary : primary,
        0.2 + ring * 0.06,
        ring === 0,
      );
    }
  }

  for (let index = 0; index < (reducedMotion ? 18 : 58); index += 1) {
    const seed = phase(index, 7);
    const cycle = (seed + t * (0.035 + phase(index, 8) * 0.035)) % 1;
    const px = width * phase(index, 9) + Math.sin(t * 0.7 + index) * width * 0.018;
    const py = height * (1.05 - cycle * 1.18);
    const size = 1.8 + phase(index, 10) * 4.4;
    context.save();
    context.translate(px, py);
    context.rotate(t * 0.5 + seed * TAU);
    glowStroke(context, index % 3 ? primary : accent, 0.22 + Math.sin(cycle * Math.PI) * 0.36, 0.8, 6);
    context.beginPath();
    for (let arm = 0; arm < 3; arm += 1) {
      context.moveTo(-size, 0);
      context.lineTo(size, 0);
      context.rotate(Math.PI / 3);
    }
    context.stroke();
    context.restore();
  }
  context.restore();
}

function drawAzureIceLotus(frame: PersistentDrawFrame) {
  const { context, width, height, time, primary, secondary, accent, reducedMotion } = frame;
  const motion = reducedMotion ? 0.14 : 1;
  const t = time * motion;
  const min = Math.min(width, height);
  const x = width * 0.5;
  const y = height * 0.76;
  context.save();
  context.globalCompositeOperation = "lighter";

  const bloom = context.createRadialGradient(x, y, 0, x, y, min * 0.5);
  bloom.addColorStop(0, rgba(primary, 0.15));
  bloom.addColorStop(0.45, rgba(secondary, 0.045));
  bloom.addColorStop(1, "transparent");
  context.fillStyle = bloom;
  context.fillRect(0, height * 0.12, width, height * 0.88);

  for (let ring = 0; ring < 4; ring += 1) {
    const cycle = (t * 0.11 + ring / 4) % 1;
    drawEllipseRing(context, x, y, min * (0.1 + cycle * 0.55), min * (0.025 + cycle * 0.14), ring % 2 ? secondary : primary, (1 - cycle) * 0.24, 1.2);
  }

  for (let ring = 0; ring < 2; ring += 1) {
    const count = ring ? 12 : 8;
    const radius = min * (ring ? 0.15 : 0.075);
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * TAU + t * (ring ? -0.1 : 0.14);
      drawLotusPetal(context, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * 0.36, min * (ring ? 0.17 : 0.12), min * 0.032, angle + Math.PI / 2, index % 3 ? primary : accent, 0.28, true);
    }
  }

  for (let index = 0; index < (reducedMotion ? 16 : 46); index += 1) {
    const seed = phase(index, 12);
    const cycle = (seed + t * (0.045 + phase(index, 13) * 0.035)) % 1;
    const px = width * (0.12 + phase(index, 14) * 0.76) + Math.sin(t + index) * 12;
    const py = height * (0.94 - cycle * 0.76);
    const size = 2 + phase(index, 15) * 3.5;
    context.fillStyle = rgba(index % 4 ? primary : accent, Math.sin(cycle * Math.PI) * 0.5);
    context.shadowColor = primary;
    context.shadowBlur = 9;
    context.beginPath();
    context.arc(px, py, size, 0, TAU);
    context.fill();
    glowStroke(context, primary, Math.sin(cycle * Math.PI) * 0.28, 1, 7);
    context.beginPath();
    context.moveTo(px - size * 2.3, py);
    context.lineTo(px + size * 2.3, py);
    context.moveTo(px, py - size * 2.3);
    context.lineTo(px, py + size * 2.3);
    context.stroke();
  }
  context.restore();
}

function drawSnowCraneWard(frame: PersistentDrawFrame) {
  const { context, width, height, time, primary, secondary, accent, reducedMotion } = frame;
  const motion = reducedMotion ? 0.12 : 1;
  const t = time * motion;
  const min = Math.min(width, height);
  const x = width * 0.5;
  const y = height * 0.55;
  context.save();
  context.globalCompositeOperation = "lighter";

  const wingBeat = reducedMotion ? 0 : Math.sin(t * 1.8) * min * 0.018;
  for (const direction of [-1, 1]) {
    for (let feather = 0; feather < 9; feather += 1) {
      const spread = feather / 8;
      const angle = direction * (-0.18 - spread * 0.76) + (direction < 0 ? Math.PI : 0);
      const rootX = x + direction * min * (0.035 + spread * 0.09);
      const rootY = y - min * 0.04 + spread * min * 0.045 + wingBeat * spread;
      drawFeather(context, rootX, rootY, min * (0.16 + spread * 0.24), angle, feather % 3 ? primary : accent, 0.18 + spread * 0.18);
    }
  }
  drawEllipseRing(context, x, y + min * 0.15, min * 0.34, min * 0.12, secondary, 0.2, 2);
  drawEllipseRing(context, x, y + min * 0.15, min * 0.25, min * 0.08, accent, 0.18, 1, -t * 0.08);

  for (let index = 0; index < (reducedMotion ? 14 : 38); index += 1) {
    const seed = phase(index, 16);
    const cycle = (seed + t * (0.035 + phase(index, 17) * 0.025)) % 1;
    const fromLeft = index % 2 === 0;
    const px = width * (fromLeft ? -0.06 + cycle * 1.12 : 1.06 - cycle * 1.12);
    const py = height * (0.12 + phase(index, 18) * 0.75) + Math.sin(cycle * TAU + seed) * 22;
    drawFeather(context, px, py, 12 + phase(index, 19) * 22, (fromLeft ? 1 : -1) * (0.55 + Math.sin(cycle * TAU) * 0.3), index % 4 ? primary : accent, Math.sin(cycle * Math.PI) * 0.42);
  }
  context.restore();
}

function drawVajraGoldenDome(frame: PersistentDrawFrame) {
  const { context, width, height, time, primary, secondary, accent, reducedMotion } = frame;
  const motion = reducedMotion ? 0.12 : 1;
  const t = time * motion;
  const min = Math.min(width, height);
  const x = width * 0.5;
  const groundY = height * 0.88;
  const radiusX = Math.min(width * 0.43, min * 0.68);
  const radiusY = Math.min(height * 0.56, min * 0.66);
  context.save();
  context.globalCompositeOperation = "lighter";

  const dome = context.createRadialGradient(x, groundY, min * 0.08, x, groundY, radiusX);
  dome.addColorStop(0, rgba(primary, 0.015));
  dome.addColorStop(0.72, rgba(primary, 0.04));
  dome.addColorStop(1, "transparent");
  context.fillStyle = dome;
  context.fillRect(0, 0, width, height);

  for (let layer = 0; layer < 3; layer += 1) {
    context.save();
    context.translate(x, groundY);
    context.scale(1, radiusY / radiusX);
    glowStroke(context, layer === 1 ? accent : primary, 0.18 + layer * 0.06, layer === 1 ? 1.2 : 3.5 - layer, 18);
    context.beginPath();
    context.arc(0, 0, radiusX * (1 - layer * 0.085), Math.PI, TAU);
    context.stroke();
    context.restore();
  }

  const runeCount = 16;
  for (let index = 0; index < runeCount; index += 1) {
    const angle = Math.PI + (index + 0.5) / runeCount * Math.PI;
    const pulse = 0.55 + Math.sin(t * 2.4 + index * 0.7) * 0.25;
    drawRune(context, x + Math.cos(angle) * radiusX * 0.88, groundY + Math.sin(angle) * radiusY * 0.88, min * 0.03, angle + Math.PI / 2, index % 3 ? primary : accent, 0.2 * pulse);
  }

  for (let wave = 0; wave < 4; wave += 1) {
    const cycle = (t * 0.15 + wave / 4) % 1;
    drawEllipseRing(context, x, groundY - min * 0.02, min * (0.12 + cycle * 0.58), min * (0.025 + cycle * 0.12), wave % 2 ? secondary : primary, (1 - cycle) * 0.28, 2.4);
  }
  context.restore();
}

function drawBlackTortoiseShell(frame: PersistentDrawFrame) {
  const { context, width, height, time, primary, secondary, accent, reducedMotion } = frame;
  const motion = reducedMotion ? 0.1 : 1;
  const t = time * motion;
  const min = Math.min(width, height);
  const cell = Math.max(34, min * 0.09);
  context.save();

  const shade = context.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, "transparent");
  shade.addColorStop(0.5, rgba(secondary, 0.018));
  shade.addColorStop(1, rgba(primary, 0.075));
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "lighter";

  const columns = Math.ceil(width / (cell * 1.5)) + 2;
  const rows = Math.ceil(height / (cell * 1.3)) + 2;
  for (let row = -1; row < rows; row += 1) {
    for (let column = -1; column < columns; column += 1) {
      const x = column * cell * 1.5 + (row % 2 ? cell * 0.75 : 0);
      const y = row * cell * 1.28;
      const distance = Math.hypot(x - width * 0.5, y - height * 0.56) / Math.max(width, height);
      const pulse = 0.5 + Math.sin(t * 1.45 - distance * 12) * 0.5;
      glowStroke(context, (row + column) % 4 ? primary : accent, 0.045 + pulse * 0.11, 1.1, 5);
      context.beginPath();
      for (let point = 0; point < 6; point += 1) {
        const angle = point / 6 * TAU;
        const px = x + Math.cos(angle) * cell * 0.54;
        const py = y + Math.sin(angle) * cell * 0.54;
        if (point === 0) context.moveTo(px, py); else context.lineTo(px, py);
      }
      context.closePath();
      context.stroke();
    }
  }

  for (let ridge = 0; ridge < 4; ridge += 1) {
    const baseY = height * (0.82 + ridge * 0.045);
    glowStroke(context, ridge % 2 ? secondary : primary, 0.16 - ridge * 0.025, 2.5 - ridge * 0.35, 10);
    context.beginPath();
    context.moveTo(-width * 0.05, baseY);
    for (let point = 0; point <= 8; point += 1) {
      const px = width * point / 8;
      const py = baseY - Math.abs(Math.sin(point * 1.73 + ridge)) * min * (0.08 + ridge * 0.018);
      context.lineTo(px, py);
    }
    context.lineTo(width * 1.05, baseY);
    context.stroke();
  }
  context.restore();
}

function drawSunWheelSanctuary(frame: PersistentDrawFrame) {
  const { context, width, height, time, primary, secondary, accent, reducedMotion } = frame;
  const motion = reducedMotion ? 0.08 : 1;
  const t = time * motion;
  const min = Math.min(width, height);
  const x = width * 0.5;
  const y = height * 0.28;
  const radius = min * 0.16;
  context.save();
  context.globalCompositeOperation = "lighter";

  const sun = context.createRadialGradient(x, y, 0, x, y, radius * 2.7);
  sun.addColorStop(0, rgba(accent, 0.32));
  sun.addColorStop(0.22, rgba(primary, 0.16));
  sun.addColorStop(0.62, rgba(secondary, 0.045));
  sun.addColorStop(1, "transparent");
  context.fillStyle = sun;
  context.fillRect(0, 0, width, height * 0.82);

  context.save();
  context.translate(x, y);
  context.rotate(t * 0.12);
  for (let ray = 0; ray < 24; ray += 1) {
    const angle = ray / 24 * TAU;
    const pulse = 0.72 + Math.sin(t * 2.2 + ray * 0.85) * 0.16;
    const inner = radius * (ray % 2 ? 1.08 : 1.2);
    const outer = radius * (ray % 3 ? 1.64 : 2.05) * pulse;
    glowStroke(context, ray % 4 ? primary : accent, 0.13 + (ray % 3) * 0.04, ray % 2 ? 1.3 : 2.2, 10);
    context.beginPath();
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    context.stroke();
  }
  context.restore();
  drawEllipseRing(context, x, y, radius, radius, accent, 0.33, 2.4, -t * 0.16);
  drawEllipseRing(context, x, y, radius * 0.72, radius * 0.72, primary, 0.26, 1.2, t * 0.2);

  for (let index = 0; index < (reducedMotion ? 18 : 52); index += 1) {
    const seed = phase(index, 22);
    const cycle = (seed + t * (0.045 + phase(index, 23) * 0.05)) % 1;
    const angle = phase(index, 24) * TAU + t * (index % 2 ? 0.08 : -0.06);
    const orbit = min * (0.22 + cycle * 0.62);
    const px = x + Math.cos(angle) * orbit;
    const py = y + Math.sin(angle) * orbit * 0.72 + cycle * height * 0.22;
    const size = 1.2 + phase(index, 25) * 3.4;
    context.fillStyle = rgba(index % 3 ? primary : accent, Math.sin(cycle * Math.PI) * 0.5);
    context.shadowColor = primary;
    context.shadowBlur = 10;
    context.beginPath();
    context.arc(px, py, size, 0, TAU);
    context.fill();
  }
  context.restore();
}

export function drawPersistentVfx07To12(effectId: string, frame: PersistentDrawFrame): boolean {
  switch (effectId) {
    case "silver-moon-lotus":
      drawSilverMoonLotus(frame);
      return true;
    case "azure-ice-lotus":
      drawAzureIceLotus(frame);
      return true;
    case "snow-crane-ward":
      drawSnowCraneWard(frame);
      return true;
    case "vajra-golden-dome":
      drawVajraGoldenDome(frame);
      return true;
    case "black-tortoise-shell":
      drawBlackTortoiseShell(frame);
      return true;
    case "sun-wheel-sanctuary":
      drawSunWheelSanctuary(frame);
      return true;
    default:
      return false;
  }
}
