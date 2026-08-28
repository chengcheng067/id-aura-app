/**
 * 生成 ID Plan 桌面应用图标：纯 Node 无依赖 PNG/ICO 编码。
 * 深色液态玻璃品牌：底 #26262a，主色 pine #6ea8fe，绘制字母「ID」。
 * 输出 electron/icon.png (256) 与 electron/icon.ico (含 256/128/64/48/32/16)。
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 256;
const BG = [38, 38, 42, 255]; // #26262a
const PINE = [110, 168, 254, 255]; // #6ea8fe
const INK = [247, 247, 250, 255]; // #f7f7fa

// 圆角半径
const RADIUS = 48;

// ---------- 简单光栅化像素 ----------
const pixels = new Uint8Array(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // 圆角矩形裁切（透明角）
    const dx = Math.max(RADIUS - x, 0, x - (SIZE - 1 - RADIUS));
    const dy = Math.max(RADIUS - y, 0, y - (SIZE - 1 - RADIUS));
    const cornerInside = dx * dx + dy * dy <= RADIUS * RADIUS || dx === 0 || dy === 0;
    if (!cornerInside) {
      setPix(x, y, [0, 0, 0, 0]);
      continue;
    }
    // 背景
    let col = [...BG];
    // 中心轻微渐变（更立体）
    const cx = SIZE / 2, cy = SIZE / 2;
    const d = Math.hypot(x - cx, y - cy) / cx;
    if (d < 1) {
      const g = Math.round(14 * (1 - d));
      col[0] = Math.min(255, col[0] + g);
      col[1] = Math.min(255, col[1] + g);
      col[2] = Math.min(255, col[2] + g);
    }
    // 字母「ID」：I 竖条 + D 圆环
    // 竖条 I：中心偏左，上下端做半圆角
    const iX0 = 70, iX1 = 94, iY0 = 66, iY1 = 190;
    const iCX = (iX0 + iX1) / 2, iHalf = (iX1 - iX0) / 2;
    const inI = x >= iX0 && x <= iX1 && y >= iY0 && y <= iY1;
    if (inI) {
      const capT = Math.hypot(x - iCX, y - iY0) <= iHalf;
      const capB = Math.hypot(x - iCX, y - iY1) <= iHalf;
      const shaft = y >= iY0 + iHalf && y <= iY1 - iHalf;
      if (capT || capB || shaft) col = [...PINE];
    }
    // D 形：外圆环 + 左竖条
    const dCX = 152, dCY = 128, dR = 62;
    const ring = Math.abs(Math.hypot(x - dCX, y - dCY) - dR) < 15;
    const dLeft = x >= dCX - dR - 6 && x <= dCX - dR + 6 && y >= dCY - dR && y <= dCY + dR;
    if (ring || dLeft) col = [...PINE];

    setPix(x, y, col);
  }
}

function setPix(x, y, [r, g, b, a]) {
  const i = (y * SIZE + x) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

// ---------- PNG 编码 ----------
function crc32(buf) {
  let c, table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // IDAT（每行前加 filter byte 0）
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size * 4; x++) {
      raw[y * (size * 4 + 1) + 1 + x] = rgba[y * size * 4 + x];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- ICO 编码（PNG 内嵌） ----------
function encodeICO(pngBuf, bitmaps) {
  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type icon
  header.writeUInt16LE(bitmaps.length, 4);
  const entries = [];
  let offset = 6 + 16 * bitmaps.length;
  for (const { size, data } of bitmaps) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size; // width
    e[1] = size >= 256 ? 0 : size; // height
    e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...bitmaps.map((b) => b.data)]);
}

// ---------- 输出 ----------
const outDir = path.join(__dirname, '..', 'electron');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const png256 = encodePNG(SIZE, pixels);
fs.writeFileSync(path.join(outDir, 'icon.png'), png256);

// ICO 多尺寸：用 256 缩放得到更小的尺寸
function scale(src, srcSize, dstSize) {
  const dst = new Uint8Array(dstSize * dstSize * 4);
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      const sx = Math.floor((x * srcSize) / dstSize);
      const sy = Math.floor((y * srcSize) / dstSize);
      const s = (sy * srcSize + sx) * 4;
      const d = (y * dstSize + x) * 4;
      dst[d] = src[s];
      dst[d + 1] = src[s + 1];
      dst[d + 2] = src[s + 2];
      dst[d + 3] = src[s + 3];
    }
  }
  return dst;
}

const icoSizes = [256, 128, 64, 48, 32, 16];
const bitmaps = icoSizes.map((s) => ({
  size: s,
  data: s === SIZE ? png256 : encodePNG(s, scale(pixels, SIZE, s)),
}));
const ico = encodeICO(null, bitmaps);
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);

console.log('icon.png:', png256.length, 'bytes');
console.log('icon.ico:', ico.length, 'bytes');
console.log('written to electron/');
