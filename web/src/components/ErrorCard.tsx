import { RATE_LIMIT_PER_MINUTE } from '../../../src/constants';
import { ApiError } from '../api';

interface ErrorCardProps {
  error: unknown;
  verb: string;
}

export function ErrorCard({ error, verb }: ErrorCardProps) {
  const message =
    error instanceof ApiError && error.status === 429
      ? `Rate limit reached — the public demo allows ${RATE_LIMIT_PER_MINUTE} requests a minute. Try again shortly.`
      : `Could not ${verb}: ${error instanceof Error ? error.message : String(error)}`;
  return (
    <div className="card error-card" role="alert">
      {message}
    </div>
  );
}
