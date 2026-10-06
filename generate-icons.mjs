import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(size) {
  const width = size;
  const height = size;

  // CRC32 table
  const crcTable = [];
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

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crc]);
  }

  // Raw image bytes: (width * 4 + 1) * height
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = size * 0.44;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Rounded icon background: Tirumala Saffron gradient (#FF8C00 to #FF4500)
        const t = (x + y) / (width + height);
        const r = Math.round(255 - t * 15);
        const g = Math.round(140 - t * 70);
        const b = Math.round(10);
        let a = 255;

        // Anti-aliasing border
        if (dist > radius - 1) {
          a = Math.round(255 * (radius - dist));
        }

        // Draw an inner golden/white temple 'Tilak' or Checkmark symbol in the center
        // Center checkmark/symbol
        const nx = (x - cx) / (size * 0.5);
        const ny = (y - cy) / (size * 0.5);

        // Check if inside center white shape (Tilak / checkmark)
        const isTilakCenter = Math.abs(nx) < 0.15 && ny > -0.5 && ny < 0.4;
        const isTilakLeft = nx < -0.15 && nx > -0.45 && ny > -0.4 && (ny - nx * 0.8 < 0.2);
        const isTilakRight = nx > 0.15 && nx < 0.45 && ny > -0.4 && (ny + nx * 0.8 < 0.2);

        if (isTilakCenter) {
          // Yellow Tilak mark
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 215;
          rawData[pxOffset + 2] = 0;
          rawData[pxOffset + 3] = a;
        } else if (isTilakLeft || isTilakRight) {
          // White border marks
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = a;
        } else {
          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = a;
        }
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const sizes = [16, 48, 128];
const dirs = ['icons', 'public/icons'];

for (const dir of dirs) {
  fs.mkdirSync(dir, { recursive: true });
  for (const size of sizes) {
    const png = createPNG(size);
    const outPath = path.join(dir, `icon${size}.png`);
    fs.writeFileSync(outPath, png);
    console.log(`Generated ${outPath} (${png.length} bytes)`);
  }
}
