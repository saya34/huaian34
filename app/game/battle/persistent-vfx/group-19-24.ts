import type { PersistentDrawFrame, PersistentVfxProfile } from "../persistent-vfx-types";
import rawProfiles from "../content/persistent-vfx-group-19-24.json";

export const persistentProfiles19To24 = rawProfiles as PersistentVfxProfile[];

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const wrap01 = (value: number) => ((value % 1) + 1) % 1;

function edgeFade(progress: number) {
  return Math.min(clamp01(progress * 7), clamp01((1 - progress) * 8), 1);
}

function seeded(index: number, salt = 0) {
  const value = Math.sin((index + 1) * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function particleCount(frame: PersistentDrawFrame, normal: number) {
  return frame.reducedMotion ? Math.max(12, Math.round(normal * 0.36)) : normal;
}

function glowStroke(context: CanvasRenderingContext2D, color: string, alpha: number, width: number, blur: number) {
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = color;
  context.shadowBlur = blur;
}

function drawRaven(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  wing: number,
  color: string,
  alpha: number,
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = size * 0.7;
  context.beginPath();
  context.moveTo(-size * 0.08, 0);
  context.quadraticCurveTo(-size * 0.52, -size * (0.08 + wing), -size, -size * 0.05);
  context.quadraticCurveTo(-size * 0.52, size * 0.2, 0, size * 0.15);
  context.quadraticCurveTo(size * 0.52, size * 0.2, size, -size * 0.05);
  context.quadraticCurveTo(size * 0.52, -size * (0.08 + wing), size * 0.08, 0);
  context.closePath();
  context.fill();
  context.restore();
}

function drawLeaf(
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
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(-length * 0.52, 0);
  context.quadraticCurveTo(0, -length * 0.32, length * 0.52, 0);
  context.quadraticCurveTo(0, length * 0.22, -length * 0.52, 0);
  context.fill();
  context.globalAlpha *= 0.62;
  context.strokeStyle = color;
  context.lineWidth = 0.75;
  context.beginPath();
  context.moveTo(-length * 0.42, 0);
  context.lineTo(length * 0.56, 0);
  context.stroke();
  context.restore();
}

function drawInkRavenRaid(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = particleCount(frame, 58);
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let slash = 0; slash < 12; slash += 1) {
    const beat = wrap01(time * 0.58 + slash / 12);
    const x = width * (-0.12 + beat * 1.24);
    const y = height * (0.1 + seeded(slash, 1) * 0.78);
    glowStroke(context, slash % 3 === 0 ? accent : primary, alpha * Math.pow(Math.sin(beat * Math.PI), 3) * 0.34, 1.2 + slash % 3, 13);
    context.beginPath();
    context.moveTo(x - width * 0.16, y + height * 0.08);
    context.lineTo(x + width * 0.18, y - height * 0.08);
    context.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const travel = wrap01(time * (0.075 + seeded(index, 2) * 0.055) + seeded(index, 3));
    const direction = index % 2 === 0 ? 1 : -1;
    const x = width * (direction > 0 ? -0.08 + travel * 1.16 : 1.08 - travel * 1.16);
    const y = height * (0.08 + seeded(index, 4) * 0.8) + Math.sin(time * 1.4 + index * 1.9) * height * 0.028;
    const size = 4 + seeded(index, 5) * 12;
    const wing = 0.15 + Math.abs(Math.sin(time * 4.5 + index)) * 0.34;
    drawRaven(context, x, y, size, direction > 0 ? -0.08 : Math.PI + 0.08, wing, index % 7 === 0 ? accent : index % 3 === 0 ? secondary : primary, alpha * Math.sin(travel * Math.PI) * 0.48);
  }
  context.restore();
}

function drawGhostBladeStep(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = particleCount(frame, 48);
  const cx = width * 0.5;
  const cy = height * 0.54;
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let afterimage = 0; afterimage < 5; afterimage += 1) {
    const cycle = wrap01(time * 0.34 + afterimage * 0.2);
    const side = afterimage % 2 ? -1 : 1;
    const x = cx + side * width * (0.08 + cycle * 0.39);
    const y = cy - height * 0.13 + cycle * height * 0.26;
    glowStroke(context, afterimage === 2 ? accent : primary, alpha * (1 - cycle) * 0.28, 2.8 - cycle * 1.4, 18);
    context.beginPath();
    context.arc(x, y, Math.min(width, height) * (0.08 + cycle * 0.24), side > 0 ? Math.PI * 0.66 : Math.PI * 1.66, side > 0 ? Math.PI * 1.48 : Math.PI * 0.48, side < 0);
    context.stroke();
  }

  for (let cut = 0; cut < 6; cut += 1) {
    const beat = wrap01(time * 0.82 + cut / 6);
    const rotation = -0.82 + cut * 0.31;
    context.save();
    context.translate(cx, cy);
    context.rotate(rotation);
    const reach = width * (0.22 + beat * 0.46);
    const blade = context.createLinearGradient(-reach, 0, reach, 0);
    blade.addColorStop(0, "transparent");
    blade.addColorStop(0.48, primary);
    blade.addColorStop(0.53, accent);
    blade.addColorStop(1, "transparent");
    context.globalAlpha = alpha * Math.pow(Math.sin(beat * Math.PI), 4) * 0.62;
    context.strokeStyle = blade;
    context.lineWidth = 1 + (cut % 3) * 1.2;
    context.shadowColor = primary;
    context.shadowBlur = 18;
    context.beginPath();
    context.moveTo(-reach, 0);
    context.lineTo(reach, 0);
    context.stroke();
    context.restore();
  }

  for (let index = 0; index < count; index += 1) {
    const travel = wrap01(time * (0.11 + seeded(index, 7) * 0.06) + seeded(index, 8));
    const lane = seeded(index, 9);
    const x = width * (-0.08 + travel * 1.16);
    const y = height * (0.08 + lane * 0.82) - travel * height * 0.14;
    const length = 7 + seeded(index, 10) * 20;
    glowStroke(context, index % 5 ? primary : accent, alpha * Math.sin(travel * Math.PI) * 0.48, 0.7 + seeded(index, 11), 8);
    context.beginPath();
    context.moveTo(x - length, y + length * 0.45);
    context.lineTo(x + length, y - length * 0.45);
    context.stroke();
  }
  context.restore();
}

