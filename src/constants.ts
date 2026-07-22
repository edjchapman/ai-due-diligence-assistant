/**
 * Shared server/UI constants. Deliberately dependency-free: the web app needs
 * these as *value* imports (unlike its type-only imports from server source),
 * so anything imported here would land in the Vite bundle.
 */

/** Public-endpoint rate limit, also interpolated into the UI's 429 copy. */
export const RATE_LIMIT_PER_MINUTE = 60;
