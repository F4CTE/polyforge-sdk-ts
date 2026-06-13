import { describe, it, expect } from 'vitest';
import { eip55Checksum } from '../utils/address.js';

describe('eip55Checksum', () => {
  it('returns the known EIP-55 checksum for 0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed', () => {
    expect(eip55Checksum('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    );
  });

  it('preserves an address that is already EIP-55 checksummed', () => {
    expect(eip55Checksum('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    );
  });

  it('lowercases addresses shorter than 40 hex chars', () => {
    expect(eip55Checksum('0xAbC')).toBe('0xabc');
    expect(eip55Checksum('0xABC')).toBe('0xabc');
  });

  it('strips 0x prefix regardless of case', () => {
    expect(eip55Checksum('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    );
    expect(eip55Checksum('5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    );
  });

  it('handles all-uppercase 40-char addresses', () => {
    const upper = '0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED';
    expect(eip55Checksum(upper)).toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
  });

  it('handles mixed-case 40-char addresses', () => {
    const mixed = '0x5AaEb6053f3E94c9B9a09F33669435E7ef1bEAeD';
    expect(eip55Checksum(mixed)).toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
  });

  it('lowercases addresses with wrong length (POLA-9887 compat)', () => {
    expect(eip55Checksum('0x1234')).toBe('0x1234');
    expect(eip55Checksum('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed1')).toBe(
      '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed1',
    );
  });
});
