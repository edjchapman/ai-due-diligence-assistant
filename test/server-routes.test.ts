import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runReport } from '../src/agent';
import { getExtractions, listCompanies, searchByVector } from '../src/db/search';
import { embedQuery } from '../src/embeddings';
import { buildServer } from '../src/server';

// Route-contract tests: keyless and DB-free. The data layer and agent are
// mocked so only the HTTP surface is under test — validation, clamping,
// company resolution, and error bodies.
vi.mock('../src/db/search', () => ({
  listCompanies: vi.fn(),
  searchByVector: vi.fn(),
  getExtractions: vi.fn(),
}));
vi.mock('../src/agent', () => ({ runReport: vi.fn() }));
vi.mock('../src/embeddings', () => ({ embedQuery: vi.fn() }));

const COMPANY = 'Helios Robotics Corp.';

describe('server routes (mocked data layer)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    vi.mocked(listCompanies).mockResolvedValue([COMPANY]);
    vi.mocked(searchByVector).mockResolvedValue([]);
    vi.mocked(getExtractions).mockResolvedValue([]);
    vi.mocked(embedQuery).mockResolvedValue([]);
    vi.mocked(runReport).mockImplementation((company) =>
      Promise.resolve({ company, generatedAt: 'test', findings: [] }),
    );
    app = await buildServer({ logger: false });
  });
  afterAll(() => app.close());

  it('GET /search without q returns the custom 400 body', async () => {
    const res = await app.inject({ method: 'GET', url: '/search' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'query parameter "q" is required' });
  });

  it('GET /search with a blank q returns the same 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/search?q=%20%20' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'query parameter "q" is required' });
  });

  it('GET /search rejects a non-integer k via the route schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/search?q=auditor&k=abc' });
    expect(res.statusCode).toBe(400);
  });

  it('GET /search defaults k to 5 and clamps it to 1–20', async () => {
    const kFor = async (suffix: string): Promise<number | undefined> => {
      vi.mocked(searchByVector).mockClear();
      const res = await app.inject({ method: 'GET', url: `/search?q=auditor${suffix}` });
      expect(res.statusCode).toBe(200);
      return vi.mocked(searchByVector).mock.calls[0]?.[1];
    };
    expect(await kFor('')).toBe(5);
    expect(await kFor('&k=99')).toBe(20);
    expect(await kFor('&k=0')).toBe(1);
    expect(await kFor('&k=7')).toBe(7);
  });

  it('GET /report/:company resolves case-insensitive substrings to the ingested name', async () => {
    const res = await app.inject({ method: 'GET', url: '/report/helios' });
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(runReport)).toHaveBeenCalledWith(COMPANY);
    expect(res.json()).toMatchObject({ company: COMPANY, findings: [] });
  });

  it('GET /report/:company returns 404 for an unknown company', async () => {
    const res = await app.inject({ method: 'GET', url: '/report/nonexistent' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'no ingested company matches "nonexistent"' });
  });

  it('GET /extract/:company returns the extraction envelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/extract/HELIOS' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ company: COMPANY, documents: [] });
  });

  it('GET /extract/:company returns 404 for an unknown company', async () => {
    const res = await app.inject({ method: 'GET', url: '/extract/nonexistent' });
    expect(res.statusCode).toBe(404);
  });
});
