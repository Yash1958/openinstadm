/**
 * Runtime execution mode helper.
 *
 * When REDIS_URL is omitted in production (or SERVERLESS_MODE=true), OpenInstaDM
 * runs 100% serverless on Vercel + Postgres without Redis or a separate worker.
 */
export function isServerlessMode(): boolean {
  if (process.env.SERVERLESS_MODE === "true") return true;
  if (process.env.SERVERLESS_MODE === "false") return false;
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return false;
  return !process.env.REDIS_URL;
}
