const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FORBIDDEN = /(?:;|--|\/\*|\*\/|\b(?:COPY|ATTACH|DETACH|INSTALL|LOAD|EXPORT|IMPORT|CREATE|DROP|ALTER|INSERT|UPDATE|DELETE|PRAGMA)\b)/i;

export const DEFAULT_QUERY_LIMIT = 1000;

export function validateIdentifier(identifier: string): string {
  if (!IDENTIFIER.test(identifier)) throw new Error("spatial.invalidIdentifier");
  return `"${identifier}"`;
}

export function validateSpatialQuery(sql: string, maxRows = DEFAULT_QUERY_LIMIT): string {
  const normalized = sql.trim();
  if (!normalized || normalized.length > 50_000 || FORBIDDEN.test(normalized)) throw new Error("spatial.invalidQuery");
  if (!/^SELECT\b/i.test(normalized) && !/^WITH\b/i.test(normalized)) throw new Error("spatial.readOnlyQuery");
  if (!Number.isFinite(maxRows)) throw new Error("spatial.invalidQuery");
  // Bound the complete result without rewriting quoted strings, CTEs or
  // nested limits. This is browser UX; it never authorizes SQL on the server.
  const limit = Math.min(10_000, Math.max(1, Math.floor(maxRows)));
  return `SELECT * FROM (${normalized}) AS savegeo_result LIMIT ${limit}`;
}

