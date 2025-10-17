import { config } from "../config.js";

export const cartesianToPolar = (x, y) => {
  const center = [config.x / 2, config.y / 2];
  const dx = x - center[0];
  const dy = y - center[1];
  const theta = Math.atan2(dy, dx);
  const r = Math.sqrt(dx * dx + dy * dy);
  return [theta, r];
};
