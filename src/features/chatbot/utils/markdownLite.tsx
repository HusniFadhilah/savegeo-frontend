import type { ReactNode } from "react";

/**
 * Renders the tiny markdown subset the backend agent actually uses
 * (**bold**, *italic*, `code`, newlines) as plain React elements - NOT via
 * dangerouslySetInnerHTML. React text nodes are auto-escaped, so this is
 * inherently safe against script/HTML injection from model output, unlike
 * the original vanilla widget's `renderMarkdown()` which built an HTML
 * string (safe there only because it escaped first, but still relied on
 * innerHTML). No DOMPurify needed here since no raw HTML ever touches the
 * DOM: everything is built as JSX elements.
 */
export function renderInlineMarkdown(text: string | null | undefined): ReactNode {
  if (!text) return null;

  const lines = String(text).split("\n");
  const nodes: ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}`} />);
    nodes.push(...renderInlineSegments(line, lineIdx));
  });

  return nodes;
}

/** bold / italic / code within a single line, applied in that precedence order. */
function renderInlineSegments(line: string, lineIdx: number): ReactNode[] {
  const tokenPattern = /(\*\*.+?\*\*|\*.+?\*|`.+?`)/g;
  const parts = line.split(tokenPattern).filter((p) => p !== "");

  return parts.map((part, i) => {
    const key = `${lineIdx}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <span key={key}>{part}</span>;
  });
}
