import { readJson } from "../src/io/fs.js";
import { config } from "../src/config.js";
import { deltaE00 } from "../src/metrics/deltaE00.js";
import { icid } from "../src/metrics/icid.js";
import { p } from "../src/models/deviceModel.js";
import { initB } from "../src/models/clutB.js";

// Evaluate p(B) vs R -> ΔE00, iCID baselines
export const main = async () => {
  const { R } = readJson(config.paths.refsJson);
  const Bnodes = initB(); // will be replaced by loaded clut.json when available
  // Map B nodes (device) through p() to LAB
  // Bnodes is flattened CMYK; group per node:
  const deviceBatch = [];
  for (let t = 0; t < Bnodes.length; t += 4) {
    deviceBatch.push([Bnodes[t], Bnodes[t + 1], Bnodes[t + 2], Bnodes[t + 3]]);
  }
  const LABsim = await p(deviceBatch);

  // Metrics
  let sum = 0;
  for (let i = 0; i < R.length; i++) sum += deltaE00(R[i], LABsim[i]);
  const meanDE00 = sum / R.length;
  const I = icid(R, LABsim, config.icid);

  console.log(
    "Baseline — ΔE00(mean):",
    meanDE00.toFixed(3),
    "  iCID:",
    I.toFixed(3)
  );
};
await main();
export const run = main;
