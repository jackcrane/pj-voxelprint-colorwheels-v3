import { config } from "../src/config.js";
import { readJson, writeJson } from "../src/io/fs.js";
import { p } from "../src/models/deviceModel.js";
import { initB, clipB } from "../src/models/clutB.js";
import { deltaE00 } from "../src/metrics/deltaE00.js";
import { icid } from "../src/metrics/icid.js";
import { laplacianEnergy } from "../src/regularizers/laplacian3d.js";

const toDevices = (nodes) => {
  const out = [];
  for (let t = 0; t < nodes.length; t += 4)
    out.push([nodes[t], nodes[t + 1], nodes[t + 2], nodes[t + 3]]);
  return out;
};

export const main = async () => {
  const { R } = readJson(config.paths.refsJson);
  const shape = [config.grid.nL, config.grid.nA, config.grid.nB];
  let B = initB();

  for (let it = 0; it < config.optimize.iters; it++) {
    const LABsim = await p(toDevices(B));
    // Compute simple numeric gradient (finite diff) per channel per node (tiny subset for demo)
    // NOTE: We’ll vectorize and batch in the next step. Here: one coarse sweep + smoothness.
    const step = config.optimize.step;
    const grad = new Float32Array(B.length);

    // Sample a small random subset for speed during scaffolding
    const sampleCount = Math.min(1000, B.length / 4);
    for (let s = 0; s < sampleCount; s++) {
      const node = Math.floor(Math.random() * (B.length / 4)) * 4;
      for (let c = 0; c < 4; c++) {
        const old = B[node + c];
        B[node + c] = Math.min(1, old + step);
        const LABp = await p([
          [B[node], B[node + 1], B[node + 2], B[node + 3]],
        ]);
        const i = node / 4;
        const dEplus = deltaE00(R[i], LABp[0]);
        B[node + c] = Math.max(0, old - step);
        const LABm = await p([
          [B[node], B[node + 1], B[node + 2], B[node + 3]],
        ]);
        const dEminus = deltaE00(R[i], LABm[0]);
        const g = (dEplus - dEminus) / (2 * step);
        grad[node + c] += g;
        B[node + c] = old;
      }
    }

    // Smoothness term (Laplacian) — we’ll fold its gradient in later; for now, simple shrinkage
    const E = laplacianEnergy(B, shape, 4);
    // Update (gradient descent on accuracy term only, plus clipping)
    for (let t = 0; t < B.length; t++) B[t] -= config.optimize.step * grad[t];
    clipB(B, config.optimize.clipMin, config.optimize.clipMax);

    // Report
    const LABnow = await p(toDevices(B));
    let sum = 0;
    for (let i = 0; i < R.length; i++) sum += deltaE00(R[i], LABnow[i]);
    const meanDE00 = sum / R.length;
    const I = icid(R, LABnow, config.icid);
    console.log(
      `iter ${it + 1} — ΔE00(mean)=${meanDE00.toFixed(3)}  iCID=${I.toFixed(
        3
      )}  LapE=${E.toExponential(3)}`
    );
  }

  writeJson(config.paths.clutOptJson, { shape, nodes: Array.from(B) });
  console.log("✓ wrote optimized CLUT:", config.paths.clutOptJson);
};
await main();
export const run = main;
