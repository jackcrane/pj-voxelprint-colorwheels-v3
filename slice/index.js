// halftone-slice.js
// ES modules, named exports, arrow functions. Ready to paste.
// Usage: node halftone-slice.js in.tiff out.tiff
// Notes:
//  • Strict palette: Cyan, Magenta, Yellow, White, and Black (void). No other colors ever written.
//  • Black is used for VOID on both input (alpha≈0 or very dark) and output.
//  • Quantization is done in CIE Lab (perceptual), error diffusion in *linear* RGB to reduce banding.
//  • Adds tiny blue-noise to fight contouring while staying within palette.

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

// ---------- paths / config ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ICC_PATH = path.resolve(
  __dirname,
  "../shared/Tavor_Xrite_i1Profiler_VividCMYW.icc"
);

// Palette: CMYW + BLACK (void)
const PALETTE = [
  { name: "cyan", rgb: [0, 255, 255] },
  { name: "magenta", rgb: [255, 0, 255] },
  { name: "yellow", rgb: [255, 255, 0] },
  { name: "white", rgb: [255, 255, 255] },
  { name: "black", rgb: [0, 0, 0] }, // VOID
];

// Consider pixels with low alpha OR very low luminance as VOID
const VOID_ALPHA_THRESHOLD = 16; // 0..255
const VOID_LUMA_THRESHOLD = 8; // 0..255 in sRGB (very dark becomes black)

// Dithering
const SERPENTINE = true;
const NOISE_STRENGTH = 0.75; // add small blue-noise in linear RGB (0..255 scale) to suppress banding

// ---------- math utils ----------
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

// sRGB <-> linear
const srgbToLin01 = (c) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};
const lin01ToSrgb = (x) => {
  return x <= 0.0031308
    ? 255 * (12.92 * x)
    : 255 * (1.055 * Math.pow(x, 1 / 2.4) - 0.055);
};

