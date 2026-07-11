// Renders the Waypoint logo mark (forest square, paper road stripe at -9°,
// location ring with rust center) to PWA PNGs without image dependencies.
// Run: node scripts/gen-icons.mjs
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const FOREST = [0x34, 0x57, 0x3f]
const PAPER = [0xf7, 0xf2, 0xe8]
const RUST = [0xb2, 0x52, 0x26]

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([len, body, crc])
}

/** Color at (x, y) in a `size`-px rendering of the 96-unit logo viewBox. */
function colorAt(x, y, size) {
  const s = 96 / size // to viewBox units
  const ux = x * s
  const uy = y * s

  // Location ring & dot (center 48,46; dot r5; ring r13 stroke 5 → band 10.5–15.5)
  const dx = ux - 48
  const dy = uy - 46
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist <= 5) return RUST
  if (dist <= 10.5) return FOREST
  if (dist <= 15.5) return PAPER

  // Road stripe: 6-unit band through (48,47.5) rotated -9°
  const rad = (-9 * Math.PI) / 180
  const d = (uy - 47) * Math.cos(rad) - (ux - 48) * Math.sin(rad)
  if (Math.abs(d) <= 3) return PAPER

  return FOREST
}

function logoPng(size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolor RGB
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = colorAt(x + 0.5, y + 0.5, size)
      row[1 + x * 3] = r
      row[2 + x * 3] = g
      row[3 + x * 3] = b
    }
    rows.push(row)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/pwa-${size}x${size}.png`, import.meta.url), logoPng(size))
  console.log(`wrote public/pwa-${size}x${size}.png`)
}
