import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Decode a PDF's text layer to plain text (M6). This is the "front-door" that
 * lets a real filing PDF flow through the *same* ingest pipeline as the Markdown
 * fixtures: decode → `chunkText` → `embedTexts` → pgvector, and (M6) structured
 * extraction on the decoded text.
 *
 * Two providers, selected by `PDF_PROVIDER` (mirrors the embed/reason/judge
 * switches):
 *   - `local` (default): `unpdf` — a serverless build of pdf.js, pure-JS, no
 *     native deps, no key. Text-layer extraction only (the fixtures are
 *     text-layer PDFs). This is what keeps `make demo`/tests/CI keyless.
 *   - `textract`: a *documented swap*, not built. Amazon Textract is the target
 *     for OCR / scanned filings (mirrors ADR 0001's Railway-vs-AWS posture); see
 *     ADR 0002 for why it is documented rather than implemented here.
 *
 * Scope is deliberately text-layer only — no OCR, no multi-column layout
 * reconstruction (see ADR 0002 / M6 non-goals).
 */
export async function decodePdf(bytes: Uint8Array): Promise<string> {
  if (process.env.PDF_PROVIDER === 'textract') {
    throw new Error(
      'PDF_PROVIDER=textract is a documented swap, not built — see docs/adr/0002-pdf-extraction.md',
    );
  }
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}
