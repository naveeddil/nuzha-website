// Extracts the restaurant's own dish photographs embedded in the official 2025 CorelDRAW menu
// (_images/CDR Menu/Nuzha Menu 2025.cdr) and publishes web-sized copies for the menu page.
//
// Usage (from nuzha-website):  node scripts/extract-cdr-menu-photos.mjs
//
// Output:
//   dist/menu-images/restaurant/*.jpg        web copies (square dish crops, max 900 px)
//   dist/menu-restaurant-images.json         "category|nameEn" -> image path (applied at runtime by menu.js)
//   _images/CDR Menu/Extracted Photos/*.jpg  full-resolution archive copies (uncropped)
//
// Notes on the CDR format (CorelDRAW 2020, zip container):
//   content/data/Bitmaps.dat stores raw, uncompressed rasters. Each raster header holds
//   width, height, planes(=1), bpp, bytesPerLine, imageSize (uint32 LE); pixels start 56 bytes
//   after the width field. 24 bpp = BGR, 32 bpp = CMYK. An 8 bpp raster of the same size that
//   immediately follows is the transparency mask.
//   The offsets below are specific to the 2025 file; the script validates each header and stops
//   if the artwork has been re-saved, in which case the offsets must be re-identified.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import {execFileSync} from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const project = path.resolve(root, "..");
const cdr = path.join(project, "_images", "CDR Menu", "Nuzha Menu 2025.cdr");
const dist = path.join(root, "dist");
const webDir = path.join(dist, "menu-images", "restaurant");
const archiveDir = path.join(project, "_images", "CDR Menu", "Extracted Photos");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nuzha-cdr-"));

// offset = byte offset of the raster width field inside Bitmaps.dat.
// crop: [centerX, centerY, sizeAsFractionOfShortSide] for the web square; "full" keeps the whole frame.
const photos = {
  "beef-barbecue":            {off: 282084034, w: 1024, h: 768},
  "lamb-ribs":                {off: 279724620, w: 768,  h: 1024},
  "chicken-kebab":            {off: 289567780, w: 1024, h: 768},
  "barbecue-quail":           {off: 272646378, w: 1024, h: 768},
  "half-charcoal-chicken":    {off: 275005792, w: 768,  h: 1024},
  "meat-kebab-kofta":         {off: 294141518, w: 768,  h: 1024},
  "grilled-chicken":          {off: 86675682,  w: 2032, h: 2232},
  "shish-tawook":             {off: 277365206, w: 768,  h: 1024},
  "mixed-bbq-plate":          {off: 287208366, w: 768,  h: 1024},
  "mixed-barbecue-platter":   {off: 231962436, w: 1180, h: 787, crop: "full"},
  "hummus":                   {off: 267927550, w: 1024, h: 768},
  "liver-with-tomato":        {off: 284443448, w: 720,  h: 1280, crop: [0.5, 0.53, 0.95]},
  "liver-with-kidney":        {off: 60600602,  w: 1880, h: 1862, whiteRef: [940, 120]},
  "mutton-kidneys":           {off: 251338042, w: 720,  h: 1280, crop: [0.5, 0.56, 0.95]},
  "meat-with-tomato":         {off: 259632796, w: 720,  h: 1280, crop: [0.5, 0.55, 0.95]},
  "full-fried-eggs":          {off: 256867878, w: 720,  h: 1280, crop: [0.5, 0.57, 0.95]},
  "half-fried-eggs":          {off: 254102960, w: 720,  h: 1280, crop: [0.5, 0.47, 0.95]},
  "lentil-soup":              {off: 243043288, w: 720,  h: 1280, crop: [0.5, 0.58, 0.95]},
  "foul":                     {off: 262397714, w: 720,  h: 1280, crop: [0.47, 0.54, 0.9]},
  "egg-omelet-shakshuka":     {off: 245808206, w: 720,  h: 1280, crop: [0.5, 0.57, 0.95]},
  "mandi-chicken-quarter":    {off: 265162632, w: 1280, h: 720,  crop: [0.51, 0.47, 0.95]},
  "mandi-chicken-half":       {off: 248573124, w: 1280, h: 720,  crop: [0.45, 0.48, 0.95]},
  "mandi-chicken-whole":      {off: 541948872, w: 1285, h: 728,  crop: [0.47, 0.5, 0.95]},
  "fresh-mandi-meat":         {off: 117596512, w: 1518, h: 1539},
  "grilled-chicken-quarter":  {off: 305658718, w: 720,  h: 1280, crop: [0.5, 0.56, 0.95]},
  "grilled-chicken-half":     {off: 308423636, w: 720,  h: 1280, crop: [0.5, 0.52, 0.95]},
  "grilled-chicken-whole":    {off: 78103598,  w: 1445, h: 1482},
  "plain-rice":               {off: 540361730, w: 642,  h: 618},
  "charcoal-chicken-rice":    {off: 62,        w: 1503, h: 1439},
  "imported-meat-rice":       {off: 126947672, w: 1551, h: 1592},
  "mandi-rice":               {off: 234748534, w: 720,  h: 1280, crop: [0.5, 0.5, 0.95]},
  "biryani-rice":             {off: 240278370, w: 720,  h: 1280, crop: [0.5, 0.5, 0.95]},
  "bukhari-rice":             {off: 237513452, w: 720,  h: 1280, crop: [0.5, 0.56, 0.95]},
  "white-rice":               {off: 647181068, w: 2401, h: 2560},
  "fried-fish":               {off: 185085960, w: 2731, h: 1591, crop: "full"},
  "broasted-chicken":         {off: 160778192, w: 1114, h: 731,  crop: [0.52, 0.5, 0.9]},
  "french-fries":             {off: 231196280, w: 490,  h: 390,  crop: "full"},
  "mixed-appetizers":         {off: 136831004, w: 2249, h: 2129},
  "green-salad":              {off: 270286964, w: 768,  h: 1024},
  "grape-leaf-salad":         {off: 311188554, w: 768,  h: 1024},
  "tabbouleh":                {off: 315907382, w: 768,  h: 1024},
  "mutabbal":                 {off: 313547968, w: 1024, h: 768},
  "cucumber-yogurt":          {off: 229113346, w: 1024, h: 678,  crop: "full"},
  "brinjal-curry":            {off: 319789550, w: 1087, h: 1082},
  "okra-curry":               {off: 303299304, w: 768,  h: 1024},
  "mixed-vegetable-curry":    {off: 300939890, w: 768,  h: 1024},
  "spinach-molokhia":         {off: 298580476, w: 768,  h: 1024},
  "potato-with-meat":         {off: 993605946, w: 474,  h: 632},
  "chicken-curry":            {off: 291927194, w: 745,  h: 742},
  "lentils":                  {off: 296500932, w: 722,  h: 719},
  "mutton-curry":             {off: 202472604, w: 768,  h: 1024}
};

