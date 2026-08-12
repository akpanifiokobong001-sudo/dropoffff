// Dependency-free QR code encoder for DropOff.
// Byte mode only (mode indicator 0100), versions 1-10, ECC levels L/M/Q/H.
// Returns a plain boolean matrix — rendering (SVG, canvas, ...) is up to the caller.

// Error-correction blocks per version (ISO/IEC 18004 table 13-22), versions 1-10.
// Each entry is [eccCodewordsPerBlock, group1Blocks, group1DataCodewords, group2Blocks, group2DataCodewords].
// Group 2 blocks (when present) always hold exactly one more data codeword than group 1.
const EC_BLOCKS = {
  L: [
    [7, 1, 19, 0, 0],
    [10, 1, 34, 0, 0],
    [15, 1, 55, 0, 0],
    [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0],
    [18, 2, 68, 0, 0],
    [20, 2, 78, 0, 0],
    [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0],
    [18, 2, 68, 2, 69],
  ],
  M: [
    [10, 1, 16, 0, 0],
    [16, 1, 28, 0, 0],
    [26, 1, 44, 0, 0],
    [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0],
    [18, 4, 31, 0, 0],
    [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37],
    [26, 4, 43, 1, 44],
  ],
  Q: [
    [13, 1, 13, 0, 0],
    [22, 1, 22, 0, 0],
    [18, 2, 17, 0, 0],
    [26, 2, 24, 0, 0],
    [18, 2, 15, 2, 16],
    [24, 4, 19, 0, 0],
    [18, 2, 14, 4, 15],
    [22, 4, 18, 2, 19],
    [20, 4, 16, 4, 17],
    [24, 6, 19, 2, 20],
  ],
  H: [
    [17, 1, 9, 0, 0],
    [28, 1, 16, 0, 0],
    [22, 2, 13, 0, 0],
    [16, 4, 9, 0, 0],
    [22, 2, 11, 2, 12],
    [28, 4, 15, 0, 0],
    [26, 4, 13, 1, 14],
    [26, 4, 14, 2, 15],
    [24, 4, 12, 4, 13],
    [28, 6, 15, 2, 16],
  ],
}

// Row/column centres of the alignment patterns, indexed by version - 1.
const ALIGNMENT = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
]

// The 2-bit level indicator that goes into the format information.
const LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 }

const MAX_VERSION = 10

// --- GF(256) arithmetic, primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11d) ---

const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

function initTables() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  // Duplicated upper half so log sums never need a modulo.
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]
}
initTables()

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

const GENERATORS = new Map()

// Reed-Solomon generator polynomial (x - a^0)(x - a^1)...(x - a^(degree-1)),
// coefficients ordered highest power first so poly[0] is always 1.
function rsGenerator(degree) {
  const cached = GENERATORS.get(degree)
  if (cached) return cached
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i])
    }
    poly = next
  }
  GENERATORS.set(degree, poly)
  return poly
}

// Polynomial long division of the data (times x^degree) by the generator;
// the remainder is the block's error-correction codewords.
function rsRemainder(data, degree) {
  const gen = rsGenerator(degree)
  const rem = new Array(degree).fill(0)
  for (let d = 0; d < data.length; d++) {
    const factor = data[d] ^ rem[0]
    rem.shift()
    rem.push(0)
    for (let i = 0; i < degree; i++) rem[i] ^= gfMul(gen[i + 1], factor)
  }
  return rem
}

// --- Encoding ---

// UTF-8 encode by hand so the module stays free of platform APIs.
// Pure ASCII / Latin-1 text comes out identical to ISO-8859-1.
function utf8Bytes(str) {
  const out = []
  for (let i = 0; i < str.length; i++) {
    let cp = str.codePointAt(i)
    if (cp > 0xffff) i++ // surrogate pair consumed
    if (cp < 0x80) {
      out.push(cp)
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    } else {
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    }
  }
  return out
}

// Byte mode uses an 8-bit character count up to version 9 and 16 bits from version 10.
function countBits(version) {
  return version <= 9 ? 8 : 16
}

function dataCapacity(version, level) {
  const [ec, g1, d1, g2, d2] = EC_BLOCKS[level][version - 1]
  return g1 * d1 + g2 * d2
}

function pickVersion(byteLen, level) {
  for (let v = 1; v <= MAX_VERSION; v++) {
    const available = dataCapacity(v, level) * 8
    if (4 + countBits(v) + byteLen * 8 <= available) return v
  }
  const max = dataCapacity(MAX_VERSION, level) - 3
  throw new Error(`Text too long for QR versions 1-${MAX_VERSION} at ECC ${level}: ${byteLen} bytes (max ~${max})`)
}

