import type { PersistentDrawFrame, PersistentVfxProfile } from "../persistent-vfx-types";
import profileContent from "../content/persistent-vfx-group-01-06.json";

const TAU = Math.PI * 2;

export const persistentProfiles01To06 = profileContent.profiles as PersistentVfxProfile[];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothStep(from: number, to: number, value: number) {
  const amount = clamp01((value - from) / Math.max(0.0001, to - from));
  return amount * amount * (3 - 2 * amount);
}

function seededUnit(index: number, salt: number) {
  const wave = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return wave - Math.floor(wave);
}

function rgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  const number = Number.parseInt(normalized, 16);
  return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${clamp01(alpha)})`;
}

function presence(progress: number) {
  return smoothStep(0, 0.08, progress) * (1 - smoothStep(0.9, 1, progress));
}

function glowStroke(context: CanvasRenderingContext2D, color: string, width: number, blur: number, alpha: number) {
  context.strokeStyle = rgba(color, alpha);
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = color;
  context.shadowBlur = blur;
}

function drawDiamond(context: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, color: string, alpha: number) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.fillStyle = rgba(color, alpha);
  context.shadowColor = color;
  context.shadowBlur = size * 1.8;
  context.beginPath();
  context.moveTo(0, -size * 1.9);
  context.lineTo(size * 0.55, 0);
  context.lineTo(0, size * 1.9);
  context.lineTo(-size * 0.55, 0);
  context.closePath();
  context.fill();
  context.restore();
}

function drawFrostSword(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, accent, reducedMotion } = frame;
  const alpha = presence(progress);
  const count = reducedMotion ? 20 : 54;
  context.save();
  context.globalCompositeOperation = "lighter";

  const frost = context.createLinearGradient(0, 0, width, height);
  frost.addColorStop(0, rgba(primary, 0));
  frost.addColorStop(0.48, rgba(primary, alpha * 0.13));
  frost.addColorStop(1, rgba(accent, 0));
  context.fillStyle = frost;
  context.fillRect(0, 0, width, height);

  for (let line = 0; line < 5; line += 1) {
    const sweep = ((time * (0.12 + line * 0.008) + line * 0.21) % 1.4) - 0.2;
    const x = sweep * width;
    const y = height * (0.14 + line * 0.17);
    glowStroke(context, line % 2 ? primary : accent, 1.2 + (line % 3), 13, alpha * (0.26 + line * 0.055));
    context.beginPath();
    context.moveTo(x - width * 0.34, y + height * 0.24);
    context.lineTo(x + width * 0.35, y - height * 0.18);
    context.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const cycle = (time * (0.045 + seededUnit(index, 2) * 0.045) + seededUnit(index, 5)) % 1;
    const x = width * seededUnit(index, 11) + Math.sin(time * 0.7 + index) * width * 0.018;
    const y = height * (-0.08 + cycle * 1.16);
    const size = 1.4 + seededUnit(index, 7) * 3.8;
    drawDiamond(context, x, y, size, time * (0.6 + seededUnit(index, 13)) + index, index % 4 ? primary : accent, alpha * Math.sin(cycle * Math.PI) * 0.78);
  }
  context.restore();
}

function drawBloodMoon(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent, reducedMotion } = frame;
  const alpha = presence(progress);
  const min = Math.min(width, height);
  const moonX = width * 0.78;
  const moonY = height * 0.2;
  const moonRadius = min * 0.16;
  const count = reducedMotion ? 18 : 48;
  context.save();
  context.globalCompositeOperation = "lighter";
  const moon = context.createRadialGradient(moonX, moonY, moonRadius * 0.08, moonX, moonY, moonRadius);
  moon.addColorStop(0, rgba(accent, alpha * 0.72));
  moon.addColorStop(0.34, rgba(primary, alpha * 0.56));
  moon.addColorStop(0.72, rgba(secondary, alpha * 0.24));
  moon.addColorStop(1, rgba(secondary, 0));
  context.fillStyle = moon;
  context.beginPath();
  context.arc(moonX, moonY, moonRadius, 0, TAU);
  context.fill();

  for (let slash = 0; slash < 3; slash += 1) {
    const beat = (time * 0.48 + slash * 0.31) % 1;
    const slashAlpha = Math.sin(beat * Math.PI) * alpha;
    context.save();
    context.translate(width * (0.44 + slash * 0.04), height * (0.39 + slash * 0.18));
    context.rotate(-0.38 + slash * 0.24);
    glowStroke(context, slash === 1 ? accent : primary, 4 + slash * 1.6, 24, slashAlpha * 0.74);
    context.beginPath();
    context.ellipse(0, 0, width * (0.34 + beat * 0.22), height * 0.075, 0, Math.PI * 1.08, Math.PI * 1.9);
    context.stroke();
    context.restore();
  }

  for (let index = 0; index < count; index += 1) {
    const cycle = (time * (0.08 + seededUnit(index, 3) * 0.05) + seededUnit(index, 8)) % 1;
    const x = width * seededUnit(index, 6) + Math.sin(index + time) * 8;
    const y = height * (1.05 - cycle * 1.12);
    const radius = 1 + seededUnit(index, 12) * 2.8;
    context.fillStyle = rgba(index % 5 ? primary : accent, alpha * Math.sin(cycle * Math.PI) * 0.72);
    context.shadowColor = primary;
    context.shadowBlur = 9;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }
  context.restore();
}

function drawJadeGale(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent, reducedMotion } = frame;
  const alpha = presence(progress);
  const count = reducedMotion ? 24 : 72;
  const centerX = width * 0.5;
  const centerY = height * 0.52;
  const min = Math.min(width, height);
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let arm = 0; arm < 4; arm += 1) {
    glowStroke(context, arm % 2 ? primary : secondary, 1.2 + arm * 0.35, 10, alpha * (0.24 + arm * 0.05));
    context.beginPath();
    for (let point = 0; point < 32; point += 1) {
      const amount = point / 31;
      const angle = amount * TAU * 1.35 + arm * TAU / 4 + time * (arm % 2 ? -0.42 : 0.42);
      const radius = min * (0.08 + amount * 0.52);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * 0.62;
      if (!point) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const cycle = (time * (0.09 + seededUnit(index, 14) * 0.065) + seededUnit(index, 4)) % 1;
    const angle = seededUnit(index, 1) * TAU + time * (index % 2 ? -0.38 : 0.52);
    const radius = min * (0.08 + cycle * 0.72);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius * 0.7;
    context.save();
    context.translate(x, y);
    context.rotate(angle + Math.PI * 0.5);
    const length = 6 + seededUnit(index, 9) * 18;
    const blade = context.createLinearGradient(-length, 0, length, 0);
    blade.addColorStop(0, rgba(primary, 0));
    blade.addColorStop(0.55, rgba(index % 3 ? primary : accent, alpha * Math.sin(cycle * Math.PI) * 0.72));
    blade.addColorStop(1, rgba(accent, 0));
    context.strokeStyle = blade;
    context.lineWidth = 1 + seededUnit(index, 10) * 1.5;
    context.shadowColor = primary;
    context.shadowBlur = 8;
    context.beginPath();
    context.moveTo(-length, length * 0.25);
    context.quadraticCurveTo(0, -length * 0.18, length, 0);
    context.stroke();
    context.restore();
  }
  context.restore();
}

function drawLightningBolt(context: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number, seed: number, time: number, color: string, accent: string, alpha: number, branches: boolean) {
  const segments = 11;
  for (const [width, opacity, stroke] of [[8, 0.14, color], [3.2, 0.62, color], [1.15, 1, accent]] as const) {
    glowStroke(context, stroke, width, width * 2.1, alpha * opacity);
    context.beginPath();
    for (let index = 0; index <= segments; index += 1) {
      const amount = index / segments;
      const taper = Math.sin(amount * Math.PI);
      const sway = Math.sin(index * 3.81 + seed * 1.73 + Math.floor(time * 9) * 0.46) * 19 * taper;
      const x = startX + (endX - startX) * amount + sway;
      const y = startY + (endY - startY) * amount;
      if (!index) context.moveTo(x, y); else context.lineTo(x, y);
      if (branches && index > 2 && index < segments - 1 && index % 3 === seed % 3) {
        context.moveTo(x, y);
        context.lineTo(x + (seed % 2 ? -1 : 1) * (20 + index * 2), y + 18 + index * 2);
        context.moveTo(x, y);
      }
    }
    context.stroke();
  }
}

function drawVioletTribulation(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent, reducedMotion } = frame;
  const alpha = presence(progress);
  const count = reducedMotion ? 20 : 60;
  context.save();
  context.globalCompositeOperation = "lighter";
  const storm = context.createLinearGradient(0, 0, 0, height * 0.66);
  storm.addColorStop(0, rgba(secondary, alpha * 0.2));
  storm.addColorStop(0.42, rgba(primary, alpha * 0.08));
  storm.addColorStop(1, rgba(primary, 0));
  context.fillStyle = storm;
  context.fillRect(0, 0, width, height * 0.72);

  for (let strike = 0; strike < 9; strike += 1) {
    const beat = (time * 0.72 + strike * 0.117) % 1;
    const strikeAlpha = alpha * Math.pow(Math.max(0, Math.sin(beat * Math.PI)), 5);
    const x = width * (0.08 + seededUnit(strike, 16) * 0.84);
    const endX = x + (seededUnit(strike, 17) - 0.5) * width * 0.13;
    drawLightningBolt(context, x, -height * 0.06, endX, height * (0.42 + seededUnit(strike, 18) * 0.48), strike + 4, time, primary, accent, strikeAlpha, true);
  }
  for (let index = 0; index < count; index += 1) {
    const cycle = (time * (0.11 + seededUnit(index, 22) * 0.08) + seededUnit(index, 23)) % 1;
    const x = width * seededUnit(index, 24);
    const y = height * seededUnit(index, 25);
    const radius = 0.8 + seededUnit(index, 26) * 2.4;
    context.fillStyle = rgba(index % 4 ? primary : accent, alpha * Math.sin(cycle * Math.PI) * 0.76);
    context.shadowColor = primary;
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(x + Math.sin(time + index) * 9, y, radius, 0, TAU);
    context.fill();
  }
  context.restore();
}

function drawCyanChain(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent, reducedMotion } = frame;
  const alpha = presence(progress);
  const count = reducedMotion ? 20 : 58;
  const nodes = 8;
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let index = 0; index < nodes; index += 1) {
    const angle = index / nodes * TAU + time * 0.16;
    const radiusX = width * (0.29 + 0.025 * Math.sin(time * 0.8 + index));
    const radiusY = height * 0.3;
    const x = width * 0.5 + Math.cos(angle) * radiusX;
    const y = height * 0.5 + Math.sin(angle) * radiusY;
    const nextAngle = (index + 1) / nodes * TAU + time * 0.16;
    const nextX = width * 0.5 + Math.cos(nextAngle) * radiusX;
    const nextY = height * 0.5 + Math.sin(nextAngle) * radiusY;
    drawLightningBolt(context, x, y, nextX, nextY, index + 31, time * 0.7, primary, accent, alpha * 0.52, false);
    const pulse = 4 + 5 * (0.5 + 0.5 * Math.sin(time * 3.2 + index));
    context.fillStyle = rgba(index % 2 ? primary : accent, alpha * 0.84);
    context.shadowColor = primary;
    context.shadowBlur = 18;
    context.beginPath();
    context.arc(x, y, pulse, 0, TAU);
    context.fill();
  }

  for (let spoke = 0; spoke < 4; spoke += 1) {
    const angle = spoke / 4 * TAU - time * 0.22;
    drawLightningBolt(context, width * 0.5, height * 0.5, width * 0.5 + Math.cos(angle) * width * 0.42, height * 0.5 + Math.sin(angle) * height * 0.42, spoke + 47, time, secondary, accent, alpha * 0.36, false);
  }

  for (let index = 0; index < count; index += 1) {
    const orbit = time * (0.28 + seededUnit(index, 31) * 0.25) + seededUnit(index, 32) * TAU;
    const radiusX = width * (0.12 + seededUnit(index, 33) * 0.38);
    const radiusY = height * (0.1 + seededUnit(index, 34) * 0.35);
    drawDiamond(context, width * 0.5 + Math.cos(orbit) * radiusX, height * 0.5 + Math.sin(orbit) * radiusY, 1.2 + seededUnit(index, 35) * 3.2, orbit, index % 3 ? primary : accent, alpha * 0.58);
  }
  context.restore();
}

function drawGoldenHeaven(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent, reducedMotion } = frame;
  const alpha = presence(progress);
  const min = Math.min(width, height);
  const count = reducedMotion ? 18 : 50;
  const centerX = width * 0.5;
  const centerY = height * 0.25;
  context.save();
  context.globalCompositeOperation = "lighter";

  context.save();
  context.translate(centerX, centerY);
  context.rotate(time * 0.12);
  for (let ray = 0; ray < 18; ray += 1) {
    context.rotate(TAU / 18);
    const length = min * (0.23 + (ray % 3) * 0.06);
    const rayGradient = context.createLinearGradient(min * 0.09, 0, length, 0);
    rayGradient.addColorStop(0, rgba(primary, alpha * 0.5));
    rayGradient.addColorStop(1, rgba(primary, 0));
    context.fillStyle = rayGradient;
    context.beginPath();
    context.moveTo(min * 0.08, -1.5);
    context.lineTo(length, 0);
    context.lineTo(min * 0.08, 1.5);
    context.closePath();
    context.fill();
  }
  context.restore();

  const sun = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, min * 0.18);
  sun.addColorStop(0, rgba(accent, alpha * 0.86));
  sun.addColorStop(0.28, rgba(primary, alpha * 0.64));
  sun.addColorStop(0.62, rgba(secondary, alpha * 0.18));
  sun.addColorStop(1, rgba(primary, 0));
  context.fillStyle = sun;
  context.beginPath();
  context.arc(centerX, centerY, min * 0.18, 0, TAU);
  context.fill();

  context.save();
  context.translate(centerX, height * 0.62);
  context.scale(1.32, 0.68);
  glowStroke(context, primary, 4.5, 25, alpha * 0.66);
  context.beginPath();
  context.arc(0, 0, min * 0.31, Math.PI, TAU);
  context.stroke();
  glowStroke(context, accent, 1.1, 8, alpha * 0.82);
  context.stroke();
  context.restore();

  const strikeBeat = Math.pow(Math.max(0, Math.sin(time * 1.4)), 8) * alpha;
  drawLightningBolt(context, centerX, centerY + min * 0.08, centerX, height * 0.78, 71, time, primary, accent, strikeBeat * 0.9, true);

  for (let index = 0; index < count; index += 1) {
    const cycle = (time * (0.05 + seededUnit(index, 41) * 0.05) + seededUnit(index, 42)) % 1;
    const angle = seededUnit(index, 43) * TAU + time * 0.08;
    const radius = min * (0.12 + cycle * 0.65);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius * 0.8;
    drawDiamond(context, x, y, 1.4 + seededUnit(index, 44) * 3.6, angle, index % 5 ? primary : accent, alpha * Math.sin(cycle * Math.PI) * 0.72);
  }
  context.restore();
}

export function drawPersistentVfx01To06(effectId: string, frame: PersistentDrawFrame): boolean {
  switch (effectId) {
    case "frost-sword-heaven":
      drawFrostSword(frame);
      return true;
    case "blood-moon-cleave":
      drawBloodMoon(frame);
      return true;
    case "jade-gale-blades":
      drawJadeGale(frame);
      return true;
    case "violet-tribulation":
      drawVioletTribulation(frame);
      return true;
    case "cyan-thunder-chain":
      drawCyanChain(frame);
      return true;
    case "golden-heaven-strike":
      drawGoldenHeaven(frame);
      return true;
    default:
      return false;
  }
}
