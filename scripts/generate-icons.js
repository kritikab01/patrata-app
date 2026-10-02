import fs from "fs";
import zlib from "zlib";

function createPNG(size, text) {
  // We will generate a basic uncompressed/deflated raw RGBA PNG
  const width = size;
  const height = size;

  // Raw image data with 1 byte filter (0) per scanline
  const rowBytes = width * 4;
  const rawData = Buffer.alloc((rowBytes + 1) * height);

  // Black background: #0A0A0A -> R:10, G:10, B:10, A:255
  // White: #FFFFFF -> R:255, G:255, B:255, A:255
  
  // Create a clean grid representation of the Devanagari letter "प"
  // Let's create an off-center/centered grid or glyph for "प"
  const grid = [
    "................",
    "................",
    "..############..",
    "......#.....#...",
    "......#.....#...",
    "......#.....#...",
    "......#.....#...",
    "......#.....#...",
    "......#.....#...",
    "......#.....#...",
    "......#######...",
    "............#...",
    "............#...",
    "............#...",
    "............#...",
    "................"
  ];

  const gridH = grid.length;
  const gridW = grid[0].length;

  // Scale grid to fit in middle 60% of canvas
  const padding = Math.floor(size * 0.2);
  const glyphSize = size - 2 * padding;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowBytes + 1);
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Default background color #0A0A0A
      let r = 10;
      let g = 10;
      let b = 10;
      let a = 255;

      // Check if inside glyph area
      if (x >= padding && x < padding + glyphSize && y >= padding && y < padding + glyphSize) {
        const gx = Math.floor(((x - padding) / glyphSize) * gridW);
        const gy = Math.floor(((y - padding) / glyphSize) * gridH);
        if (grid[gy] && grid[gy][gx] === "#") {
          r = 255;
          g = 255;
          b = 255;
        }
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  // Compress IDAT data
  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 72, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk("IHDR", ihdrData);

  // IDAT Chunk
  const idatChunk = createChunk("IDAT", compressed);

  // IEND Chunk
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// Ensure public directory exists
if (!fs.existsSync("public")) {
  fs.mkdirSync("public");
}

fs.writeFileSync("public/icon-192.png", createPNG(192, "प"));
fs.writeFileSync("public/icon-512.png", createPNG(512, "प"));
fs.writeFileSync("public/icon-maskable-512.png", createPNG(512, "प"));
fs.writeFileSync("public/apple-touch-icon.png", createPNG(180, "प"));
console.log("Icons generated successfully!");
