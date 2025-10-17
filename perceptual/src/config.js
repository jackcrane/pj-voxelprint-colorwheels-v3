export const config = {
  paths: {
    projectRoot: process.cwd(),
    printerICC:
      process.env.PRINTER_PROFILE_PATH ??
      "/Users/jackcrane/Documents/programming/pj-voxelprint-colorwheels-v3/shared/Tavor_Xrite_i1Profiler_VividCMYW.icc",
    sourceICC:
      process.env.SRGB_PROFILE_PATH ??
      "/System/Library/ColorSync/Profiles/sRGB Profile.icc",
    outDir: "out",
    refsJson: "out/references.json",
    clutJson: "out/clut.json", // current B nodes (device values)
    clutOptJson: "out/clut_optimized.json",
  },
  grid: {
    // LAB lattice density (tune later: 33 or 65 for real runs)
    nL: 21,
    nA: 17,
    nB: 17,
    Lmin: 0,
    Lmax: 100,
    Amin: -80,
    Amax: 80,
    Bmin: -80,
    Bmax: 80,
  },
  icid: {
    window: 7,
    wc: 1.0,
    wh: 1.0,
    wL: 1.0,
  },
  smoothness: {
    lambda: 1e-3,
  },
  optimize: {
    step: 0.1,
    iters: 50,
    clipMin: 0,
    clipMax: 1,
  },
};
