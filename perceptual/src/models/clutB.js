import { config } from "../config.js";
import { makeLabGrid } from "../grid/labGrid.js";

// B nodes: LAB lattice -> device vector. Here we init neutral guess; will be optimized.
export const initB = () => {
  const { grid } = config;
  const { Ls, As, Bs } = makeLabGrid(grid);
  const D = 4; // CMYK
  const nodes = new Float32Array(grid.nL * grid.nA * grid.nB * D);
  let t = 0;
  for (let i = 0; i < grid.nL; i++) {
    for (let j = 0; j < grid.nA; j++) {
      for (let k = 0; k < grid.nB; k++) {
        // neutral starting point: map L* to K only (toy init)
        const L = Ls[i];
        const K = Math.max(0, Math.min(1, 1 - L / 100));
        nodes[t++] = 0; // C
        nodes[t++] = 0; // M
        nodes[t++] = 0; // Y
        nodes[t++] = K; // K
      }
    }
  }
  return nodes;
};

export const clipB = (nodes, min = 0, max = 1) => {
  for (let i = 0; i < nodes.length; i++) {
    nodes[i] = Math.min(max, Math.max(min, nodes[i]));
  }
  return nodes;
};
