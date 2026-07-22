import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generate the text-layer PDF fixtures (M6). Committed and reproducible: run
 * `npm run fixtures:pdf` to regenerate `fixtures/<slug>/filing-summary.pdf` from
 * the summaries below. We commit the resulting `.pdf` binaries (CI never renders
 * them — keeps CI dependency-free), and keep this generator so the fixtures are
 * walkable cold: a reviewer can see exactly what text each PDF carries.
 *
 * Each summary deliberately restates that company's planted signals so the PDF,
 * once ingested, *reinforces* the golden verdicts (M4) rather than perturbing
 * them — and carries all four check signals so extraction (M6) has a single
 * consolidated source. No external PDF library: we emit a minimal, valid,
 * uncompressed single-page PDF whose text pdf.js/unpdf reads back cleanly.
 */

interface Fixture {
  slug: string;
  text: string;
}

const FIXTURES: Fixture[] = [
  {
    slug: 'northwind-materials',
    text: [
      'Northwind Materials Inc. - FY2025 filing summary.',
      'Customer concentration: For fiscal 2025, sales to our single largest customer, Pallas Automotive Group, represented approximately 62% of total net revenue, up from 58% in 2024.',
      "Auditor: On February 3, 2025, the Audit Committee dismissed Barrow & Finch LLP and engaged Crestline Audit LLP as the Company's independent registered public accounting firm.",
      'Going concern: The Company concluded that substantial doubt about its ability to continue as a going concern does not exist.',
      'Related-party transactions: There were no material related-party transactions during the year other than director remuneration.',
    ].join('\n'),
  },
  {
    slug: 'helios-robotics',
    text: [
      'Helios Robotics Corp. - FY2025 filing summary.',
      "Going concern: These conditions raise substantial doubt about the Company's ability to continue as a going concern within one year.",
      "Related-party transactions: The Company leases its Reno headquarters from Vega Holdings LLC, an entity controlled by the Chief Executive Officer, Dr. Ana Vega; the lease was not negotiated at arm's length.",
      'Customer concentration: No single customer accounted for more than 10% of revenue in fiscal 2025.',
      'Auditor: There were no changes of auditor during the year.',
    ].join('\n'),
  },
  {
    slug: 'meridian-foods',
    text: [
      'Meridian Foods PLC - FY2025 filing summary.',
      'Customer base: No single customer accounted for more than 8% of Group revenue in the year; the Directors do not consider the Group dependent on any single customer.',
      "Auditor: The Group's independent auditor, Kingsbridge LLP, has served since 2019 and was reappointed at the 2025 Annual General Meeting; there were no changes of auditor during the year.",
      'Going concern: The Directors adopted the going-concern basis of accounting and identified no material uncertainty.',
      'Related-party transactions: There were no material related-party transactions during the year other than key management remuneration.',
    ].join('\n'),
  },
];

function escapePdfText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Wrap paragraphs to a page-friendly width; PDF text objects do not auto-wrap. */
function wrapLines(text: string, width = 92): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (para.trim() === '') {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(/\s+/)) {
      if (line && line.length + 1 + word.length > width) {
        out.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) out.push(line);
    out.push(''); // blank line between paragraphs
  }
  return out;
}

/** Emit a minimal, valid, uncompressed single-page PDF (WinAnsi text). */
function makeTextPdf(text: string): Buffer {
  const lines = wrapLines(text);
  let content = 'BT\n/F1 11 Tf\n15 TL\n56 760 Td\n';
  for (const line of lines) content += `(${escapePdfText(line)}) Tj\nT*\n`;
  content += 'ET';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

for (const { slug, text } of FIXTURES) {
  // The PDF is serialized as latin1/WinAnsi, so anything outside Latin-1 (em
  // dashes, curly quotes — common when pasting real filing text) would be
  // silently mangled in the text layer. Reject it instead.
  const bad = /[\u{100}-\u{10ffff}]/u.exec(text)?.[0];
  if (bad !== undefined) {
    throw new Error(
      `[fixtures:pdf] ${slug}: "${bad}" is outside Latin-1 and would corrupt the ` +
        'WinAnsi text layer — replace it with an ASCII equivalent.',
    );
  }
  const path = join(FIXTURES_DIR, slug, 'filing-summary.pdf');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, makeTextPdf(text));
  console.log(`[fixtures:pdf] wrote ${slug}/filing-summary.pdf`);
}
