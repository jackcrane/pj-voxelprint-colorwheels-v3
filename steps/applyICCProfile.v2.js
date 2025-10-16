// apply-icc.js
// Usage:
//   import { applyIccToImage } from "./apply-icc.js";
//   await applyIccToImage({
//     inputPath: "in.jpg",
//     outputPath: "out.jpg",
//     dstProfilePath: "./Tavor_Xrite_i1Profiler_VividCMYW.icc",
//     intent: "perceptual", // optional: perceptual|relative|saturation|absolute
//   });

import { readFile } from "fs/promises";
import sharp from "sharp";
import { instantiate, cmsInfoDescription } from "lcms-wasm";

const INTENTS = {
  perceptual: 0,
  relative: 1,
  saturation: 2,
  absolute: 3,
};

const pickIntent = (s) =>
  INTENTS[(s || "perceptual").toLowerCase()] ?? INTENTS.perceptual;

export const applyIccToImage = async ({
  inputPath,
  outputPath,
  dstProfilePath,
  intent = "perceptual",
}) => {
  const lcms = await instantiate();

  // 1) Decode to raw RGBA8 (Buffer is a Uint8Array subclass, but we'll copy views explicitly).
  const img = sharp(inputPath).ensureAlpha();
  const { width, height } = await img.metadata();
  if (!width || !height) throw new Error("Could not read image dimensions.");

  const rgba = await img.raw().toBuffer(); // Node Buffer (Uint8Array-like)
  const nPixels = width * height;

  // Split RGBA -> RGB, A
  const srcRGBA = new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  const srcRGB = new Uint8Array(nPixels * 3);
  const srcA = new Uint8Array(nPixels);
  for (let i = 0, j = 0, k = 0; i < srcRGBA.length; i += 4) {
    srcRGB[j++] = srcRGBA[i]; // R
    srcRGB[j++] = srcRGBA[i + 1]; // G
    srcRGB[j++] = srcRGBA[i + 2]; // B
    srcA[k++] = srcRGBA[i + 3]; // A
  }

  // 2) Profiles
  const srgb = lcms.cmsCreate_sRGBProfile();
  if (!srgb) throw new Error("Could not create sRGB profile.");

  const iccBufNode = await readFile(dstProfilePath);
  const iccBuf = new Uint8Array(
    iccBufNode.buffer,
    iccBufNode.byteOffset,
    iccBufNode.byteLength
  );
  const dstProf = lcms.cmsOpenProfileFromMem(iccBuf, iccBuf.byteLength);
  if (!dstProf) {
    lcms.cmsCloseProfile(srgb);
    throw new Error(`Could not open profile: ${dstProfilePath}`);
  }

  const name =
    lcms.cmsGetProfileInfoASCII(dstProf, cmsInfoDescription, "en", "US") ||
    "(unnamed)";
  const space = lcms.cmsGetColorSpaceASCII(dstProf) || "?";
  console.log(`Using profile: ${name} [${space}]`);

  // 3) Build transform
  const TYPE_RGB_8 = lcms.TYPE_RGB_8;
  const INTENT = pickIntent(intent);
  const FLAGS = 0;

  let xform = null;
  let outColorSpaceIsRGB = space.trim().toUpperCase().startsWith("RGB");

  if (outColorSpaceIsRGB) {
    // Direct RGB->RGB
    xform = lcms.cmsCreateTransform(
      srgb,
      TYPE_RGB_8,
      dstProf,
      TYPE_RGB_8,
      INTENT,
      FLAGS
    );
  } else {
    // Soft-proof to sRGB (simulate printer profile in display space)
    // Input: sRGB, Proof: dstProf, Output: sRGB
    const sRGBout = srgb; // reuse the same sRGB profile for output
    const PROOF_FLAGS = lcms.cmsFLAGS_SOFTPROOFING;
    xform = lcms.cmsCreateProofingTransform(
      srgb,
      TYPE_RGB_8,
      sRGBout,
      TYPE_RGB_8,
      dstProf,
      INTENT,
      INTENT, // proofing intent (often relative or perceptual)
      PROOF_FLAGS
    );
    outColorSpaceIsRGB = true; // output is sRGB after proofing
  }

  if (!xform) {
    lcms.cmsCloseProfile(dstProf);
    lcms.cmsCloseProfile(srgb);
    throw new Error("Failed to create LCMS transform.");
  }

  // 4) Transform RGB (Uint8Array -> Uint8Array). No Uint32Array anywhere.
  const dstRGB = new Uint8Array(srcRGB.length);
  lcms.cmsDoTransform(xform, srcRGB, dstRGB, nPixels);

  // 5) Rebuild RGBA
  const outRGBA = new Uint8Array(nPixels * 4);
  for (let i = 0, j = 0, k = 0; j < dstRGB.length; i += 4, j += 3, k++) {
    outRGBA[i] = dstRGB[j];
    outRGBA[i + 1] = dstRGB[j + 1];
    outRGBA[i + 2] = dstRGB[j + 2];
    outRGBA[i + 3] = srcA[k];
  }

  // 6) Encode. If we did direct RGB->RGB with a real RGB profile, embed it.
  // If we soft-proofed, we keep standard sRGB embedding (proofing doesn't change the file's color space).
  const embedICC =
    outColorSpaceIsRGB && space.trim().toUpperCase().startsWith("RGB")
      ? iccBufNode
      : null;

  const out = sharp(outRGBA, {
    raw: { width, height, channels: 4 },
  });

  if (embedICC) {
    await out.withMetadata({ icc: embedICC }).toFile(outputPath);
  } else {
    await out
      .withMetadata({ icc: await sharp.icc.get("srgb") })
      .toFile(outputPath);
  }

  // 7) Cleanup
  lcms.cmsDeleteTransform(xform);
  lcms.cmsCloseProfile(dstProf);
  lcms.cmsCloseProfile(srgb);
};

export const describeProfile = async (profilePath) => {
  const lcms = await instantiate();
  const bufNode = await readFile(profilePath);
  const buf = new Uint8Array(
    bufNode.buffer,
    bufNode.byteOffset,
    bufNode.byteLength
  );
  const prof = lcms.cmsOpenProfileFromMem(buf, buf.byteLength);
  if (!prof) throw new Error(`could not open profile ${profilePath}`);
  const name = lcms.cmsGetProfileInfoASCII(
    prof,
    cmsInfoDescription,
    "en",
    "US"
  );
  const space = lcms.cmsGetColorSpaceASCII(prof);
  lcms.cmsCloseProfile(prof);
  return { name, space };
};

applyIccToImage({
  inputPath:
    "/Users/jackcrane/Documents/programming/slucam/color-wheel-v3/frames/1-generated-0.png",
  outputPath:
    "/Users/jackcrane/Documents/programming/slucam/color-wheel-v3/frames/2.1-icc-lcms.png",
  dstProfilePath:
    "/Users/jackcrane/Documents/programming/slucam/color-wheel-v3/Tavor_Xrite_i1Profiler_VividCMYW.icc",
});
