import { pgTable, uuid, text, integer, timestamp, vector, index } from 'drizzle-orm/pg-core';

/**
 * Embedding dimensionality. Fixed at column-creation by pgvector, so it lives in
 * one place: OpenAI `text-embedding-3-small` emits 1536-dim vectors (see ADR 0001
 * — cheap embedding model, Anthropic reserved for reasoning). Changing this means
 * an ALTER migration *and* re-embedding the corpus.
 */
export const EMBEDDING_DIMENSIONS = 1536;

/** A source document for a target company (10-K, board minutes, news item). */
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  company: text('company').notNull(),
  sourceType: text('source_type').notNull(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** A retrievable chunk of a document, with its embedding (pgvector). */
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // HNSW index for cosine similarity — the operator class must match the
    // distance function used at query time (`cosineDistance` / `<=>`).
    index('chunks_embedding_hnsw').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);
