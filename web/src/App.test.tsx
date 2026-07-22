// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Report } from '../../src/checks';
import type { Extraction } from '../../src/extract';
import { App } from './App';

const REPORT: Report = {
  company: 'Northwind Materials Inc.',
  generatedAt: '2026-07-15T12:00:00.000Z',
  findings: [
    {
      checkId: 'revenue-concentration',
      label: 'Revenue concentration',
      verdict: 'flagged',
      summary: 'Revenue concentrated in one customer (~62% of revenue).',
      citations: [
        {
          company: 'Northwind Materials Inc.',
          sourceType: '10-K',
          title: 'FY2025 Form 10-K',
          ordinal: 1,
          score: 0.45,
          snippet: 'sales to our single largest customer, Pallas Automotive Group…',
        },
        {
          company: 'Northwind Materials Inc.',
          sourceType: 'filing-summary',
          title: 'FY2025 Filing Summary (PDF)',
          ordinal: 0,
          score: 0.38,
          snippet: 'Customer concentration: approximately 62% of total net revenue…',
        },
      ],
    },
    {
      checkId: 'going-concern',
      label: 'Going concern',
      verdict: 'clear',
      summary: 'No going-concern doubt.',
      citations: [
        {
          company: 'Northwind Materials Inc.',
          sourceType: '10-K',
          title: 'FY2025 Form 10-K',
          ordinal: 3,
          score: 0.31,
          snippet: 'substantial doubt … does not exist.',
        },
      ],
    },
  ],
};

const EXTRACTION: Extraction = {
  revenueConcentration: {
    largestCustomerPct: 62,
    largestCustomer: 'Pallas Automotive Group',
    evidence: 'sales to our single largest customer…',
  },
  relatedParties: [],
  goingConcern: { substantialDoubt: false, evidence: null },
  auditor: { changed: false, auditorName: null, evidence: null },
};

type Handler = (url: string) => { status: number; body: unknown } | undefined;

function stubFetch(handler: Handler) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const match = handler(url) ?? { status: 404, body: { error: `unhandled ${url}` } };
      return Promise.resolve({
        ok: match.status < 400,
        status: match.status,
        statusText: String(match.status),
        json: () => Promise.resolve(match.body),
      } as Response);
    }),
  );
}

const routes = (overrides: Record<string, { status: number; body: unknown }> = {}): Handler => {
  return (url) => {
    for (const [prefix, response] of Object.entries(overrides)) {
      if (url.startsWith(prefix)) return response;
    }
    if (url.startsWith('/companies'))
      return { status: 200, body: { companies: ['Northwind Materials Inc.'] } };
    if (url.startsWith('/report/')) return { status: 200, body: REPORT };
    if (url.startsWith('/extract/'))
      return {
        status: 200,
        body: {
          company: 'Northwind Materials Inc.',
          documents: [
            { title: '10-K excerpt', sourceType: '10-K', extraction: null },
            {
              title: 'FY2025 Filing Summary (PDF)',
              sourceType: 'filing-summary',
              extraction: EXTRACTION,
            },
          ],
        },
      };
    return undefined;
  };
};

describe('App', () => {
  beforeEach(() => {
    stubFetch(routes());
  });
  afterEach(() => {
    // RTL only auto-cleans under vitest globals, which this repo doesn't use.
    cleanup();
    vi.unstubAllGlobals();
  });

  it('runs a report: verdict strip, every citation, extraction from the filing summary', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Northwind Materials Inc.' }));

    expect(await screen.findByText('1 flag · 2 checks ·', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Verdicts' })).toBeInTheDocument();
    // both citations of the flagged finding render, not just the first
    expect(screen.getByText(/single largest customer, Pallas/)).toBeInTheDocument();
    expect(screen.getByText(/approximately 62% of total net revenue/)).toBeInTheDocument();
    // extraction fields come from the filing-summary document, not the null 10-K one
    expect(screen.getByText('Pallas Automotive Group')).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();
    // open on the flagged check only
    const panels = document.querySelectorAll('details.extract');
    expect(panels[0]).toHaveAttribute('open');
    expect(panels[1]).not.toHaveAttribute('open');
  });

  it('still renders the report when /extract fails (progressive enhancement)', async () => {
    stubFetch(routes({ '/extract/': { status: 500, body: { error: 'boom' } } }));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Northwind Materials Inc.' }));

    expect(await screen.findByText(/Revenue concentrated in one customer/)).toBeInTheDocument();
    expect(document.querySelector('details.extract')).toBeNull();
  });

  it('explains a 429 in plain language', async () => {
    stubFetch(routes({ '/report/': { status: 429, body: { error: 'rate limited' } } }));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Northwind Materials Inc.' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/rate limit reached/i);
  });

  it('searches via a suggestion chip and renders scored results', async () => {
    stubFetch(
      routes({
        '/search': {
          status: 200,
          body: {
            query: 'going concern',
            count: 1,
            results: [
              {
                content: 'x'.repeat(500),
                ordinal: 2,
                company: 'Helios Robotics Corp.',
                sourceType: '10-K',
                title: 'FY2025 Form 10-K',
                score: 0.41,
              },
            ],
          },
        },
      }),
    );
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'going concern' }));

    expect(await screen.findByText('1 result')).toBeInTheDocument();
    expect(screen.getByText('cosine 0.41')).toBeInTheDocument();
    expect(screen.getByText('Show full chunk')).toBeInTheDocument();
  });
});
