// scripts/generate_lab_nodes.js
import { config } from "../src/config.js";
import { makeLabGrid } from "../src/grid/labGrid.js";
import fs from "fs";

export const main = () => {
  const { Ls, As, Bs } = makeLabGrid(config.grid);
  const lines = [];
  for (const L of Ls) {
    for (const a of As) {
      for (const b of Bs) {
        lines.push(`${L.toFixed(4)} ${a.toFixed(4)} ${b.toFixed(4)}`);
      }
    }
  }
  fs.writeFileSync("lab_nodes.txt", lines.join("\n"));
  console.log(`✓ wrote ${lines.length} nodes to lab_nodes.txt`);
};
main();
export const run = main;