// Mode indicator, character count, payload, terminator and pad bytes,
// packed into the version's full data-codeword budget.
function buildDataCodewords(bytes, version, level) {
  const capacity = dataCapacity(version, level)
  const bits = []
  const push = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1)
  }

  push(0b0100, 4)
  push(bytes.length, countBits(version))
  for (let i = 0; i < bytes.length; i++) push(bytes[i], 8)

  // Terminator (up to four zero bits), then zero-fill to a codeword boundary.
  const limit = capacity * 8
  for (let i = 0; i < 4 && bits.length < limit; i++) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)

  const codewords = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]
    codewords.push(byte)
  }
  // Remaining capacity is filled with the alternating pad bytes 0xEC, 0x11, 0xEC, ...
  for (let pad = 0; codewords.length < capacity; pad++) {
    codewords.push(pad % 2 === 0 ? 0xec : 0x11)
  }
  return codewords
}

// Split into RS blocks, compute ECC per block, then interleave data and ECC
// codewords. Short (group 1) blocks contribute nothing at the last data index.
function interleave(dataCodewords, version, level) {
  const [ecLen, g1, d1, g2, d2] = EC_BLOCKS[level][version - 1]
  const dataBlocks = []
  const eccBlocks = []
  let pos = 0
  for (let i = 0; i < g1 + g2; i++) {
    const len = i < g1 ? d1 : d2
    const block = dataCodewords.slice(pos, pos + len)
    pos += len
    dataBlocks.push(block)
    eccBlocks.push(rsRemainder(block, ecLen))
  }

  const out = []
  const maxData = Math.max(d1, d2)
  for (let i = 0; i < maxData; i++) {
    for (let b = 0; b < dataBlocks.length; b++) {
      if (i < dataBlocks[b].length) out.push(dataBlocks[b][i])
    }
  }
  for (let i = 0; i < ecLen; i++) {
    for (let b = 0; b < eccBlocks.length; b++) out.push(eccBlocks[b][i])
  }
  return out
}

// --- Matrix construction ---

function emptyGrid(size, value) {
  const grid = []
  for (let r = 0; r < size; r++) grid.push(new Array(size).fill(value))
  return grid
}

function drawFinder(matrix, fixed, top, left) {
  // 7x7 finder ring plus the 1-module light separator that surrounds it.
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const r = top + dr
      const c = left + dc
      if (r < 0 || r >= matrix.length || c < 0 || c >= matrix.length) continue
      const d = Math.max(Math.abs(dr - 3), Math.abs(dc - 3))
      matrix[r][c] = d !== 2 && d <= 3
      fixed[r][c] = true
    }
  }
}

// 15-bit format information: 2 level bits + 3 mask bits, a BCH(15,5) remainder,
// then XOR with the 0x5412 mask so an all-zero format is never valid.
function formatBits(level, mask) {
  const data = (LEVEL_BITS[level] << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537)
  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412
}

// 18-bit version information: 6 version bits + a BCH(18,6) remainder (no XOR mask).
function versionInfoBits(version) {
  let rem = version
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25)
  return (version << 12) | (rem & 0xfff)
}

function drawFunctionPatterns(matrix, fixed, version) {
  const size = matrix.length

  drawFinder(matrix, fixed, 0, 0)
  drawFinder(matrix, fixed, 0, size - 7)
  drawFinder(matrix, fixed, size - 7, 0)

  // Timing patterns: alternating modules bridging the finders on row 6 / column 6.
  for (let i = 8; i <= size - 9; i++) {
    const dark = i % 2 === 0
    matrix[6][i] = dark
    fixed[6][i] = true
    matrix[i][6] = dark
    fixed[i][6] = true
  }

  // 5x5 alignment patterns at every coordinate pair, minus the three that
  // would collide with a finder pattern.
  const coords = ALIGNMENT[version - 1]
  const last = coords.length - 1
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const r = coords[i] + dr
          const c = coords[j] + dc
          matrix[r][c] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1
          fixed[r][c] = true
        }
      }
    }
  }

  // Reserve the two format-information strips (written after masking is chosen).
  // The dark module at (size - 8, 8) falls inside the second strip.
  for (let i = 0; i < 9; i++) {
    fixed[8][i] = true
    fixed[i][8] = true
  }
  for (let i = 0; i < 8; i++) {
    fixed[8][size - 1 - i] = true
    fixed[size - 1 - i][8] = true
  }

  // Version information (versions 7+): two 3x6 blocks beside the lower-left
  // and upper-right finders, mirrored about the diagonal.
  if (version >= 7) {
    const bits = versionInfoBits(version)
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >> i) & 1) === 1
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      matrix[b][a] = bit
      fixed[b][a] = true
      matrix[a][b] = bit
      fixed[a][b] = true
    }
  }
}

