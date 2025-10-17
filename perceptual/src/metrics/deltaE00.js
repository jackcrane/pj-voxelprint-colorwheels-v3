// Full ΔE00 (standalone). Named export, arrow function.
export const deltaE00 = (Lab1, Lab2) => {
  const [L1, a1, b1] = Lab1,
    [L2, a2, b2] = Lab2;
  const kL = 1,
    kC = 1,
    kH = 1;
  const pow = Math.pow;
  const sqrt = Math.sqrt;
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const C1 = sqrt(a1 * a1 + b1 * b1);
  const C2 = sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - sqrt(pow(Cbar, 7) / (pow(Cbar, 7) + pow(25, 7))));
  const a1p = (1 + G) * a1,
    a2p = (1 + G) * a2;
  const C1p = sqrt(a1p * a1p + b1 * b1),
    C2p = sqrt(a2p * a2p + b2 * b2);
  const h1p = (Math.atan2(b1, a1p) * deg + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) * deg + 360) % 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else dhp = h2p <= h1p ? h2p - h1p + 360 : h2p - h1p - 360;
  const dHp = 2 * sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = 0;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else hbarp = ((h1p + h2p + 360) / 2) * (h1p + h2p < 360 ? 1 : 1);
  if (hbarp >= 360) hbarp -= 360;

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * rad) +
    0.24 * Math.cos(2 * hbarp * rad) +
    0.32 * Math.cos((3 * hbarp + 6) * rad) -
    0.2 * Math.cos((4 * hbarp - 63) * rad);
  const Sl = 1 + (0.015 * pow(Lbarp - 50, 2)) / sqrt(20 + pow(Lbarp - 50, 2));
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt =
    -2 *
    sqrt(pow(Cbarp, 7) / (pow(Cbarp, 7) + pow(25, 7))) *
    Math.sin(60 * Math.exp(-pow((hbarp - 275) / 25, 2)) * rad);

  return sqrt(
    pow(dLp / (kL * Sl), 2) +
      pow(dCp / (kC * Sc), 2) +
      pow(dHp / (kH * Sh), 2) +
      Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh))
  );
};