function drawStarlessShadow(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = particleCount(frame, 40);
  context.save();

  const veil = context.createRadialGradient(width * 0.5, height * 0.53, 0, width * 0.5, height * 0.53, Math.max(width, height) * 0.7);
  veil.addColorStop(0, "transparent");
  veil.addColorStop(0.56, secondary);
  veil.addColorStop(1, "#020207");
  context.globalAlpha = alpha * 0.18;
  context.fillStyle = veil;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "lighter";

  for (let band = 0; band < 7; band += 1) {
    const baseY = height * (0.14 + band * 0.125);
    glowStroke(context, band % 2 ? primary : secondary, alpha * (0.055 + band % 3 * 0.025), 18 + band * 2, 28);
    context.beginPath();
    context.moveTo(-width * 0.1, baseY);
    context.bezierCurveTo(width * 0.25, baseY + Math.sin(time * 0.32 + band) * 38, width * 0.73, baseY - Math.cos(time * 0.27 + band) * 42, width * 1.1, baseY + 12);
    context.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const orbit = seeded(index, 12) * TAU + time * (index % 2 ? -0.08 : 0.07);
    const radius = Math.min(width, height) * (0.1 + seeded(index, 13) * 0.63);
    const x = width * 0.5 + Math.cos(orbit) * radius * 1.25;
    const y = height * 0.52 + Math.sin(orbit) * radius;
    const pulse = 0.5 + Math.sin(time * 1.2 + index * 2.1) * 0.5;
    context.globalAlpha = alpha * (0.12 + pulse * 0.26);
    context.fillStyle = index % 6 === 0 ? accent : primary;
    context.shadowColor = primary;
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(x, y, 0.8 + seeded(index, 14) * 2.4, 0, TAU);
    context.fill();
  }

  for (let ring = 0; ring < 3; ring += 1) {
    const collapse = wrap01(time * 0.12 + ring / 3);
    glowStroke(context, ring === 1 ? accent : primary, alpha * collapse * 0.2, 1.2, 12);
    context.beginPath();
    context.ellipse(width * 0.5, height * 0.52, width * (0.36 - collapse * 0.29), height * (0.26 - collapse * 0.2), 0, 0, TAU);
    context.stroke();
  }
  context.restore();
}

