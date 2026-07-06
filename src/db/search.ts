import { cosineDistance, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from './client';
import { chunks, documents } from './schema';

/** A retrieved chunk with the citation fields needed for an audit-grade report. */
export interface CitedChunk {
  content: string;
  ordinal: number;
  company: string;
  sourceType: string;
  title: string;
  /** Cosine similarity in [0, 1]; higher is closer. */
  score: number;
}

/**
 * Cosine top-k over the chunk embeddings, joined to their source document for
 * citation. Pure DB — takes a query *vector*, not text, so it can be tested
 * without calling an embedding provider. The order-by uses `cosineDistance`
 * (`<=>`), which matches the `vector_cosine_ops` HNSW index on `chunks.embedding`.
 */
export async function searchByVector(embedding: number[], k = 5): Promise<CitedChunk[]> {
  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, embedding)})`;
  return db
    .select({
      content: chunks.content,
      ordinal: chunks.ordinal,
      company: documents.company,
      sourceType: documents.sourceType,
      title: documents.title,
      score: similarity,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(isNotNull(chunks.embedding))
    .orderBy(desc(similarity))
    .limit(k);
}