// Walk the free modules in the standard zigzag: two-column strips right to
// left, alternating upward and downward, skipping the vertical timing column.
function placeCodewords(matrix, fixed, codewords) {
  const size = matrix.length
  let bit = 0
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert
      for (let j = 0; j < 2; j++) {
        const col = right - j
        if (fixed[row][col]) continue
        // Bits past the end of the stream are the version's remainder bits (always 0).
        const byte = codewords[bit >> 3]
        matrix[row][col] = byte !== undefined && ((byte >> (7 - (bit & 7))) & 1) === 1
        bit++
      }
    }
    upward = !upward
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

function applyMask(matrix, fixed, mask) {
  const fn = MASKS[mask]
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix.length; c++) {
      if (!fixed[r][c] && fn(r, c)) matrix[r][c] = !matrix[r][c]
    }
  }
}

function drawFormatInfo(matrix, level, mask) {
  const size = matrix.length
  const bits = formatBits(level, mask)
  const bit = (i) => ((bits >> i) & 1) === 1

  // Copy 1: down column 8 then left along row 8, hopping over the timing modules.
  for (let i = 0; i <= 5; i++) matrix[i][8] = bit(i)
  matrix[7][8] = bit(6)
  matrix[8][8] = bit(7)
  matrix[8][7] = bit(8)
  for (let i = 9; i < 15; i++) matrix[8][14 - i] = bit(i)

  // Copy 2: bits 0-7 run leftward along row 8 from the right edge,
  // bits 8-14 run downward along column 8 to the bottom edge.
  for (let i = 0; i < 8; i++) matrix[8][size - 1 - i] = bit(i)
  for (let i = 8; i < 15; i++) matrix[size - 15 + i][8] = bit(i)

  matrix[size - 8][8] = true // dark module, always set
}

// --- Mask selection penalties (ISO/IEC 18004 section 8.8.2) ---

// Finder-like 1:1:3:1:1 sequences with a 4-module light margin on either side.
const RULE3_A = [true, false, true, true, true, false, true, false, false, false, false]
const RULE3_B = [false, false, false, false, true, false, true, true, true, false, true]

function penalty(matrix) {
  const size = matrix.length
  let score = 0

  // Rule 1: runs of five or more same-coloured modules in a row or column.
  for (let i = 0; i < size; i++) {
    for (const read of [(k) => matrix[i][k], (k) => matrix[k][i]]) {
      let run = 1
      for (let k = 1; k < size; k++) {
        if (read(k) === read(k - 1)) {
          run++
        } else {
          if (run >= 5) score += 3 + (run - 5)
          run = 1
        }
      }
      if (run >= 5) score += 3 + (run - 5)
    }
  }

  // Rule 2: every 2x2 block of one colour costs 3.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c]
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) score += 3
    }
  }

  // Rule 3: 40 per finder-lookalike sequence, horizontally and vertically.
  for (let i = 0; i < size; i++) {
    for (let k = 0; k + 11 <= size; k++) {
      let matchA = true
      let matchB = true
      let matchAv = true
      let matchBv = true
      for (let p = 0; p < 11; p++) {
        const h = matrix[i][k + p]
        const v = matrix[k + p][i]
        if (h !== RULE3_A[p]) matchA = false
        if (h !== RULE3_B[p]) matchB = false
        if (v !== RULE3_A[p]) matchAv = false
        if (v !== RULE3_B[p]) matchBv = false
      }
      if (matchA) score += 40
      if (matchB) score += 40
      if (matchAv) score += 40
      if (matchBv) score += 40
    }
  }

  // Rule 4: deviation of the dark-module ratio from 50%, 10 per 5% step.
  let dark = 0
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) if (matrix[r][c]) dark++
  }
  const total = size * size
  score += 10 * Math.floor((Math.abs(dark * 20 - total * 10) * 5) / total / 5)

  return score
}

/**
 * Encodes text as a QR code in byte mode.
 * Returns a square boolean matrix where matrix[row][col] === true is a dark module.
 * No quiet zone is included — the caller should leave 4 light modules around it.
 * Throws if the text does not fit in versions 1-10 at the requested ECC level.
 */
export function qrMatrix(text, { ecc = 'M' } = {}) {
  const level = String(ecc).toUpperCase()
  if (!EC_BLOCKS[level]) throw new Error(`Unknown ECC level: ${ecc} (expected L, M, Q or H)`)

  const bytes = utf8Bytes(text == null ? '' : String(text))
  const version = pickVersion(bytes.length, level)
  const codewords = interleave(buildDataCodewords(bytes, version, level), version, level)

  const size = version * 4 + 17
  const base = emptyGrid(size, false)
  const fixed = emptyGrid(size, false)
  drawFunctionPatterns(base, fixed, version)
  placeCodewords(base, fixed, codewords)

  // Try all eight masks and keep the one with the lowest penalty score.
  let best = null
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row) => row.slice())
    applyMask(candidate, fixed, mask)
    drawFormatInfo(candidate, level, mask)
    const score = penalty(candidate)
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}
