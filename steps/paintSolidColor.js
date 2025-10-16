import { cartesianToPolar } from "../lib/cartesianToPolar.js";
import { config } from "../config.js";
import { hueToCmy } from "./hueToCMY.js";
import { rgbToHsv } from "./rgbToHsv.js";
const colors = [];

export const paintSolidColor = (ctx, x, y) => {
  const [, radius] = cartesianToPolar(x, y);
  if (radius >= 250) {
    return;
  }

  const color = ctx.getImageData(x, y, 1, 1).data;
  let colorInHsv = rgbToHsv(...color);

  let [_cyanThreshold, _magentaThreshold, _yellowThreshold] = hueToCmy(
    colorInHsv[0]
  );
  let cyanThreshold = _cyanThreshold ** 2;
  let magentaThreshold = _magentaThreshold ** 2;
  let yellowThreshold = _yellowThreshold ** 2;

  // console.log(x, y, [
  //   colorInHsv,
  //   [_cyanThreshold, _magentaThreshold, _yellowThreshold],
  // ]);

  const totalThreshold = cyanThreshold + magentaThreshold + yellowThreshold;
  // Avoid division by zero; default to cyan when hue data is unavailable.
  const threshold = totalThreshold > 0 ? Math.random() * totalThreshold : 0;
  if (threshold < cyanThreshold) {
    ctx.fillStyle = config.colors.cyan;
  } else if (threshold < magentaThreshold + cyanThreshold) {
    ctx.fillStyle = config.colors.magenta;
  } else {
    ctx.fillStyle = config.colors.yellow;
  }
  ctx.fillRect(x, y, 1, 1);

  return [colorInHsv, cyanThreshold, magentaThreshold, yellowThreshold];
};
