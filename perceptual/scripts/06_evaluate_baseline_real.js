import fs from "fs";
import { config } from "../src/config.js";
import { deltaE00 } from "../src/metrics/deltaE00.js";
import { icid } from "../src/metrics/icid.js";
import { writeJson } from "../src/io/fs.js";

const readLabsim = (f) =>
  fs.readFileSync(f, "utf8").trim().split(/\r?\n/).map(l => l.split(/\s+/).map(Number));

export const main = async () => {
  const labsim = readLabsim("labsim_nodes.txt");
  const { R } = JSON.parse(fs.readFileSync("out/references.json", "utf8"));

  if (labsim.length !== R.length)
    throw new Error(`Mismatch: labsim=${labsim.length} vs R=${R.length}`);

  let sum = 0, max = 0;
  const perNode = [];
  for (let i = 0; i < R.length; i++) {
    const dE = deltaE00(R[i], labsim[i]);
    perNode.push(dE);
    sum += dE;
    if (dE > max) max = dE;
  }
  const mean = sum / R.length;
  const I = icid(R, labsim, config.icid);
  const stdev = Math.sqrt(
    perNode.reduce((s, d) => s + (d - mean) ** 2, 0) / R.length
  );

  const out = { mean, stdev, max, iCID: I };
  writeJson("out/errors.json", out);
  console.log("ΔE₀₀ mean", mean.toFixed(3), "σ", stdev.toFixed(3), "max", max.toFixed(3));
  console.log("iCID", I.toFixed(3));
};

main();
export const run = main;