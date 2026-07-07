import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const shellRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = join(shellRoot, "build");
const linuxIconRoot = join(buildRoot, "icons");
const sourceSvg = join(buildRoot, "icon.svg");
const sourcePng = join(buildRoot, "icon-source.png");

const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
await mkdir(buildRoot, { recursive: true });
await mkdir(linuxIconRoot, { recursive: true });

await writeFile(sourceSvg, createIconSvg());
await writeFile(sourcePng, createIconPng(1024));

for (const size of pngSizes) {
  const pngPath = join(buildRoot, `icon-${size}.png`);
  resizePng(sourcePng, pngPath, size);
  await writeFile(join(linuxIconRoot, `${size}x${size}.png`), readFileSync(pngPath));
}

await writeFile(join(buildRoot, "icon.png"), readFileSync(join(buildRoot, "icon-512.png")));
await writeFile(join(buildRoot, "icon.icns"), createIcns([
  ["icp4", join(buildRoot, "icon-16.png")],
  ["icp5", join(buildRoot, "icon-32.png")],
  ["icp6", join(buildRoot, "icon-64.png")],
  ["ic07", join(buildRoot, "icon-128.png")],
  ["ic08", join(buildRoot, "icon-256.png")],
  ["ic09", join(buildRoot, "icon-512.png")],
  ["ic10", join(buildRoot, "icon-1024.png")],
]));
await writeFile(join(buildRoot, "icon.ico"), createIco([16, 32, 48, 256].map((size) => readPngEntry(join(buildRoot, `icon-${size}.png`), size))));

function resizePng(inputPath, outputPath, size) {
  execFileSync("sips", ["-z", String(size), String(size), inputPath, "--out", outputPath], { stdio: "ignore" });
}

function readPngEntry(path, size) {
  return {
    size,
    data: readFileSync(path),
  };
}

function createIco(entries) {
  const headerSize = 6;
  const directorySize = entries.length * 16;
  const buffers = [Buffer.alloc(headerSize + directorySize)];
  let offset = headerSize + directorySize;

  buffers[0].writeUInt16LE(0, 0);
  buffers[0].writeUInt16LE(1, 2);
  buffers[0].writeUInt16LE(entries.length, 4);

  entries.forEach((entry, index) => {
    const directoryOffset = headerSize + index * 16;
    const dimension = entry.size >= 256 ? 0 : entry.size;
    buffers[0].writeUInt8(dimension, directoryOffset);
    buffers[0].writeUInt8(dimension, directoryOffset + 1);
    buffers[0].writeUInt8(0, directoryOffset + 2);
    buffers[0].writeUInt8(0, directoryOffset + 3);
    buffers[0].writeUInt16LE(1, directoryOffset + 4);
    buffers[0].writeUInt16LE(32, directoryOffset + 6);
    buffers[0].writeUInt32LE(entry.data.length, directoryOffset + 8);
    buffers[0].writeUInt32LE(offset, directoryOffset + 12);
    buffers.push(entry.data);
    offset += entry.data.length;
  });

  return Buffer.concat(buffers);
}

function createIcns(entries) {
  const chunks = entries.map(([type, filePath]) => {
    const data = readFileSync(filePath);
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, "ascii");
    header.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([header, data]);
  });
  const size = chunks.reduce((total, chunk) => total + chunk.length, 8);
  const header = Buffer.alloc(8);
  header.write("icns", 0, 4, "ascii");
  header.writeUInt32BE(size, 4);
  return Buffer.concat([header, ...chunks]);
}

function createIconPng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = size * 0.18;
  const inset = size * 0.11;
  const rectSize = size - inset * 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const inside = roundedRectAlpha(x + 0.5, y + 0.5, inset, inset, rectSize, rectSize, radius);
      if (inside <= 0) continue;
      const t = (x + y) / (size * 2);
      const color = mix([247, 251, 247], [188, 231, 228], t);
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = Math.round(255 * inside);
    }
  }

  drawLine(pixels, size, 0.5, 0.5, 0.5, 0.22, 0.5, 0.78, 72, [14, 58, 52, 255]);
  drawLine(pixels, size, 0.5, 0.5, 0.22, 0.5, 0.78, 0.5, 72, [14, 58, 52, 255]);
  drawLine(pixels, size, 0.5, 0.5, 0.32, 0.32, 0.68, 0.68, 60, [14, 58, 52, 255]);
  drawLine(pixels, size, 0.5, 0.5, 0.68, 0.32, 0.32, 0.68, 60, [14, 58, 52, 255]);
  drawDiamond(pixels, size, 0.5, 0.5, 0.13, [20, 72, 65, 255]);
  for (const [cx, cy] of [[0.5, 0.22], [0.5, 0.78], [0.22, 0.5], [0.78, 0.5], [0.32, 0.32], [0.68, 0.32], [0.32, 0.68], [0.68, 0.68]]) {
    drawCircle(pixels, size, cx, cy, 0.042, [20, 72, 65, 255]);
  }

  return encodePng(size, size, pixels);
}

