import { describe, expect, it } from 'vitest';
import { chunkText } from '../src/chunk';

describe('chunkText', () => {
  it('keeps a short document as a single chunk', () => {
    expect(chunkText('One short paragraph.')).toEqual(['One short paragraph.']);
  });

  it('splits on blank lines and drops empty paragraphs', () => {
    const chunks = chunkText('First.\n\n\n   \n\nSecond.', { maxChars: 10 });
    expect(chunks).toEqual(['First.', 'Second.']);
  });

  it('packs whole paragraphs up to maxChars', () => {
    const chunks = chunkText('aaaa\n\nbbbb\n\ncccc', { maxChars: 10 });
    // "aaaa\n\nbbbb" is 10 chars; "cccc" starts a new chunk.
    expect(chunks).toEqual(['aaaa\n\nbbbb', 'cccc']);
  });

  it('hard-splits an oversized paragraph with overlap', () => {
    const chunks = chunkText('abcdefghij', { maxChars: 4, overlap: 1 });
    // step = max(1, 4-1) = 3 → slices at 0,3,6,9
    expect(chunks).toEqual(['abcd', 'defg', 'ghij', 'j']);
    expect(chunks.every((c) => c.length <= 4)).toBe(true);
  });

  it('returns an empty array for whitespace-only input', () => {
    expect(chunkText('   \n\n  ')).toEqual([]);
  });
});