function drawCloudWindDomain(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = particleCount(frame, 52);
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let ribbon = 0; ribbon < 10; ribbon += 1) {
    const lane = (ribbon + 0.5) / 10;
    const drift = Math.sin(time * 0.5 + ribbon * 1.37) * height * 0.055;
    glowStroke(context, ribbon % 3 === 0 ? accent : ribbon % 2 ? primary : secondary, alpha * (0.09 + ribbon % 3 * 0.035), 1.2 + ribbon % 3 * 0.55, 10);
    context.beginPath();
    context.moveTo(-width * 0.12, height * lane + drift);
    context.bezierCurveTo(width * 0.22, height * (lane - 0.18) - drift, width * 0.73, height * (lane + 0.16) + drift, width * 1.12, height * (lane - 0.03));
    context.stroke();
  }

  for (let cloud = 0; cloud < 6; cloud += 1) {
    const travel = wrap01(time * (0.028 + cloud * 0.0025) + cloud * 0.19);
    const x = width * (-0.18 + travel * 1.36);
    const y = height * (0.18 + (cloud % 3) * 0.29);
    for (let puff = 0; puff < 4; puff += 1) {
      const radius = Math.min(width, height) * (0.045 + puff * 0.009);
      const cloudGlow = context.createRadialGradient(x + puff * radius * 0.75, y, 0, x + puff * radius * 0.75, y, radius);
      cloudGlow.addColorStop(0, primary);
      cloudGlow.addColorStop(1, "transparent");
      context.globalAlpha = alpha * 0.08;
      context.fillStyle = cloudGlow;
      context.fillRect(x - radius, y - radius, radius * 6, radius * 2);
    }
  }

  for (let index = 0; index < count; index += 1) {
    const travel = wrap01(time * (0.07 + seeded(index, 15) * 0.045) + seeded(index, 16));
    const x = width * (-0.06 + travel * 1.12);
    const y = height * (0.08 + seeded(index, 17) * 0.84) + Math.sin(time * 0.65 + index) * height * 0.025;
    const length = 8 + seeded(index, 18) * 24;
    glowStroke(context, index % 7 === 0 ? accent : primary, alpha * Math.sin(travel * Math.PI) * 0.38, 0.7 + seeded(index, 19), 7);
    context.beginPath();
    context.moveTo(x - length, y);
    context.quadraticCurveTo(x, y - length * 0.3, x + length, y);
    context.stroke();
  }
  context.restore();
}

function drawBambooWindDomain(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = particleCount(frame, 68);
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let stalk = 0; stalk < 10; stalk += 1) {
    const side = stalk < 5 ? -1 : 1;
    const lane = stalk % 5;
    const x = width * (side < 0 ? 0.02 + lane * 0.035 : 0.98 - lane * 0.035);
    const sway = Math.sin(time * 0.45 + stalk) * width * 0.012;
    glowStroke(context, stalk % 3 === 0 ? accent : primary, alpha * (0.09 + lane * 0.018), 2 + lane * 0.5, 7);
    context.beginPath();
    context.moveTo(x, height * 1.03);
    context.quadraticCurveTo(x + sway, height * 0.56, x - sway * 0.4, height * (0.05 + lane * 0.03));
    context.stroke();
    for (let joint = 1; joint < 5; joint += 1) {
      const y = height * (0.96 - joint * 0.19);
      context.beginPath();
      context.moveTo(x - 5, y);
      context.lineTo(x + 5, y);
      context.stroke();
    }
  }

  for (let strike = 0; strike < 5; strike += 1) {
    const beat = wrap01(time * 0.48 + strike * 0.2);
    const x = width * (0.08 + strike * 0.21);
    glowStroke(context, strike % 2 ? primary : accent, alpha * Math.pow(Math.sin(beat * Math.PI), 4) * 0.46, 1.5 + strike % 2, 16);
    context.beginPath();
    context.moveTo(x - width * 0.21, -height * 0.05);
    context.lineTo(x + width * 0.23, height * 1.05);
    context.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const fall = wrap01(time * (0.055 + seeded(index, 20) * 0.035) + seeded(index, 21));
    const x = width * wrap01(seeded(index, 22) + fall * 0.25);
    const y = height * (-0.08 + fall * 1.17);
    const length = 7 + seeded(index, 23) * 12;
    drawLeaf(context, x, y, length, -0.72 + Math.sin(time * 0.9 + index) * 0.7, index % 6 === 0 ? accent : index % 3 === 0 ? secondary : primary, alpha * Math.sin(fall * Math.PI) * 0.48);
  }
  context.restore();
}

