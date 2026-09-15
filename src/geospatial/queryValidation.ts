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
  if (!/\bLIMIT\s+\d+\b/i.test(normalized)) return `${normalized} LIMIT ${Math.max(1, Math.floor(maxRows))}`;
  return normalized.replace(/\bLIMIT\s+(\d+)\b/i, (_match, value: string) => `LIMIT ${Math.min(Number(value), maxRows)}`);
}

