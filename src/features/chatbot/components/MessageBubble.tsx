import { renderInlineMarkdown } from "../utils/markdownLite";

interface Props {
  role: "user" | "assistant";
  text: string;
  image?: string | null;
  file?: { name: string; size_label: string; icon: string } | null;
}

/**
 * A single chat bubble. User text is always plain React text (auto-escaped
 * by React - never dangerouslySetInnerHTML). Assistant text goes through
 * `renderInlineMarkdown`, which builds JSX directly (bold/italic/code/
 * newlines) instead of HTML - so no HTML from the model ever reaches the
 * DOM as markup, sanitized or not.
 */
export default function MessageBubble({ role, text, image, file }: Props) {
  return (
    <div className={`sgc-message sgc-${role}`}>
      <div className="sgc-bubble">
        {image && <img src={`data:image/png;base64,${image}`} className="sgc-img-bubble" alt="lampiran" />}
        {file && (
          <span className="sgc-file-badge">
            <i className={`bi ${file.icon}`} /> {file.name} ({file.size_label})
          </span>
        )}
        {(image || file) && <br />}
        {renderInlineMarkdown(text)}
      </div>
    </div>
  );
}
