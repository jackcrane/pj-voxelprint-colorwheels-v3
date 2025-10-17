import { config } from "../src/config.js";
import { ensureDir, writeJson } from "../src/io/fs.js";
import { makeLabGrid } from "../src/grid/labGrid.js";

// Step 1 product: perceptually filtered references R (LAB per node).
// Here we stub R as “ideal LAB grid” (identity) — next step we’ll add filtering.
export const main = async () => {
  ensureDir(config.paths.outDir);
  const grid = makeLabGrid(config.grid);
  const R = [];
  for (const L of grid.Ls) {
    for (const a of grid.As) {
      for (const b of grid.Bs) {
        R.push([L, a, b]);
      }
    }
  }
  writeJson(config.paths.refsJson, { grid: config.grid, R });
  console.log("✓ references written:", config.paths.refsJson);
};
await main();
export const run = main;
