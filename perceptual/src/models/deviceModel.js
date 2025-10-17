// Stub forward model p(): device -> LAB, to be backed by lcms `transicc` batch calls later.
export const p = async (deviceBatch /* Array<[C,M,Y,K]> or [C,M,Y,W] */) => {
  // TEMP: identity-ish placeholder mapping to LAB-like space to keep script plumbing testable.
  // We’ll replace with real A2B sampling next step.
  return deviceBatch.map(([c, m, y, k]) => {
    const L = 100 * (1 - Math.min(1, (c + m + y + k) / 3));
    const a = 80 * (m - c);
    const b = 80 * (y - (c + m) / 2);
    return [L, a, b];
  });
};
