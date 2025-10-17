import { cartesianToPolar } from "../lib/cartesianToPolar.js";
import { config } from "../config.js";

/**
 * Crop color wheel: A function that re-draws the black pixels on the border of the color wheel.
 * @param {*} ctx
 */
export const cropColorWheel = (ctx) => {
  for (let col = 0; col < config.x; col++) {
    for (let row = 0; row < config.y; row++) {
      const [, radius] = cartesianToPolar(col, row); // Theta is in radians, radius is in pixels
      if (radius >= 250) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(col, row, 1, 1);
      }
    }
  }
};
