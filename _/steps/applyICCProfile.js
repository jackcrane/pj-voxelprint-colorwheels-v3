// color-icc.js
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { loadImage } from "canvas";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const resolveProfilePath = (label, rawPath, { baseDir = PROJECT_ROOT } = {}) => {
  const candidate = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(baseDir, rawPath);
  if (!fs.existsSync(candidate)) {
    throw new Error(`${label} ICC profile not found at ${candidate}`);
  }
  return candidate;
};

// macOS system sRGB profile (input/"from" profile)
const SRGB_PROFILE_PATH = resolveProfilePath(
  "Source (sRGB)",
  process.env.SRGB_PROFILE_PATH ??
    "/System/Library/ColorSync/Profiles/sRGB Profile.icc",
  { baseDir: PROJECT_ROOT }
);

// hardcoded printer output profile (allow env override)
const PRINTER_PROFILE_PATH = resolveProfilePath(
  "Printer",
  process.env.PRINTER_PROFILE_PATH ?? "Tavor_Xrite_i1Profiler_VividCMYW.icc"
);

const logProfilePaths = (() => {
  let logged = false;
  return () => {
    if (logged) return;
    logged = true;
    console.info(
      `Applying ICC profiles (source → printer): ${SRGB_PROFILE_PATH} → ${PRINTER_PROFILE_PATH}`
    );
  };
})();

// helper: promisified execFile
const execFileAsync = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve({ stdout, stderr });
    });
  });

/**
 * Apply ICC transform to the canvas using LittleCMS CLI tools.
 * Prefers lossless TIFF via `tificc`, falls back to `jpgicc`.
 */
export const applyICCProfile = async (ctx, canvas) => {
  logProfilePaths();
  const workdir = fs.mkdtempSync(path.join(__dirname, ".icc-"));
  const inTiff = path.join(workdir, "in.tif");
  const outTiff = path.join(workdir, "out.tif");

  try {
    // 1. Save canvas → PNG → TIFF (lossless)
    const inputPngBuf = canvas.toBuffer("image/png");
    const inputTiffBuf = await sharp(inputPngBuf)
      .tiff({ compression: "none" })
      .toBuffer();
    fs.writeFileSync(inTiff, inputTiffBuf);

    // 2. Try applying ICC with tificc (lossless)
    try {
      await execFileAsync("tificc", [
        "-i",
        SRGB_PROFILE_PATH,
        "-o",
        PRINTER_PROFILE_PATH,
        "-t",
        "0", // perceptual intent
        inTiff,
        outTiff,
      ]);
    } catch {
      // fallback to jpgicc (lossy)
      const inJpg = path.join(workdir, "in.jpg");
      const outJpg = path.join(workdir, "out.jpg");
      const jpgBuf = await sharp(inputPngBuf)
        .jpeg({ quality: 100, chromaSubsampling: "4:4:4" })
        .toBuffer();
      fs.writeFileSync(inJpg, jpgBuf);
      await execFileAsync("jpgicc", [
        "-i",
        SRGB_PROFILE_PATH,
        "-o",
        PRINTER_PROFILE_PATH,
        "-t",
        "0",
        inJpg,
        outJpg,
      ]);
      fs.renameSync(outJpg, outTiff);
    }

    // 3. Convert result → PNG for canvas
    const outPngBuf = await sharp(outTiff).png().toBuffer();
    const img = await loadImage(outPngBuf);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  } catch (err) {
    console.error("Error applying ICC profile:", err);
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
};

export { SRGB_PROFILE_PATH, PRINTER_PROFILE_PATH };
