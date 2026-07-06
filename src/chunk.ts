export interface ChunkOptions {
  /** Soft upper bound on chunk length, in characters. */
  maxChars?: number;
  /** Characters of overlap when a single paragraph must be hard-split. */
  overlap?: number;
}

/**
 * Split document text into retrieval-sized chunks. Paragraph-aware: it packs
 * whole paragraphs up to `maxChars`, and only hard-splits (with overlap) a
 * paragraph that is itself longer than the limit. Deliberately simple — the
 * corpus is tiny (guardrail #4); a smarter splitter is not worth the plumbing.
 */
export function chunkText(
  text: string,
  { maxChars = 700, overlap = 120 }: ChunkOptions = {},
): string[] {
  const step = Math.max(1, maxChars - overlap);
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const out: string[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) {
      out.push(buffer);
      buffer = '';
    }
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      flush();
      for (let i = 0; i < paragraph.length; i += step) {
        out.push(paragraph.slice(i, i + maxChars));
      }
      continue;
    }
    if (buffer && buffer.length + 2 + paragraph.length > maxChars) {
      flush();
    }
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
  }
  flush();
  return out;
}
