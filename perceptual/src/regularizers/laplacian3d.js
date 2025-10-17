// 3D Laplacian energy over CLUT lattice: nodes = Float32Array[nL*nA*nB*D]
export const laplacianEnergy = (nodes, shape, D = 4) => {
  const [nL, nA, nB] = shape;
  const idx = (i, j, k, c) => ((i * nA + j) * nB + k) * D + c;
  let E = 0;
  for (let i = 1; i < nL - 1; i++) {
    for (let j = 1; j < nA - 1; j++) {
      for (let k = 1; k < nB - 1; k++) {
        for (let c = 0; c < D; c++) {
          const center = nodes[idx(i, j, k, c)];
          const lap =
            nodes[idx(i - 1, j, k, c)] +
            nodes[idx(i + 1, j, k, c)] +
            nodes[idx(i, j - 1, k, c)] +
            nodes[idx(i, j + 1, k, c)] +
            nodes[idx(i, j, k - 1, c)] +
            nodes[idx(i, j, k + 1, c)] -
            6 * center;
          E += lap * lap;
        }
      }
    }
  }
  return E;
};
