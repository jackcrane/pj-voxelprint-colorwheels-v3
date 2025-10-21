#!/usr/bin/env node
// halftone.js — `node halftone.js in.png out_dir <numLayers>`
// Nondeterministic CMY threshold halftoning for PolyJet printing.
// Transparent (void) input areas become black pixels in output.

import fs from "fs";
import path from "path";
import sharp from "sharp";

/** ---- palette ---- */
export const PALETTE = {
  cyan: "#00FFFF",
  magenta: "#FF00FF",
  yellow: "#FFFF00",
  white: "#FFFFFF",
  clear: "#000000", // explicitly black for voids
  black: "#F0F0F0", // light gray
};

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const LUMA = (r, g, b) =>
  0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);

/** ---- halftoning for a single output image ---- */
export const halftoneImage = async (inputPath, outputPath) => {
  const img = sharp(inputPath, { limitInputPixels: false });
  const { width, height } = await img.metadata();
  const raw = await img.ensureAlpha().raw().toBuffer(); // RGBA

  const out = Buffer.alloc(width * height * 4);

  const RGBA = Object.fromEntries(
    Object.entries(PALETTE).map(([k, hex]) => [k, [...hexToRgb(hex), 255]])
  );

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const r = raw[idx + 0];
    const g = raw[idx + 1];
    const b = raw[idx + 2];
    const a = raw[idx + 3];

    if (a < 5) {
      // transparent = void → black pixel
      out.set([0, 0, 0, 255], idx);
      continue;
    }

    // Convert to subtractive CMY thresholds [0,1]
    const rn = r / 255,
      gn = g / 255,
      bn = b / 255;
    const c = 1 - rn;
    const m = 1 - gn;
    const y = 1 - bn;

    // stochastic screening
    const passC = Math.random() < c;
    const passM = Math.random() < m;
    const passY = Math.random() < y;

    const candidates = [];
    if (passC) candidates.push("cyan");
    if (passM) candidates.push("magenta");
    if (passY) candidates.push("yellow");

    let chosen;
    if (candidates.length > 0) {
      chosen = candidates[(Math.random() * candidates.length) | 0];
    } else {
      const l = LUMA(r, g, b);
      chosen = l > 0.9 ? "white" : l < 0.1 ? "black" : "white";
    }

    const [R, G, B, A] = RGBA[chosen];
    out.set([R, G, B, A], idx);
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outputPath);
};

/** ---- CLI ---- */
const main = async () => {
  const [, , inPath, outDir, layersArg] = process.argv;

  if (!inPath || !outDir || !layersArg) {
    console.error(
      "Usage: node halftone.js <in.png> <out_dir> <numLayers>\n" +
        "Example: node halftone.js in.png ./out 12"
    );
    process.exit(1);
  }

  if (!fs.existsSync(inPath)) {
    console.error(`Input not found: ${inPath}`);
    process.exit(1);
  }

  const nLayers = Number(layersArg);
  if (!Number.isInteger(nLayers) || nLayers <= 0) {
    console.error(`Invalid <numLayers>: ${layersArg}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  // zero-padding: at least 2 digits, or enough for nLayers-1
  const pad = Math.max(2, String(nLayers - 1).length);

  for (let i = 0; i < nLayers; i++) {
    const name = `layer_${String(i).padStart(pad, "0")}.png`;
    const outPath = path.join(outDir, name);
    await halftoneImage(inPath, outPath);
    // Optional: log progress
    // console.error(`Wrote ${outPath}`);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
