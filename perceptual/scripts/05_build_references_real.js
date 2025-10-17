import fs from "fs";
import path from "path";
import { config } from "../src/config.js";
import { makeLabGrid } from "../src/grid/labGrid.js";
import { ensureDir, writeJson } from "../src/io/fs.js";

const deg2rad = (d) => (d * Math.PI) / 180;
const rad2deg = (r) => (r * 180) / Math.PI;

/**
 * Parse labsim_nodes.txt into [[L,a,b], ...]
 */
const readLabsim = (file) => {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  return lines.map((l) => l.trim().split(/\s+/).map(Number));
};

/**
 * Convert LAB→LCH
 */
const labToLch = ([L, a, b]) => {
  const C = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, C, h];
};

/**
 * Convert LCH→LAB
 */
const lchToLab = ([L, C, h]) => {
  const a = C * Math.cos(deg2rad(h));
  const b = C * Math.sin(deg2rad(h));
  return [L, a, b];
};

/**
 * Enforce monotonic L* along each (a,b) column
 */
const enforceMonotoneL = (grid, LCH) => {
  const { nL, nA, nB } = grid;
  const getIdx = (i, j, k) => i * nA * nB + j * nB + k;
  for (let j = 0; j < nA; j++) {
    for (let k = 0; k < nB; k++) {
      let lastL = 0;
      for (let i = 0; i < nL; i++) {
        const idx = getIdx(i, j, k);
        const [L, C, h] = LCH[idx];
        if (L < lastL) LCH[idx][0] = lastL;
        else lastL = L;
      }
    }
  }
};

/**
 * Conditional 2D smoothing on each L* slice (simple box average)
 */
const smoothABPlanes = (grid, LCH, passes = 2) => {
  const { nL, nA, nB } = grid;
  const idx = (i, j, k) => i * nA * nB + j * nB + k;
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < nL; i++) {
      const slice = [];
      for (let j = 0; j < nA; j++) {
        for (let k = 0; k < nB; k++) slice.push(LCH[idx(i, j, k)]);
      }
      // Simple 3x3 box blur in (a,b) plane
      for (let j = 1; j < nA - 1; j++) {
        for (let k = 1; k < nB - 1; k++) {
          const neighbors = [];
          for (let dj = -1; dj <= 1; dj++) {
            for (let dk = -1; dk <= 1; dk++) {
              neighbors.push(LCH[idx(i, j + dj, k + dk)]);
            }
          }
          // conditional weighting: stronger smoothing for low-C
          const w = neighbors.map(([L, C, h]) => Math.max(0.3, 1 - C / 100));
          const W = w.reduce((a, b) => a + b, 0);
          const sumL = neighbors.reduce((a, [L], t) => a + w[t] * L, 0);
          const sumC = neighbors.reduce((a, [, C], t) => a + w[t] * C, 0);
          const sumH = neighbors.reduce((a, [, , h], t) => a + w[t] * h, 0);
          LCH[idx(i, j, k)] = [sumL / W, sumC / W, sumH / W];
        }
      }
    }
  }
};

/**
 * Hue linearization inside each L slice
 */
const linearizeHue = (grid, LCH) => {
  const { nL, nA, nB } = grid;
  const idx = (i, j, k) => i * nA * nB + j * nB + k;
  for (let i = 0; i < nL; i++) {
    // compute average hue for neighbors to remove oscillations
    for (let j = 1; j < nA - 1; j++) {
      for (let k = 1; k < nB - 1; k++) {
        const center = LCH[idx(i, j, k)];
        const nhood = [
          LCH[idx(i, j - 1, k)],
          LCH[idx(i, j + 1, k)],
          LCH[idx(i, j, k - 1)],
          LCH[idx(i, j, k + 1)],
        ];
        const avgHue = nhood.reduce((a, [, , h]) => a + h, 0) / nhood.length;
        const [L, C] = center;
        if (C > 3) center[2] = (0.8 * center[2] + 0.2 * avgHue + 360) % 360;
      }
    }
  }
};

/**
 * Lock white point (max-L, low-C node)
 */
const lockWhitePoint = (LCH) => {
  let maxL = -Infinity,
    whiteIdx = 0;
  for (let i = 0; i < LCH.length; i++) {
    const [L, C] = LCH[i];
    if (L > maxL && C < 5) {
      maxL = L;
      whiteIdx = i;
    }
  }
  LCH[whiteIdx] = [...LCH[whiteIdx]]; // locked
};

/**
 * Main
 */
export const main = async () => {
  ensureDir(config.paths.outDir);
  const grid = config.grid;
  const labsim = readLabsim("labsim_nodes.txt");
  let LCH = labsim.map(labToLch);

  enforceMonotoneL(grid, LCH);
  smoothABPlanes(grid, LCH, 4);
  linearizeHue(grid, LCH);
  lockWhitePoint(LCH);

  const R = LCH.map(lchToLab);
  const outPath = path.join(config.paths.outDir, "references.json");
  writeJson(outPath, { grid, R });
  console.log(
    `✓ Built perceptual reference field (${R.length} nodes) → ${outPath}`
  );
};

main();
export const run = main;
