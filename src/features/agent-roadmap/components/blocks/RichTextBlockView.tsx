// src/features/agent-roadmap/components/blocks/RichTextBlockView.tsx
import DOMPurify from "dompurify";
import type { RichTextBlock } from "../../types/contentBlocks";

interface RichTextBlockViewProps {
  block: RichTextBlock;
}

/**
 * Render sanitized rich text. HTML was sanitized on write (TipTapEditor emits
 * sanitized HTML), but we sanitize again on read as defense-in-depth.
 */
// Allow only http(s) and mailto hrefs inside rich text. DOMPurify's default
// regex is stricter than most people assume (it blocks javascript:), but being
// explicit prevents a minor-version regression from opening a hole and makes
// the intent auditable.
const SAFE_URI_RE = /^(?:https?|mailto):/i;

export function RichTextBlockView({ block }: RichTextBlockViewProps) {
  const safeHtml = DOMPurify.sanitize(block.data.html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "a",
      "blockquote",
      "code",
      "pre",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOWED_URI_REGEXP: SAFE_URI_RE,
    // Explicitly forbid known-dangerous attribute names as belt-and-suspenders.
    FORBID_ATTR: ["style", "onerror", "onclick", "onload"],
  });

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none text-zinc-900 dark:text-zinc-100 [&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400 [&_ul]:my-2 [&_ol]:my-2 [&_p]:my-2"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
