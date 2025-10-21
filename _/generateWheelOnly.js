import { createCanvas } from "canvas";
import { generateColorWheel } from "./steps/generateColorWheel.js";
import { writeFileSync } from "fs";
import { config } from "./config.js";

const canvas = createCanvas(config.x, config.y);
const ctx = canvas.getContext("2d");
generateColorWheel(ctx);
const outPath = "wheel.png";
writeFileSync(outPath, canvas.toBuffer("image/png"));
console.log(`Wrote ${outPath}`);
