import { cartesianToPolar } from "../lib/cartesianToPolar.js";
import { config } from "../config.js";

/**
 * Generate color wheel: A function that generates a hue-driven color wheel on a square canvas. Returns nothing, but modifies the canvas.
 * @param {*} ctx
 */
export const generateColorWheel = (ctx, whiteOnly = false) => {
  for (let col = 0; col < config.x; col++) {
    for (let row = 0; row < config.y; row++) {
      const [theta, radius] = cartesianToPolar(col, row); // Theta is in radians, radius is in pixels
      const hue = theta / (2 * Math.PI);
      if (radius < 250) {
        // const lightness = whiteOnly ? 1 : 1 - (0.5 * radius) / 250;
        // const lightness = whiteOnly ? 1 : 0.5;
        // const lightness = 0;
        // const lightness = 0.5;
        const lightness = 1 - radius / 250;
        ctx.fillStyle = `hsl(${hue * 360},${1 * 100}%,${lightness * 100}%)`;
        // ctx.fillStyle = `rgb(0,0,0)`;
        ctx.fillRect(col, row, 1, 1);
      } else {
        ctx.fillStyle = "#00000000";
        ctx.fillRect(col, row, 1, 1);
      }
    }
  }
};
