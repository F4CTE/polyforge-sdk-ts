import { keccak256 } from './keccak.js';

/**
 * EIP-55 checksummed address (with backwards-compatible fallback for short
 * addresses).
 *
 * Full-length (40-hex-char) addresses are converted to the EIP-55 checksummed
 * form using Keccak-256.  Shorter or otherwise non-standard addresses are
 * simply lowercased – matching the legacy `.toLowerCase()` behaviour used by
 * POLA-9887.
 *
 * Zero external dependencies – uses an inline keccak-f1600 permutation.
 *
 * Implementation matches ethers.js `getAddress`: iterates over 40 chars in
 * pairs, checking high/low nibbles of the 32-byte Keccak-256 digest.
 */
export function eip55Checksum(address: string): string {
  const raw = address.replace(/^0x/i, '');

  // Non-standard length → fallback to lowercase (POLA-9887 compat)
  if (raw.length !== 40) {
    return '0x' + raw.toLowerCase();
  }

  // Hash the lowercase address bytes using Keccak-256 (original, not SHA3).
  const hashBytes = keccak256(raw.toLowerCase());

  // EIP-55: iterate over 40 address chars in pairs; each hash byte provides
  // two nibbles (high nibble for char[i], low nibble for char[i+1]).
  let result = '0x';
  const lowerRaw = raw.toLowerCase();
  for (let i = 0; i < 40; i++) {
    const byteIdx = i >> 1;
    const hashDigit = (i & 1) === 0 ? (hashBytes[byteIdx] >> 4) : (hashBytes[byteIdx] & 0x0f);
    const char = lowerRaw[i];
    result += hashDigit >= 8 ? char.toUpperCase() : char.toLowerCase();
  }

  return result;
}