function roundedRectAlpha(x, y, rectX, rectY, width, height, radius) {
  const innerX = Math.max(rectX + radius, Math.min(x, rectX + width - radius));
  const innerY = Math.max(rectY + radius, Math.min(y, rectY + height - radius));
  const distance = Math.hypot(x - innerX, y - innerY);
  return Math.max(0, Math.min(1, radius + 0.5 - distance));
}

function drawLine(pixels, size, _originX, _originY, startX, startY, endX, endY, width, color) {
  const x1 = startX * size;
  const y1 = startY * size;
  const x2 = endX * size;
  const y2 = endY * size;
  const half = width / 2;
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - half - 1));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + half + 1));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - half - 1));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + half + 1));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const alpha = Math.max(0, Math.min(1, half + 0.8 - Math.hypot(x - px, y - py)));
      blendPixel(pixels, size, x, y, color, alpha);
    }
  }
}

function drawCircle(pixels, size, centerX, centerY, radius, color) {
  const cx = centerX * size;
  const cy = centerY * size;
  const r = radius * size;
  for (let y = Math.max(0, Math.floor(cy - r - 2)); y <= Math.min(size - 1, Math.ceil(cy + r + 2)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - r - 2)); x <= Math.min(size - 1, Math.ceil(cx + r + 2)); x += 1) {
      const alpha = Math.max(0, Math.min(1, r + 0.8 - Math.hypot(x - cx, y - cy)));
      blendPixel(pixels, size, x, y, color, alpha);
    }
  }
}

function drawDiamond(pixels, size, centerX, centerY, radius, color) {
  const cx = centerX * size;
  const cy = centerY * size;
  const r = radius * size;
  for (let y = Math.max(0, Math.floor(cy - r - 2)); y <= Math.min(size - 1, Math.ceil(cy + r + 2)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - r - 2)); x <= Math.min(size - 1, Math.ceil(cx + r + 2)); x += 1) {
      const distance = Math.abs(x - cx) + Math.abs(y - cy);
      const alpha = Math.max(0, Math.min(1, r + 0.8 - distance));
      blendPixel(pixels, size, x, y, color, alpha);
    }
  }
}

function blendPixel(pixels, size, x, y, color, alpha) {
  if (alpha <= 0) return;
  const index = (y * size + x) * 4;
  const existingAlpha = pixels[index + 3] / 255;
  const sourceAlpha = (color[3] / 255) * alpha;
  const outputAlpha = sourceAlpha + existingAlpha * (1 - sourceAlpha);
  if (outputAlpha <= 0) return;
  pixels[index] = Math.round((color[0] * sourceAlpha + pixels[index] * existingAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 1] = Math.round((color[1] * sourceAlpha + pixels[index + 1] * existingAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 2] = Math.round((color[2] * sourceAlpha + pixels[index + 2] * existingAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 3] = Math.round(outputAlpha * 255);
}

function mix(from, to, t) {
  return from.map((value, index) => Math.round(value + (to[index] - value) * t));
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", createIhdr(width, height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createIhdr(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="132" y1="84" x2="892" y2="932" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#F7FBF7"/>
      <stop offset="0.48" stop-color="#DDF1EA"/>
      <stop offset="1" stop-color="#BDE7E4"/>
    </linearGradient>
    <linearGradient id="mark" x1="280" y1="234" x2="744" y2="790" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0E3A34"/>
      <stop offset="1" stop-color="#174B43"/>
    </linearGradient>
    <filter id="shadow" x="80" y="82" width="864" height="864" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="30" stdDeviation="38" flood-color="#06221F" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect x="112" y="112" width="800" height="800" rx="184" fill="url(#bg)" filter="url(#shadow)"/>
  <path fill="url(#mark)" d="M355 256c-20 0-36 16-36 36v123l-79-79c-14-14-37-14-51 0s-14 37 0 51l79 79H145c-20 0-36 16-36 36s16 36 36 36h123l-79 79c-14 14-14 37 0 51s37 14 51 0l79-79v123c0 20 16 36 36 36s36-16 36-36V560l103 103c14 14 37 14 51 0l104-104v153c0 20 16 36 36 36s36-16 36-36V588l81 81c14 14 37 14 51 0s14-37 0-51l-81-81h124c20 0 36-16 36-36s-16-36-36-36H762l81-81c14-14 14-37 0-51s-37-14-51 0l-81 81V292c0-20-16-36-36-36s-36 16-36 36v153L535 341c-14-14-37-14-51 0L391 434V292c0-20-16-36-36-36Zm36 281 119-119 126 126-126 126-119-119v-14Z"/>
</svg>
`;
}
