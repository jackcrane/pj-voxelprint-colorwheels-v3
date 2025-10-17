// Placeholder iCID-like metric: channel-weighted, locally-averaged LAB differences.
// We’ll refine weights/blur mechanics next step.
export const icid = (
  LabFieldA,
  LabFieldB,
  { wL = 1, wc = 1, wh = 1, window = 7 } = {}
) => {
  // LabField* are Float32Array fields or flat arrays [N,3]; here we accept arrays of [L,a,b].
  const n = LabFieldA.length;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const [L1, a1, b1] = LabFieldA[i];
    const [L2, a2, b2] = LabFieldB[i];
    const dL = Math.abs(L2 - L1);
    const C1 = Math.hypot(a1, b1),
      C2 = Math.hypot(a2, b2);
    const dC = Math.abs(C2 - C1);
    let h1 = Math.atan2(b1, a1),
      h2 = Math.atan2(b2, a2);
    let dh = Math.abs(h2 - h1);
    if (dh > Math.PI) dh = 2 * Math.PI - dh;
    acc += wL * dL + wc * dC + wh * dh;
  }
  return acc / n;
};
