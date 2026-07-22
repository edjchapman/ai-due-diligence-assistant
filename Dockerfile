FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# The React demo (web/) builds with dev deps (vite), so it gets its own stage —
# the runtime image ships only the static output, never the toolchain. src/ is
# copied because the frontend imports its API types from the server source.
FROM node:24-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# tsconfig.base.json is the extends target of web/tsconfig.json — esbuild
# resolves the chain while transpiling, so the build fails without it.
COPY vite.config.ts tsconfig.base.json ./
COPY src ./src
COPY web ./web
RUN npm run build:web

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Keyless-by-default so a public demo needs no API keys and costs nothing per
# request. Override to openai / anthropic (with keys) for the real path.
ENV EMBED_PROVIDER=local
ENV LLM_PROVIDER=local
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=web /app/public ./public
EXPOSE 3000
# Apply migrations, seed the reference corpus, then serve.
CMD ["npm", "run", "start:prod"]
