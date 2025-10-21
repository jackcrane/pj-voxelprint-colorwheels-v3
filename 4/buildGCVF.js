#!/usr/bin/env node
// buildGCVF.js — Usage: node buildGCVF.js <inputDir> <outputName>
// Creates outputName.gcvf from 100 slices layer_0.png..layer_99.png

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** ---- constants ---- */
const EXPECTED_WIDTH = 1000;
const EXPECTED_HEIGHT = 500;
const EXPECTED_LAYERS = 100;
const COLOR_MAP = {
  "0,255,255,255": "VeroCY-V", // Cyan
  "255,0,255,255": "VeroMGT-V", // Magenta
  "255,255,0,255": "VeroYL-V", // Yellow
  "255,255,255,255": "VUltraWhite", // White
};

/** ---- helpers ---- */
const err = (msg) => {
  console.error("Error:", msg);
  process.exit(1);
};

const validateDir = (dir) => {
  if (!fs.existsSync(dir)) err(`Directory not found: ${dir}`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png"));
  if (files.length === 0) err("No PNG files found.");
  return files;
};

const normalizeName = (name) => {
  const match = name.match(/layer_(\d+)\.png$/i);
  if (!match) return null;
  return `layer_${parseInt(match[1])}.png`;
};

const countVoxels = async (dir, files) => {
  const totals = {};
  for (const file of files) {
    const fpath = path.join(dir, file);
    const img = sharp(fpath);
    const { data, info } = await img
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== EXPECTED_WIDTH || info.height !== EXPECTED_HEIGHT)
      err(
        `Invalid size in ${file}. Expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`
      );

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3];
      const key = `${r},${g},${b},${a}`;
      if (key === "0,0,0,255") continue; // ignore black
      if (!COLOR_MAP[key]) continue;
      totals[key] = (totals[key] || 0) + 1;
    }
  }
  return totals;
};

const writeXML = (totals, outDir) => {
  const materials = Object.entries(totals)
    .map(([rgba, count]) => {
      const name = COLOR_MAP[rgba];
      const parts = rgba.split(",").join(" ");
      return `        <Material>
            <Name>${name}</Name>
            <RGBA>${parts}</RGBA>
            <VoxelCount>${count}</VoxelCount>
        </Material>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--  GCVF - GrabCad Voxel Print File  -  -->
<GCVF>
    <Version>2</Version>
    <Resolution>
        <XDpi>600</XDpi>
        <YDpi>300</YDpi>
        <SliceThicknessNanoMeter>27000</SliceThicknessNanoMeter>
    </Resolution>
    <SliceDimensions>
        <SliceWidth>${EXPECTED_WIDTH}</SliceWidth>
        <SliceHeight>${EXPECTED_HEIGHT}</SliceHeight>
    </SliceDimensions>
    <SliceRange>
        <StartIndex>0</StartIndex>
        <NumberOfSlices>${EXPECTED_LAYERS}</NumberOfSlices>
    </SliceRange>
    <BitDepth>4</BitDepth>
    <MaxNumberOfColors>6</MaxNumberOfColors>
    <DataSemantics>Materials</DataSemantics>
    <CreationMode>MODEL_ONLY</CreationMode>
    <ImageFilePrefix>layer_</ImageFilePrefix>
    <MaterialList>
        <BackGroundMaterialRGBA>0 0 0 255</BackGroundMaterialRGBA>
${materials}
    </MaterialList>
</GCVF>
`;
  fs.writeFileSync(path.join(outDir, "ConfigFile.xml"), xml);
};

const zipGCVF = (outName, sources) =>
  new Promise((resolve, reject) => {
    const output = fs.createWriteStream(`${outName}.gcvf`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    archive.on("error", (e) => reject(e));
    archive.pipe(output);
    sources.forEach(({ path: p, name }) => archive.file(p, { name }));
    archive.finalize();
  });

/** ---- main ---- */
const main = async () => {
  const [, , inputDirRaw, outputNameRaw] = process.argv;
  if (!inputDirRaw || !outputNameRaw)
    err("Usage: node buildGCVF.js <inputDir> <outputName>");

  const inputDir = path.resolve(inputDirRaw);
  const outputName = path.resolve(outputNameRaw);
  const files = validateDir(inputDir);

  const layerFiles = [];
  for (const f of files) {
    const normalized = normalizeName(f);
    if (!normalized) {
      console.warn(`⚠️  Ignoring non-layer file: ${f}`);
      continue;
    }
    const src = path.join(inputDir, f);
    const dst = path.join(inputDir, normalized);
    if (src !== dst) fs.renameSync(src, dst);
    layerFiles.push(normalized);
  }

  layerFiles.sort((a, b) => {
    const na = parseInt(a.match(/\d+/)[0]);
    const nb = parseInt(b.match(/\d+/)[0]);
    return na - nb;
  });

  if (layerFiles.length !== EXPECTED_LAYERS)
    err(`Expected ${EXPECTED_LAYERS} layers, found ${layerFiles.length}`);
  if (
    !layerFiles.includes("layer_0.png") ||
    !layerFiles.includes("layer_99.png")
  )
    err("Layer numbering must start at 0 and end at 99.");

  console.log("Counting voxels...");
  const totals = await countVoxels(inputDir, layerFiles);

  console.log("Generating ConfigFile.xml...");
  const tempDir = fs.mkdtempSync(path.join(__dirname, "tmp_gcvf_"));
  writeXML(totals, tempDir);

  console.log("Zipping...");
  console.log(path.join("gcvf_includes"));
  const includeDir = path.join("gcvf_includes");
  const includeFiles = fs.existsSync(includeDir)
    ? fs.readdirSync(includeDir).map((f) => ({
        path: path.join(includeDir, f),
        name: f,
      }))
    : [];

  const sources = [
    ...layerFiles.map((f) => ({ path: path.join(inputDir, f), name: f })),
    { path: path.join(tempDir, "ConfigFile.xml"), name: "ConfigFile.xml" },
    ...includeFiles,
  ];

  await zipGCVF(outputName, sources);
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log(`✅ Created ${outputName}.gcvf`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
