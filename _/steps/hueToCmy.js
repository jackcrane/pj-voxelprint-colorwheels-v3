export const hueToCmy = (hue) => {
  hue = hue % 360; // Normalize the hue to be within 0-360 degrees
  let c = 0,
    m = 0,
    y = 0;

  if (hue < 60) {
    c = 0;
    m = ((60 - hue) / 60) * 0.5;
    y = 1 - m;
  } else if (hue < 180) {
    m = 0;
    y = (180 - hue) / 120;
    c = 1 - y;
  } else if (hue < 300) {
    c = (300 - hue) / 120;
    m = 1 - c;
    y = 0;
  } else {
    m = (420 - hue) / 120;
    y = 1 - m;
    c = 0;
  }
  return [c, m, y];
};
