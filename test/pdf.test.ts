import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodePdf } from '../src/pdf';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

// Keyless: unpdf is pure JS, and the committed fixtures are text-layer PDFs.
describe('decodePdf', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('decodes a committed fixture PDF to its planted text layer', async () => {
    const bytes = new Uint8Array(
      await readFile(join(FIXTURES_DIR, 'helios-robotics', 'filing-summary.pdf')),
    );
    const text = await decodePdf(bytes);
    // The planted going-concern signal the extraction golden set expects.
    expect(text).toContain('substantial doubt');
  });

  it('rejects PDF_PROVIDER=textract as the documented, unbuilt swap', async () => {
    vi.stubEnv('PDF_PROVIDER', 'textract');
    await expect(decodePdf(new Uint8Array())).rejects.toThrow(/documented swap/);
  });

  it('rejects bytes that are not a PDF', async () => {
    await expect(decodePdf(new TextEncoder().encode('not a pdf'))).rejects.toThrow();
  });
});
