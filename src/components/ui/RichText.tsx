import { Fragment } from "react";

/**
 * Renders a translated string's lightweight `**bold**` / `*italic*` markup
 * as real `<strong>`/`<em>` tags. Translation strings are plain text (see
 * i18n/translations.ts), so components that used inline JSX emphasis
 * (`<strong>{year}</strong>`) before being wired to `t()` route their
 * markdown-ish translated string through this instead of losing the
 * emphasis entirely.
 */
export default function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
