import fs from "fs";
import path from "path";

export const ensureDir = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};

export const writeJson = (p, obj) => {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj));
};

export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
