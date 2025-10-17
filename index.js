import { createCanvas } from "canvas";
import { config } from "./config.js";
import { writeFileSync } from "fs";
import { generateColorWheel } from "./steps/generateColorWheel.js";
import { applyICCProfile } from "./steps/applyICCProfile.js";
import { cropColorWheel } from "./steps/cropColorWheel.js";
import { paintSolidColor } from "./steps/paintSolidColor.js";
import sharp from "sharp";

let savecanvascalled = 0;
export const saveCanvas = async (
  name,
  dir = "frames",
  suppliedCanvas = canvas
) => {
  savecanvascalled++;
  const buf = suppliedCanvas.toBuffer("image/png");

  // macOS system sRGB profile
  const sRGB_PROFILE = "/System/Library/ColorSync/Profiles/sRGB Profile.icc";

  // Apply the ICC profile using sharp
  const tagged = await sharp(buf)
    .withMetadata({ icc: sRGB_PROFILE })
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
  // Optionally, save the generated wheel:
  i == 0 && saveCanvas(`1-generated-${i}`);

  // Apply the ICC profile.
  await applyICCProfile(ctx, canvas);
  // Optionally, save the ICC–corrected wheel:
  i == 0 && saveCanvas(`2-icc-${i}`);

  // Crop the color wheel.
  cropColorWheel(ctx);
  // Optionally, save the cropped wheel:
  i == 0 && saveCanvas(`3-cropped-${i}`);

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
  // writeFileSync(`./frames/dithered-${i}.json`, JSON.stringify(ditheredColors));

  i == 0 && saveCanvas(`4-dithered-${i}`);
  i == 0 && saveCanvas(`5-scale-${i}`, "frames", wideCanvas);

  // for (let f = 0; f < 100; f += 25) {
  //   const frameName = (i + f).toString().padStart(4, "0");
  //   saveCanvas(frameName, "layers", wideCanvas);
  // }
  const frameName = i.toString().padStart(4, "0");
  saveCanvas("layer_" + frameName, "layers", wideCanvas);

  const endTime = performance.now();
  console.log(i, endTime - startTime);
}

// saveCanvas("final");
// check();
