export const linspace = (min, max, n) => {
  const out = new Array(n);
  const step = (max - min) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = min + i * step;
  return out;
};

export const makeLabGrid = (cfg) => {
  const Ls = linspace(cfg.Lmin, cfg.Lmax, cfg.nL);
  const As = linspace(cfg.Amin, cfg.Amax, cfg.nA);
  const Bs = linspace(cfg.Bmin, cfg.Bmax, cfg.nB);
  return { Ls, As, Bs };
};
