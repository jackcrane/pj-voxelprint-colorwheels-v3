// _/steps/paintSolidColor.js

import { config } from "../config.js";

/**
 * Stochastic point halftone from **tonal plates**.
 * Inputs are 16-bit tonals (0..65535). We weight by normalized tonals and draw one material.
 * Order/availability is driven by config and the plates provided.
 *
 * @param {number} i - linear pixel index (row*width + col)
 * @param {{[k:string]: Uint16Array}} plates - e.g. { C, M, Y, W, K? }
 * @param {number} max - maximum tonal (e.g., 65535)
 * @param {object} opts - { gamma (0..1), nearMask?: Uint8Array } for translucency
 * @returns {string} materialKey - one of "cyan","magenta","yellow","white","clear","black"
 */
export const pickMaterialFromPlates = (i, plates, max, opts = {}) => {
  const { gamma = 0 } = opts;

  // Read effective tonals (normalize 0..1)
  const tC = plates.C ? plates.C[i] / max : 0;
  const tM = plates.M ? plates.M[i] / max : 0;
  const tY = plates.Y ? plates.Y[i] / max : 0;
  const tK = plates.K ? plates.K[i] / max : 0;
  const tW = plates.W
    ? plates.W[i] / max
    : Math.max(0, 1 - Math.max(tC, tM, tY, tK));

  // Base weights are tonals (you can plug-in your printer screening strategy here)
  const weights = [];
  if (tC > 0) weights.push(["cyan", tC]);
  if (tM > 0) weights.push(["magenta", tM]);
  if (tY > 0) weights.push(["yellow", tY]);
  if (tK > 0) weights.push(["black", tK]);
  if (tW > 0) weights.push(["white", tW]);

  // If nothing, default to clear (air) outside the wheel
  if (weights.length === 0) return "clear";

  // Translucency control: probabilistically replace **white with clear** based on gamma
  // (Near-surface prioritization can be layered via a depth-aware gamma schedule in index.js)
  if (gamma > 0) {
    for (let w of weights) {
      if (w[0] === "white") {
        const u = Math.random();
        if (u < gamma) w[0] = "clear"; // replace white with clear
        break;
      }
    }
  }

  // Normalize & draw one
  const sum = weights.reduce((s, [, w]) => s + w, 0) || 1e-9;
  const u = Math.random() * sum;
  let acc = 0;
  for (const [name, w] of weights) {
    acc += w;
    if (u <= acc) return name;
  }
  return weights[weights.length - 1][0];
};

/**
 * Map a material key to an RGB fillStyle (final slice color visualization).
 * Uses config.colors swatches.
 */
export const materialToRGB = (materialKey) => {
  const map = {
    cyan: config.colors.cyan,
    magenta: config.colors.magenta,
    yellow: config.colors.yellow,
    black: config.colors.black ?? "#000000",
    white: config.colors.white,
    clear: config.colors.clear, // visualize clear as black for slice raster; adjust as needed
  };
  return map[materialKey] ?? "#000000";
};