// Menu item key ("category|nameEn" from menu-data.js) -> photo.
const assignments = {
  "bbq|Beef barbecue": "beef-barbecue",
  "bbq|Lamb ribs": "lamb-ribs",
  "bbq|Chicken kebab": "chicken-kebab",
  "bbq|Barbecue quail": "barbecue-quail",
  "bbq|Half charcoal chicken with bread": "half-charcoal-chicken",
  "bbq|Meat kebab (kofta)": "meat-kebab-kofta",
  "bbq|Grilled chicken": "grilled-chicken",
  "bbq|Chicken pieces with fries and salad": "shish-tawook",
  "bbq|Mixed BBQ plate": "mixed-bbq-plate",
  "bbq|Mixed barbecue — half kilogram": "mixed-barbecue-platter",
  "bbq|Mixed barbecue — one kilogram": "mixed-barbecue-platter",
  "breakfast|Hummus": "hummus",
  "breakfast|Liver with tomato": "liver-with-tomato",
  "breakfast|Liver with kidney": "liver-with-kidney",
  "breakfast|Mutton kidneys": "mutton-kidneys",
  "breakfast|Meat with tomato": "meat-with-tomato",
  "breakfast|Full fried eggs": "full-fried-eggs",
  "breakfast|Half-fried eggs": "half-fried-eggs",
  "breakfast|Lentil soup": "lentil-soup",
  "breakfast|Foul": "foul",
  "breakfast|Egg omelet": "egg-omelet-shakshuka",
  "rice|Mandi chicken rice — quarter": "mandi-chicken-quarter",
  "rice|Mandi chicken rice — half": "mandi-chicken-half",
  "rice|Mandi chicken rice — whole": "mandi-chicken-whole",
  "rice|Fresh mandi meat with rice — single": "fresh-mandi-meat",
  "rice|Grilled chicken rice — quarter": "grilled-chicken-quarter",
  "rice|Grilled chicken rice — half": "grilled-chicken-half",
  "rice|Grilled chicken rice — whole": "grilled-chicken-whole",
  "rice|Plain rice": "plain-rice",
  "rice|BBQ chicken rice — half": "charcoal-chicken-rice",
  "rice|BBQ chicken rice — whole": "charcoal-chicken-rice",
  "rice|Imported meat with rice": "imported-meat-rice",
  "rice|Mandi rice": "mandi-rice",
  "rice|Biryani rice": "biryani-rice",
  "rice|Bukhari rice": "bukhari-rice",
  "rice|White rice": "white-rice",
  "fried|Fried fish": "fried-fish",
  "fried|Broasted chicken with fries": "broasted-chicken",
  "fried|French fries": "french-fries",
  "appetizers|Mixed appetizers": "mixed-appetizers",
  "appetizers|Green salad": "green-salad",
  "appetizers|Grape-leaf salad": "grape-leaf-salad",
  "appetizers|Tabbouleh salad": "tabbouleh",
  "appetizers|Hummus": "hummus",
  "appetizers|Mutabbal": "mutabbal",
  "appetizers|Cucumber and mint yogurt": "cucumber-yogurt",
  "appetizers|Cucumber lassi": "cucumber-yogurt",
  "curries|Brinjal / eggplant curry": "brinjal-curry",
  "curries|Lady finger curry": "okra-curry",
  "curries|Mixed vegetable curry": "mixed-vegetable-curry",
  "curries|Spinach / saag": "spinach-molokhia",
  "curries|Potato with meat": "potato-with-meat",
  "curries|Chicken curry": "chicken-curry",
  "curries|Lentils": "lentils",
  "curries|Mutton curry": "mutton-curry"
};

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgb) {
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function readHeader(fd, off) {
  const b = Buffer.alloc(24); fs.readSync(fd, b, 0, 24, off);
  return {w: b.readUInt32LE(0), h: b.readUInt32LE(4), planes: b.readUInt32LE(8), bpp: b.readUInt32LE(12), bpl: b.readUInt32LE(16), size: b.readUInt32LE(20)};
}
function readRaster(fd, off, hd) { const b = Buffer.alloc(hd.size); fs.readSync(fd, b, 0, hd.size, off + 56); return b; }

function decodePhoto(fd, spec, name) {
  const hd = readHeader(fd, spec.off);
  if (hd.w !== spec.w || hd.h !== spec.h || hd.planes !== 1 || ![24, 32].includes(hd.bpp)) throw new Error(`${name}: raster header mismatch at ${spec.off}; the CDR file has changed.`);
  const px = readRaster(fd, spec.off, hd);
  const maskOff = spec.off + 56 + hd.size + 22;
  const mh = readHeader(fd, maskOff);
  const mask = mh.w === hd.w && mh.h === hd.h && mh.bpp === 8 && mh.planes === 1 ? readRaster(fd, maskOff, mh) : null;
  const mbpl = Math.ceil(hd.w / 4) * 4, bp = hd.bpp / 8, rgb = Buffer.alloc(hd.w * hd.h * 3);
  for (let y = 0; y < hd.h; y++) for (let x = 0; x < hd.w; x++) {
    const s = y * hd.bpl + x * bp, d = (y * hd.w + x) * 3;
    let r, g, b;
    if (hd.bpp === 32) { const k = 255 - px[s + 3]; r = (255 - px[s]) * k / 255; g = (255 - px[s + 1]) * k / 255; b = (255 - px[s + 2]) * k / 255; }
    else { r = px[s + 2]; g = px[s + 1]; b = px[s]; }
    const a = mask ? mask[y * mbpl + x] / 255 : 1;
    rgb[d] = r * a + 255 * (1 - a); rgb[d + 1] = g * a + 255 * (1 - a); rgb[d + 2] = b * a + 255 * (1 - a);
  }
  if (spec.whiteRef) whiteBalance(rgb, hd.w, spec.whiteRef);
  return {w: hd.w, h: hd.h, rgb};
}

// Neutralises a colour cast by scaling each channel so a known white area (e.g. the plate rim) becomes neutral.
// Used for a CMYK photo whose naive CMYK-to-RGB conversion is visibly cyan.
function whiteBalance(rgb, w, [rx, ry]) {
  const sum = [0, 0, 0]; let n = 0;
  for (let y = ry - 6; y <= ry + 6; y++) for (let x = rx - 6; x <= rx + 6; x++) { const i = (y * w + x) * 3; for (let c = 0; c < 3; c++) sum[c] += rgb[i + c]; n++; }
  const gain = sum.map(v => 245 / Math.max(1, v / n));
  for (let i = 0; i < rgb.length; i++) rgb[i] = Math.min(255, rgb[i] * gain[i % 3]);
}

function cropSquare(img, crop) {
  if (crop === "full") return img;
  const [cx, cy, f] = crop || [0.5, 0.5, 1];
  const side = Math.round(Math.min(img.w, img.h) * f);
  const x0 = Math.max(0, Math.min(img.w - side, Math.round(img.w * cx - side / 2)));
  const y0 = Math.max(0, Math.min(img.h - side, Math.round(img.h * cy - side / 2)));
  const out = Buffer.alloc(side * side * 3);
  for (let y = 0; y < side; y++) img.rgb.copy(out, y * side * 3, ((y0 + y) * img.w + x0) * 3, ((y0 + y) * img.w + x0 + side) * 3);
  return {w: side, h: side, rgb: out};
}

console.log("Extracting Bitmaps.dat from the CDR container...");
// bsdtar (Windows' built-in tar.exe) can read zip containers; GNU tar cannot.
const tar = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "bsdtar";
execFileSync(tar, ["-xf", cdr, "-C", tmp, "content/data/Bitmaps.dat"], {stdio: "inherit"});
const fd = fs.openSync(path.join(tmp, "content", "data", "Bitmaps.dat"), "r");
fs.mkdirSync(webDir, {recursive: true});
fs.mkdirSync(archiveDir, {recursive: true});

const jobs = [];
for (const [name, spec] of Object.entries(photos)) {
  const img = decodePhoto(fd, spec, name);
  const full = path.join(tmp, `${name}--full.png`), web = path.join(tmp, `${name}--web.png`);
  fs.writeFileSync(full, png(img.w, img.h, img.rgb));
  const sq = cropSquare(img, spec.crop);
  fs.writeFileSync(web, png(sq.w, sq.h, sq.rgb));
  jobs.push({full, web, webOut: path.join(webDir, `${name}.jpg`), archiveOut: path.join(archiveDir, `${name}.jpg`)});
  console.log(`decoded ${name} (${img.w}x${img.h})`);
}
fs.closeSync(fd);

// JPEG encoding and high-quality resizing via Windows System.Drawing.
const ps = `
Add-Type -AssemblyName System.Drawing
$jobs = Get-Content -Raw -LiteralPath '${path.join(tmp, "jobs.json").replace(/'/g, "''")}' | ConvertFrom-Json
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
function Save-Jpeg($src, $dst, $max, $quality) {
  $img = [System.Drawing.Image]::FromFile($src)
  $scale = [Math]::Min(1.0, $max / [Math]::Max($img.Width, $img.Height))
  $w = [int][Math]::Round($img.Width * $scale); $h = [int][Math]::Round($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, 0, 0, $w, $h)
  $p = New-Object System.Drawing.Imaging.EncoderParameters 1
  $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$quality)
  $bmp.Save($dst, $codec, $p)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}
foreach ($j in $jobs) { Save-Jpeg $j.web $j.webOut 900 84; Save-Jpeg $j.full $j.archiveOut 100000 92 }
`;
fs.writeFileSync(path.join(tmp, "jobs.json"), JSON.stringify(jobs));
fs.writeFileSync(path.join(tmp, "encode.ps1"), ps);
execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(tmp, "encode.ps1")], {stdio: "inherit"});

const map = Object.fromEntries(Object.entries(assignments).map(([key, name]) => {
  if (!photos[name]) throw new Error(`Unknown photo ${name}`);
  return [key, `menu-images/restaurant/${name}.jpg`];
}));
fs.writeFileSync(path.join(dist, "menu-restaurant-images.json"), JSON.stringify(map, null, 2) + "\n");
fs.rmSync(tmp, {recursive: true, force: true});
console.log(`Wrote ${Object.keys(photos).length} photos and ${Object.keys(map).length} menu assignments.`);
