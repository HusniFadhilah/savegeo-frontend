/** Permit absolute HTTP(S) links from provider data without embedded credentials. */
export function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || Array.from(value).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) return undefined;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