function drawStormEyeDomain(frame: PersistentDrawFrame) {
  const { context, width, height, time, progress, primary, secondary, accent } = frame;
  const alpha = edgeFade(progress);
  const count = particleCount(frame, 60);
  const cx = width * 0.5;
  const cy = height * 0.5;
  const min = Math.min(width, height);
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let arm = 0; arm < 7; arm += 1) {
    glowStroke(context, arm % 3 === 0 ? accent : arm % 2 ? primary : secondary, alpha * (0.1 + arm * 0.014), 1.1 + arm % 3 * 0.7, 10);
    context.beginPath();
    for (let point = 0; point <= 38; point += 1) {
      const ratio = point / 38;
      const angle = arm / 7 * TAU + ratio * TAU * 1.72 + time * 0.38;
      const radius = min * (0.055 + ratio * 0.68);
      const x = cx + Math.cos(angle) * radius * 1.24;
      const y = cy + Math.sin(angle) * radius * 0.88;
      if (point === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }

  const eye = context.createRadialGradient(cx, cy, min * 0.025, cx, cy, min * 0.24);
  eye.addColorStop(0, "transparent");
  eye.addColorStop(0.35, accent);
  eye.addColorStop(0.62, primary);
  eye.addColorStop(1, "transparent");
  context.globalAlpha = alpha * 0.13;
  context.fillStyle = eye;
  context.beginPath();
  context.arc(cx, cy, min * 0.24, 0, TAU);
  context.fill();

  for (let ring = 0; ring < 4; ring += 1) {
    const pulse = wrap01(time * 0.19 + ring * 0.25);
    glowStroke(context, ring % 2 ? accent : primary, alpha * (1 - pulse) * 0.34, 2 - pulse, 13);
    context.beginPath();
    context.ellipse(cx, cy, min * (0.08 + pulse * 0.5), min * (0.045 + pulse * 0.3), time * 0.12, 0, TAU);
    context.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const spiral = seeded(index, 24) * TAU + time * (0.58 + seeded(index, 25) * 0.34);
    const breathe = 0.72 + Math.sin(time * 0.7 + index) * 0.1;
    const radius = min * (0.1 + seeded(index, 26) * 0.67) * breathe;
    const x = cx + Math.cos(spiral) * radius * 1.3;
    const y = cy + Math.sin(spiral) * radius * 0.88;
    const tangent = spiral + Math.PI * 0.5;
    const length = 5 + seeded(index, 27) * 15;
    glowStroke(context, index % 8 === 0 ? accent : primary, alpha * (0.18 + seeded(index, 28) * 0.3), 0.65 + seeded(index, 29), 7);
    context.beginPath();
    context.moveTo(x - Math.cos(tangent) * length, y - Math.sin(tangent) * length);
    context.lineTo(x + Math.cos(tangent) * length, y + Math.sin(tangent) * length);
    context.stroke();
  }
  context.restore();
}

export function drawPersistentVfx19To24(effectId: string, frame: PersistentDrawFrame): boolean {
  switch (effectId) {
    case "ink-raven-raid":
      drawInkRavenRaid(frame);
      return true;
    case "ghost-blade-step":
      drawGhostBladeStep(frame);
      return true;
    case "starless-shadow":
      drawStarlessShadow(frame);
      return true;
    case "cloud-wind-domain":
      drawCloudWindDomain(frame);
      return true;
    case "bamboo-wind-domain":
      drawBambooWindDomain(frame);
      return true;
    case "storm-eye-domain":
      drawStormEyeDomain(frame);
      return true;
    default:
      return false;
  }
}
