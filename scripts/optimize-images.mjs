import sharp from "sharp";
for (const name of ["grocery-hero", "product-atlas"])
  for (const width of name === "grocery-hero"
    ? [640, 1280, 1920]
    : [800, 1600]) {
    await sharp(`public/images/${name}.png`)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 85, effort: 6 })
      .toFile(`public/images/${name}-${width}.webp`);
  }
console.log("Optimized existing PNGs. No new artwork generated.");
