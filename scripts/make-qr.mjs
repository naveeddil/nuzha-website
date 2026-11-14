// Creates an SVG QR code (byte mode, error correction level M, versions 1–9) with no dependencies.
// Usage (from nuzha-website):  node scripts/make-qr.mjs "<text or URL>" dist/assets/<name>.svg
// Used for dist/assets/google-review-qr.svg (the Google "write a review" link for Nuzha's place ID).
// The encoder follows the QR Code Model 2 specification (ISO/IEC 18004); after encoding it reads the
// symbol back (format bits, data, Reed–Solomon check) and stops with an error if anything does not match.
import fs from "node:fs";

const [text, out] = process.argv.slice(2);
if (!text || !out) { console.error('Usage: node scripts/make-qr.mjs "<text>" <output.svg>'); process.exit(1); }

const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22]; // level M, versions 1–9
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5];
const DARK = "#17382e", LIGHT = "#ffffff";

const gfMul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; };
function rsDivisor(degree) {
  const r = new Array(degree).fill(0); r[degree - 1] = 1; let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gfMul(c, f); }); }
  return r;
}
const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
const dataCodewords = v => Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[v] * NUM_BLOCKS[v];
const alignPositions = v => {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, size = v * 4 + 17, step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, r = [6];
  for (let pos = size - 7; r.length < n; pos -= step) r.splice(1, 0, pos);
  return r;
};

const bytes = [...Buffer.from(text, "utf8")];
let version = 1;
while (version <= 9 && 4 + 8 + bytes.length * 8 > dataCodewords(version) * 8) version++;
if (version > 9) throw new Error("Text too long for this simple encoder (versions 1–9).");

// Data bits: byte mode indicator, 8-bit count, data, terminator, padding.
const bits = [];
const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
push(0b0100, 4); push(bytes.length, 8); bytes.forEach(b => push(b, 8));
const capacity = dataCodewords(version) * 8;
push(0, Math.min(4, capacity - bits.length));
push(0, (8 - (bits.length % 8)) % 8);
for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));

// Split into blocks, add error correction, interleave.
const numBlocks = NUM_BLOCKS[version], eccLen = ECC_PER_BLOCK[version], rawCw = Math.floor(rawModules(version) / 8);
const numShort = numBlocks - (rawCw % numBlocks), shortLen = Math.floor(rawCw / numBlocks), div = rsDivisor(eccLen);
const blocks = [];
for (let i = 0, k = 0; i < numBlocks; i++) {
  const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1)); k += dat.length;
  const ecc = rsRemainder(dat, div); if (i < numShort) dat.push(0);
  blocks.push(dat.concat(ecc));
}
const codewords = [];
for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= numShort) codewords.push(b[i]); });

// Matrix with function patterns.
const size = version * 4 + 17;
const mod = Array.from({length: size}, () => new Array(size).fill(false));
const fn = Array.from({length: size}, () => new Array(size).fill(false));
const setFn = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };
for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
    if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4);
  }
const al = alignPositions(version);
al.forEach((a, i) => al.forEach((b, j) => {
  if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
}));
const formatBits = mask => { const d = (0 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); return ((d << 10) | r) ^ 0x5412; }; // level M = 00
function drawFormat(mask) {
  const b = formatBits(mask), bit = i => ((b >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
  setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
  setFn(8, size - 8, true);
}
drawFormat(0);

// Place data in the zigzag order.
const zigzag = [];
for (let right = size - 1; right >= 1; right -= 2) {
  if (right === 6) right = 5;
  for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
    const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
    if (!fn[y][x]) zigzag.push([x, y]);
  }
}
zigzag.forEach(([x, y], i) => { mod[y][x] = i < codewords.length * 8 && ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; });

const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
  (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] = !mod[y][x]; };
function penalty() {
  let p = 0;
  const line = get => { for (let a = 0; a < size; a++) { let run = 1; for (let b = 1; b <= size; b++) { if (b < size && get(a, b) === get(a, b - 1)) run++; else { if (run >= 5) p += run - 2; run = 1; } } } };
  line((a, b) => mod[a][b]); line((a, b) => mod[b][a]);
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
  const pat = [true, false, true, true, true, false, true];
  const find = get => { for (let a = 0; a < size; a++) for (let b = 0; b + 7 <= size; b++) if (pat.every((v, k) => get(a, b + k) === v)) {
    const before = b >= 4 && [1, 2, 3, 4].every(k => !get(a, b - k)), after = b + 11 <= size && [7, 8, 9, 10].every(k => !get(a, b + k));
    if (before || after) p += 40; } };
  find((a, b) => mod[a][b]); find((a, b) => mod[b][a]);
  const dark = mod.flat().filter(Boolean).length; p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return p;
}
let best = 0, bestP = Infinity;
for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } applyMask(m); }
applyMask(best); drawFormat(best);

// Read the symbol back and verify it independently of the encoding steps above.
const readFormat = () => { let b = 0; for (let i = 0; i <= 5; i++) b |= (mod[i][8] ? 1 : 0) << i; b |= (mod[7][8] ? 1 : 0) << 6; b |= (mod[8][8] ? 1 : 0) << 7; b |= (mod[8][7] ? 1 : 0) << 8; for (let i = 9; i < 15; i++) b |= (mod[8][14 - i] ? 1 : 0) << i; return b; };
const fmt = readFormat();
const decodedMask = [0, 1, 2, 3, 4, 5, 6, 7].find(m => formatBits(m) === fmt);
if (decodedMask !== best) throw new Error("Format information check failed");
const readBits = zigzag.map(([x, y]) => (mod[y][x] !== maskFn[decodedMask](x, y)) ? 1 : 0);
const readCw = []; for (let i = 0; i + 8 <= codewords.length * 8; i += 8) readCw.push(parseInt(readBits.slice(i, i + 8).join(""), 2));
const rb = Array.from({length: numBlocks}, () => []);
let idx = 0;
for (let i = 0; i < blocks[0].length; i++) for (let j = 0; j < numBlocks; j++) if (i !== shortLen - eccLen || j >= numShort) rb[j].push(readCw[idx++]);
let recovered = [];
rb.forEach((b, j) => {
  const d = b.slice(0, b.length - eccLen), e = b.slice(b.length - eccLen);
  // Syndrome check: evaluating the full codeword polynomial at each generator root must give zero.
  const full = d.concat(e);
  for (let k = 0, root = 1; k < eccLen; k++, root = gfMul(root, 2)) { let s = 0; for (const c of full) s = gfMul(s, root) ^ c; if (s !== 0) throw new Error(`Reed–Solomon check failed in block ${j}`); }
  recovered = recovered.concat(d);
});
const rbits = recovered.flatMap(b => [7, 6, 5, 4, 3, 2, 1, 0].map(i => (b >>> i) & 1));
const num = (o, l) => parseInt(rbits.slice(o, o + l).join(""), 2);
if (num(0, 4) !== 0b0100) throw new Error("Mode check failed");
const len = num(4, 8), back = Buffer.from(Array.from({length: len}, (_, i) => num(12 + i * 8, 8))).toString("utf8");
if (back !== text) throw new Error("Round-trip check failed");

// SVG with a 4-module quiet zone.
const q = 4, dim = size + q * 2;
let path = "";
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) path += `M${x + q} ${y + q}h1v1h-1z`;
fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><title>QR code</title><rect width="${dim}" height="${dim}" fill="${LIGHT}"/><path fill="${DARK}" d="${path}"/></svg>\n`);
console.log(`QR version ${version}-M, mask ${best}, ${size}×${size} modules, verified round-trip → ${out}`);
