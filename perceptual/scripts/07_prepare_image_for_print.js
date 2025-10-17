import { execFile } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { config } from "../src/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runTransicc = (args) =>
  new Promise((resolve, reject) => {
    execFile("transicc", args, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout);
    });
  });

/**
 * prepareImageForPrint
 * Converts input RGB image → printer CMYW TIFF using printer ICC.
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {string} intent default '0' (perceptual)
 */
export const prepareImageForPrint = async (
  inputPath,
  outputPath = "print_ready.tif",
  intent = "0"
) => {
  const printerICC = path.resolve(config.paths.printerICC);
  if (!fs.existsSync(printerICC))
    throw new Error(`Printer ICC not found: ${printerICC}`);

  const absIn = path.resolve(inputPath);
  const absOut = path.resolve(outputPath);

  // Use LittleCMS transicc for ICC-accurate conversion
  const args = [
    "-i",
    "/System/Library/ColorSync/Profiles/sRGB Profile.icc",
    "-o",
    printerICC,
    `-t${intent}`,
    "-n",
    absIn,
    "-o",
    absOut,
  ];

  console.log("→ Running:", ["transicc", ...args].join(" "));
  await runTransicc(args);
  console.log("✓ Wrote", absOut);

  // Optional: quick verify via Sharp
  const meta = await sharp(absOut).metadata();
  console.log("Output:", meta);
};

if (process.argv[2]) {
  prepareImageForPrint(process.argv[2], process.argv[3] || "print_ready.tif");
} else {
  console.log(
    "Usage: node scripts/07_prepare_image_for_print.js input.png [output.tif]"
  );
}

export const run = prepareImageForPrint;
