export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

export function shortestAngleDiff(from: number, to: number): number {
  const diff = normalizeAngle(to - from);
  return diff;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Check circle intersection
export function checkCircleCollision(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const d = distance(x1, y1, x2, y2);
  return d < r1 + r2;
}

// Calculates building position in world space based on planet position, radius, and building angle
export function getBuildingWorldPos(
  planetX: number,
  planetY: number,
  planetRadius: number,
  buildingAngle: number
): { x: number; y: number } {
  return {
    x: planetX + Math.cos(buildingAngle) * (planetRadius + 10),
    y: planetY + Math.sin(buildingAngle) * (planetRadius + 10),
  };
}
