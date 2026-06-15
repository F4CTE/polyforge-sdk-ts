// Minimal Keccak-256 (keccak-f1600) implementation adapted from @noble/hashes.
// Implements the original Keccak (not NIST SHA3) padding scheme.

const U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
const _32n = /* @__PURE__ */ BigInt(32);
const _0n = /* @__PURE__ */ BigInt(0);
const _1n = /* @__PURE__ */ BigInt(1);
const _2n = /* @__PURE__ */ BigInt(2);
const _7n = /* @__PURE__ */ BigInt(7);
const _256n = /* @__PURE__ */ BigInt(256);
const _0x71n = /* @__PURE__ */ BigInt(0x71);

// Per-round constants (computed once)
const [SHA3_PI, SHA3_ROTL, _SHA3_IOTA] = [[], [], []];
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((((round + 1) * (round + 2)) / 2) % 64);
  let t = _0n;
  for (let j = 0; j < 7; j++) {
    R = ((R << _1n) ^ ((R >> _7n) * _0x71n)) % _256n;
    if (R & _2n) t ^= _1n << ((_1n << BigInt(j)) - _1n);
  }
  _SHA3_IOTA.push(t);
}

function fromBig(n: bigint, le = false): { h: number; l: number } {
  if (le) return { h: Number(n & U32_MASK64), l: Number((n >> _32n) & U32_MASK64) };
  return { h: Number((n >> _32n) & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}

function toBig(h: number, l: number): bigint {
  return (BigInt(h >>> 0) << _32n) | BigInt(l >>> 0);
}

function split(lst: bigint[], le = false): [Uint32Array, Uint32Array] {
  const Ah = new Uint32Array(lst.length);
  const Al = new Uint32Array(lst.length);
  for (let i = 0; i < lst.length; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}

function rotlSH(h: number, l: number, s: number): number {
  return (h << s) | (l >>> (32 - s));
}
function rotlSL(h: number, l: number, s: number): number {
  return (l << s) | (h >>> (32 - s));
}
function rotlBH(h: number, l: number, s: number): number {
  return (l << (s - 32)) | (h >>> (64 - s));
}
function rotlBL(h: number, l: number, s: number): number {
  return (h << (s - 32)) | (l >>> (64 - s));
}

function rotlH(h: number, l: number, s: number): number {
  return s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
}
function rotlL(h: number, l: number, s: number): number {
  return s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
}

// Split IOTA constants into high/low parts
const [SHA3_IOTA_H, SHA3_IOTA_L] = split(_SHA3_IOTA, true);

// keccak-f1600 permutation (24 rounds)
function keccakP(s: Uint32Array, rounds = 24): void {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    // Theta
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    // Rho and Pi
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t] as number;
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t] as number;
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    // Chi
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++) B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    // Iota
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  B.fill(0);
}

/**
 * Keccak-256 hash (original Keccak, not NIST SHA3).
 * Uses the same padding as @noble/hashes keccak_256 (suffix=0x01, rate=136).
 * Produces identical output to ethers.js getAddress checksum hash.
 */
export function keccak256(message: Uint8Array | string): Uint8Array {
  const data = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const state32 = new Uint32Array(200); // 1600 bits / 8 / 4 = 50 u64 = 100 u32 ... wait
  // Actually state is 200 bytes = 50 u64 = 100 u32
  const state = new Uint8Array(200);

  // Copy data into state (XOR)
  const rate = 136;
  const blockLen = rate;
  let pos = 0;
  for (let i = 0; i < data.length; i++) {
    state[pos++] ^= data[i];
  }
  // Suffix padding: XOR suffix (0x01) at position pos
  state[pos] ^= 0x01;
  // Final padding: XOR 0x80 at position blockLen-1
  state[blockLen - 1] ^= 0x80;

  // Convert 200-byte state to uint32 array for keccak-f1600.
  // Noble stores each 64-bit lane as 2 consecutive uint32 values
  // (low 32 bits, high 32 bits).  50 lanes × 2 = 100 uint32.
  // Each uint32 reads 4 consecutive bytes from the state.
  const s = new Uint32Array(50);
  for (let i = 0; i < 200; i += 4) {
    s[i / 4] = state[i] | (state[i + 1] << 8) | (state[i + 2] << 16) | (state[i + 3] << 24);
  }

  keccakP(s, 24);

  // Convert back and extract first 32 bytes (256-bit digest).
  for (let i = 0; i < 50; i++) {
    const v = s[i];
    state[i * 4] = v & 0xff;
    state[i * 4 + 1] = (v >>> 8) & 0xff;
    state[i * 4 + 2] = (v >>> 16) & 0xff;
    state[i * 4 + 3] = (v >>> 24) & 0xff;
  }

  return state.slice(0, 32);
}
