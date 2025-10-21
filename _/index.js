// _/index.js

import { createCanvas } from "canvas";
import { config } from "./config.js";
import { writeFileSync } from "fs";
import { generateColorWheel } from "./steps/generateColorWheel.js";
import {
  applyICCProfile,
  PRINTER_PROFILE_PATH,
  SRGB_PROFILE_PATH,
} from "./steps/applyICCProfile.js";
import { cropColorWheel } from "./steps/cropColorWheel.js";
import { paintSolidColor } from "./steps/paintSolidColor.js";
import sharp from "sharp";

let savecanvascalled = 0;
export const saveCanvas = async (
  name,
  dir = "frames",
  suppliedCanvas = canvas,
  options = {}
) => {
  savecanvascalled++;
  const { iccProfilePath = SRGB_PROFILE_PATH } = options;
  const buf = suppliedCanvas.toBuffer("image/png");

  // Apply the ICC profile using sharp (tagging for previews only)
  const tagged = await sharp(buf)
    .withMetadata({ icc: iccProfilePath })
    .png()
    .toBuffer();

  writeFileSync(`${dir}/${name}.png`, tagged);
};

const canvas = createCanvas(config.x, config.y);
const ctx = canvas.getContext("2d");

const wideCanvas = createCanvas(config.x * 2, config.y);
const wideCtx = wideCanvas.getContext("2d");

for (let i = 0; i < 100; i++) {
  // Clear the canvas so we start with a fresh state.
  ctx.clearRect(0, 0, config.x, config.y);

  // Generate a new color wheel.
  generateColorWheel(ctx, i < 38);
  if (i === 0) {
    await saveCanvas(`1-generated-${i}`);
  }

  // Apply the ICC profile (now returns diagnostics)
  const diag = await applyICCProfile(ctx, canvas);
  if (i === 0) {
    console.log(
      `[ICC] first-hit summary: channels=${diag?.metadata?.channels}, depth=${diag?.metadata?.depth}, format=${diag?.metadata?.format}`
    );
    // If channels === 3, you're still in RGB (not separations). That's the thing we’ll fix next.
  }
  if (i === 0) {
    await saveCanvas(`2-icc-${i}`, "frames", canvas, {
      iccProfilePath: PRINTER_PROFILE_PATH,
    });
  }

  // Crop the color wheel.
  cropColorWheel(ctx);
  if (i === 0) {
    await saveCanvas(`3-cropped-${i}`);
  }

  const startTime = performance.now();
  const ditheredColors = new Array(config.y)
    .fill(0)
    .map(() => new Array(config.x).fill(0));
  for (let col = 0; col < config.x; col++) {
    for (let row = 0; row < config.y; row++) {
      const psc = paintSolidColor(ctx, col, row);
      ditheredColors[row][col] = psc;
      const color = ctx.getImageData(col, row, 1, 1).data;
      wideCtx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      wideCtx.fillRect(col * 2, row, 2, 1);
    }
  }

  if (i === 0) {
    await saveCanvas(`4-dithered-${i}`);
  }
  if (i === 0) {
    await saveCanvas(`5-scale-${i}`, "frames", wideCanvas);
  }

  const frameName = i.toString().padStart(4, "0");
  await saveCanvas("layer_" + frameName, "layers", wideCanvas);

  const endTime = performance.now();
  console.log(i, endTime - startTime);
}
