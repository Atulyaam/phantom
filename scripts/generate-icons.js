import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, r, g, b, a) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth: 8
  ihdrData.writeUInt8(6, 9); // color type: 6 (RGBA)
  ihdrData.writeUInt8(0, 10); // compression: 0
  ihdrData.writeUInt8(0, 11); // filter: 0
  ihdrData.writeUInt8(0, 12); // interlace: 0
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data with filter byte 0 at start of each scanline
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const lineOffset = y * scanlineLength;
    rawData[lineOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = lineOffset + 1 + x * 4;
      // Draw a subtle border & ghost purple icon
      const isBorder = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      if (isBorder) {
        rawData[pxOffset] = 139; // R (Spectral Purple)
        rawData[pxOffset + 1] = 92; // G
        rawData[pxOffset + 2] = 246; // B
        rawData[pxOffset + 3] = 255; // A
      } else {
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = a;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(len + 12);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, len + 8));
  chunk.writeUInt32BE(crc, len + 8);
  return chunk;
}

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const iconsDir = path.resolve('public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  // Midnight obsidian with spectral purple (#14161f)
  const png = createPng(size, size, 20, 22, 31, 255);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), png);
  console.log(`Generated icon-${size}.png (${size}x${size})`);
}