// XYZ/Lab (D65)
const linToXYZ = (r, g, b) => {
  const X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const Z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;
  return [X, Y, Z];
};
const xyzToLab = (X, Y, Z) => {
  const Xn = 0.95047,
    Yn = 1.0,
    Zn = 1.08883;
  const fx = f(X / Xn),
    fy = f(Y / Yn),
    fz = f(Z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  function f(t) {
    return t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29;
  }
};
const rgb8ToLab = (r8, g8, b8) => {
  const r = srgbToLin01(r8),
    g = srgbToLin01(g8),
    b = srgbToLin01(b8);
  const [X, Y, Z] = linToXYZ(r, g, b);
  return xyzToLab(X, Y, Z);
};
const deltaE2 = (a, b) => {
  const dl = a[0] - b[0],
    da = a[1] - b[1],
    db = a[2] - b[2];
  return dl * dl + da * da + db * db;
};

// Perceived sRGB luma (BT.709)
const luma8 = (r, g, b) => Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

// Blue-noise hash (tileable, deterministic)
const blueNoise = (x, y) => {
  // integer hash -> 0..1
  let n = x * 374761393 + y * 668265263; // big primes
  n = (n ^ (n >> 13)) >>> 0;
  n = (n * 1274126177) >>> 0;
  return (n & 0xffff) / 0xffff;
};

// Precompute palette in Lab and linear
const PAL = PALETTE.map((p) => {
  const [r, g, b] = p.rgb;
  return {
    ...p,
    lab: rgb8ToLab(r, g, b),
    lin: [srgbToLin01(r), srgbToLin01(g), srgbToLin01(b)],
  };
});

// ---------- core ----------
export const halftoneSlice = async (inputPath, outputPath) => {
  const base = sharp(inputPath, { unlimited: true }).toColourspace("srgb");
  const meta = await base.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) throw new Error("Failed to read image dimensions.");

  const { data } = await base
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Buffers:
  // errLin: linear RGB working buffer for diffusion (float32 per channel)
  // out: final palettized RGB (uint8)
  const errLin = new Float32Array(width * height * 3);
  const out = Buffer.alloc(width * height * 3);

  // Seed errLin with input (sRGB -> linear), add tiny blue-noise
  for (let i = 0; i < width * height; i++) {
    const r8 = data[4 * i + 0];
    const g8 = data[4 * i + 1];
    const b8 = data[4 * i + 2];
    const a8 = data[4 * i + 3];

    // VOID detection
    const isVoid =
      a8 <= VOID_ALPHA_THRESHOLD || luma8(r8, g8, b8) <= VOID_LUMA_THRESHOLD;

    if (isVoid) {
      errLin[3 * i + 0] = 0;
      errLin[3 * i + 1] = 0;
      errLin[3 * i + 2] = 0;
      continue;
    }

    const n =
      (blueNoise(i % width, (i / width) | 0) - 0.5) * (NOISE_STRENGTH / 255);
    errLin[3 * i + 0] = srgbToLin01(r8) + n;
    errLin[3 * i + 1] = srgbToLin01(g8) + n;
    errLin[3 * i + 2] = srgbToLin01(b8) + n;
  }

  // Diffusion helpers
  const diffuse = (xx, yy, dr, dg, db, w) => {
    if (xx < 0 || xx >= width || yy < 0 || yy >= height) return;
    const j = (yy * width + xx) * 3;
    errLin[j + 0] += dr * w;
    errLin[j + 1] += dg * w;
    errLin[j + 2] += db * w;
  };

  // Process
  for (let y = 0; y < height; y++) {
    const serp = SERPENTINE && y & 1;
    const xStart = serp ? width - 1 : 0;
    const xEnd = serp ? -1 : width;
    const xStep = serp ? -1 : 1;

    for (let x = xStart; x !== xEnd; x += xStep) {
      const idx = y * width + x;
      const j = idx * 3;

      // Current linear color -> sRGB8 for palette search space (perceptual match in Lab)
      let r8 = clamp255(
        Math.round(lin01ToSrgb(Math.max(0, Math.min(1, errLin[j + 0]))))
      );
      let g8 = clamp255(
        Math.round(lin01ToSrgb(Math.max(0, Math.min(1, errLin[j + 1]))))
      );
      let b8 = clamp255(
        Math.round(lin01ToSrgb(Math.max(0, Math.min(1, errLin[j + 2]))))
      );

      // VOID re-check (avoids accidental tint in near-black regions)
      if (luma8(r8, g8, b8) <= VOID_LUMA_THRESHOLD) {
        out[j + 0] = 0;
        out[j + 1] = 0;
        out[j + 2] = 0;
        // No error to diffuse (already black)
        continue;
      }

      // Find nearest palette color in Lab
      const lab = rgb8ToLab(r8, g8, b8);
      let best = PAL[0],
        bestD = deltaE2(lab, PAL[0].lab);
      for (let k = 1; k < PAL.length; k++) {
        const d = deltaE2(lab, PAL[k].lab);
        if (d < bestD) {
          bestD = d;
          best = PAL[k];
        }
      }

      // Write exact palette RGB
      out[j + 0] = best.rgb[0];
      out[j + 1] = best.rgb[1];
      out[j + 2] = best.rgb[2];

      // Compute error in *linear* domain
      const qr = best.lin[0],
        qg = best.lin[1],
        qb = best.lin[2];
      const cr = Math.max(0, Math.min(1, errLin[j + 0]));
      const cg = Math.max(0, Math.min(1, errLin[j + 1]));
      const cb = Math.max(0, Math.min(1, errLin[j + 2]));
      const er = cr - qr,
        eg = cg - qg,
        eb = cb - qb;

      // Floyd–Steinberg diffusion pattern
      if (!serp) {
        diffuse(x + 1, y, er, eg, eb, 7 / 16);
        diffuse(x - 1, y + 1, er, eg, eb, 3 / 16);
        diffuse(x, y + 1, er, eg, eb, 5 / 16);
        diffuse(x + 1, y + 1, er, eg, eb, 1 / 16);
      } else {
        diffuse(x - 1, y, er, eg, eb, 7 / 16);
        diffuse(x + 1, y + 1, er, eg, eb, 3 / 16);
        diffuse(x, y + 1, er, eg, eb, 5 / 16);
        diffuse(x - 1, y + 1, er, eg, eb, 1 / 16);
      }
    }
  }

  // Write TIFF with ICC
  let outImg = sharp(out, { raw: { width, height, channels: 3 } }).tiff({
    compression: "lzw",
    predictor: "horizontal",
  });
  if (fs.existsSync(ICC_PATH)) outImg = outImg.withMetadata({ icc: ICC_PATH });
  await outImg.toFile(outputPath);
};

// ---------- CLI ----------
export const runCli = async () => {
  if (process.argv.length < 4) {
    console.error("Usage: node halftone-slice.js <in.tiff> <out.tiff>");
    process.exit(1);
  }
  const inPath = path.resolve(process.argv[2]);
  const outPath = path.resolve(process.argv[3]);

  try {
    await halftoneSlice(inPath, outPath);
    console.log(`Wrote halftoned slice -> ${outPath}`);
  } catch (e) {
    console.error(e?.stack || String(e));
    process.exit(1);
  }
};

if (import.meta.url === `file://${__filename}`) runCli();
