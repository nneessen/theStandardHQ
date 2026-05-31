import { useMemo } from "react";
import type {
  EmailBlock,
  EmailBlockStyles,
  EmailFontFamily,
  ImageBlockContent,
  QuoteBlockContent,
  SocialBlockContent,
  ColumnsBlockContent,
  ButtonBlockContent,
} from "@/types/email.types";
import { MODERN_EMAIL_FONTS } from "@/types/email.types";
import { replaceTemplateVariables } from "@/lib/templateVariables";

interface BlockPreviewProps {
  blocks: EmailBlock[];
  variables?: Record<string, string>;
}

// Get ALL inline styles for a block - this is critical for email rendering
function getInlineStyles(styles: EmailBlockStyles): string {
  const parts: string[] = [];

  // Background & colors
  if (styles.backgroundColor && styles.backgroundColor !== "transparent") {
    parts.push(`background-color: ${styles.backgroundColor}`);
  }
  if (styles.textColor) parts.push(`color: ${styles.textColor}`);

  // Typography - MUST be inline for emails
  if (styles.fontFamily) parts.push(`font-family: ${styles.fontFamily}`);
  if (styles.fontSize) parts.push(`font-size: ${styles.fontSize}`);
  if (styles.fontWeight) parts.push(`font-weight: ${styles.fontWeight}`);
  if (styles.lineHeight) parts.push(`line-height: ${styles.lineHeight}`);
  if (styles.letterSpacing)
    parts.push(`letter-spacing: ${styles.letterSpacing}`);

  // Layout
  if (styles.padding) parts.push(`padding: ${styles.padding}`);
  if (styles.alignment) parts.push(`text-align: ${styles.alignment}`);

  // Border
  if (styles.borderStyle && styles.borderStyle !== "none") {
    parts.push(`border-style: ${styles.borderStyle}`);
    if (styles.borderWidth) parts.push(`border-width: ${styles.borderWidth}`);
    if (styles.borderColor) parts.push(`border-color: ${styles.borderColor}`);
  }
  if (styles.borderRadius) parts.push(`border-radius: ${styles.borderRadius}`);

  // Width
  if (styles.width) parts.push(`width: ${styles.width}`);
  if (styles.maxWidth) parts.push(`max-width: ${styles.maxWidth}`);

  return parts.join("; ");
}

// Collect all fonts used in blocks for Google Fonts import
function collectUsedFonts(blocks: EmailBlock[]): EmailFontFamily[] {
  const fonts = new Set<EmailFontFamily>();

  function addBlockFonts(block: EmailBlock) {
    if (block.styles.fontFamily) {
      fonts.add(block.styles.fontFamily);
    }
    // Handle nested blocks in columns
    if (block.type === "columns") {
      const content = block.content as ColumnsBlockContent;
      content.columns.forEach((col) => col.blocks.forEach(addBlockFonts));
    }
  }

  blocks.forEach(addBlockFonts);
  return Array.from(fonts);
}

// Generate Google Fonts import for used fonts
function getGoogleFontsLink(fonts: EmailFontFamily[]): string {
  const googleFonts = MODERN_EMAIL_FONTS.filter(
    (f) => fonts.includes(f.value) && f.googleFont,
  ).map((f) => `${f.googleFont}:wght@${f.weights.join(";")}`);

  if (googleFonts.length === 0) return "";
  return `<link href="https://fonts.googleapis.com/css2?family=${googleFonts.join("&family=")}&display=swap" rel="stylesheet">`;
}

function renderBlockToHtml(
  block: EmailBlock,
  variables: Record<string, string>,
): string {
  const styles = getInlineStyles(block.styles);

  switch (block.type) {
    case "header": {
      const content = block.content as {
        title: string;
        logoUrl?: string;
        showLogo?: boolean;
      };
      const logoHtml =
        content.showLogo && content.logoUrl
          ? `<img src="${content.logoUrl}" alt="Logo" style="max-height: 48px; margin-bottom: 8px;" />`
          : "";
      return `
        <div style="${styles}">
          ${logoHtml}
          <h1 style="margin: 0; font-weight: bold;">${replaceTemplateVariables(content.title, variables)}</h1>
        </div>
      `;
    }

    case "text": {
      const content = block.content as { html: string };
      return `<div style="${styles}">${replaceTemplateVariables(content.html, variables)}</div>`;
    }

    case "button": {
      const content = block.content as ButtonBlockContent;
      const isOutline = content.variant === "outline";
      const isGhost = content.variant === "ghost";
      const bgColor =
        isOutline || isGhost ? "transparent" : content.buttonColor || "#3b82f6";
      const textColor = isOutline
        ? content.buttonColor || "#3b82f6"
        : content.textColor || "#ffffff";
      const border = isOutline
        ? `2px solid ${content.buttonColor || "#3b82f6"}`
        : "none";
      const buttonStyle = `
        display: ${content.fullWidth ? "block" : "inline-block"};
        width: ${content.fullWidth ? "100%" : "auto"};
        padding: 12px 24px;
        background-color: ${bgColor};
        color: ${textColor};
        text-decoration: none;
        border: ${border};
        border-radius: ${block.styles.borderRadius || "6px"};
        font-weight: 500;
        text-align: center;
        box-sizing: border-box;
      `;
      return `
        <div style="${styles}">
          <a href="${content.url || "#"}" style="${buttonStyle}">${replaceTemplateVariables(content.text, variables)}</a>
        </div>
      `;
    }

    case "divider": {
      const content = block.content as {
        color?: string;
        thickness?: number;
        style?: string;
      };
      const hrStyle = `
        border: none;
        border-top: ${content.thickness || 1}px ${content.style || "solid"} ${content.color || "#e5e7eb"};
        margin: 0 16px;
      `;
      return `<div style="padding: 8px 0;"><hr style="${hrStyle}" /></div>`;
    }

    case "spacer": {
      const content = block.content as { height: number };
      return `<div style="height: ${content.height}px;"></div>`;
    }

    case "footer": {
      const content = block.content as {
        text: string;
        showUnsubscribe?: boolean;
      };
      const unsubscribeHtml = content.showUnsubscribe
        ? `<br /><a href="#" style="color: ${block.styles.textColor || "#64748b"}; font-size: 12px;">Unsubscribe</a>`
        : "";
      return `
        <div style="${styles}; font-size: 12px;">
          <p style="margin: 0; white-space: pre-wrap;">${replaceTemplateVariables(content.text, variables)}</p>
          ${unsubscribeHtml}
        </div>
      `;
    }

    case "image": {
      const content = block.content as ImageBlockContent;
      if (!content.src) return "";
      const imgStyle = `max-width: ${content.width || 100}%; height: auto; display: block;`;
      const imgHtml = `<img src="${content.src}" alt="${content.alt || ""}" style="${imgStyle}" />`;
      const wrappedImg = content.linkUrl
        ? `<a href="${content.linkUrl}" target="${content.linkTarget || "_blank"}">${imgHtml}</a>`
        : imgHtml;
      return `<div style="${styles}">${wrappedImg}</div>`;
    }

    case "quote": {
      const content = block.content as QuoteBlockContent;
      const accentColor = content.accentColor || "#3b82f6";
      const quoteStyle = `
        border-left: 4px solid ${accentColor};
        padding: 16px 16px 16px 20px;
        background-color: ${accentColor}10;
        border-radius: 4px;
        font-style: italic;
      `;
      const authorHtml = content.author
        ? `<p style="margin-top: 8px; font-size: 12px; font-style: normal; color: #6b7280;">— ${content.author}</p>`
        : "";
      return `
        <div style="${styles}">
          <div style="${quoteStyle}">
            <p style="margin: 0;">${replaceTemplateVariables(content.text, variables)}</p>
            ${authorHtml}
          </div>
        </div>
      `;
    }

    case "social": {
      const content = block.content as SocialBlockContent;
      const enabledLinks = content.links.filter((l) => l.enabled && l.url);
      if (enabledLinks.length === 0) return "";

      const iconSize = content.iconSize || 24;
      const socialColors: Record<string, string> = {
        facebook: "#1877F2",
        twitter: "#1DA1F2",
        instagram: "#E4405F",
        youtube: "#FF0000",
        email: "#6B7280",
      };

      // SVG paths for social icons (simplified for email compatibility)
      const socialSvgPaths: Record<string, string> = {
        facebook:
          "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
        twitter:
          "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
        instagram:
          "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z",
        youtube:
          "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
        email:
          "M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z",
      };

      const iconsHtml = enabledLinks
        .map((link) => {
          const color = socialColors[link.platform] || "#6B7280";
          const isFilled = content.iconStyle === "filled";
          const bgColor = isFilled ? color : "transparent";
          const iconColor = isFilled ? "#ffffff" : color;
          const border = isFilled ? "" : `border: 2px solid ${color};`;
          const svgPath = socialSvgPaths[link.platform] || "";

          return `<a href="${link.url}" target="_blank" rel="noopener" style="display: inline-block; width: ${iconSize + 12}px; height: ${iconSize + 12}px; background-color: ${bgColor}; border-radius: 50%; margin: 0 4px; text-decoration: none; vertical-align: middle; ${border}">
          <svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="${iconColor}" style="margin: ${(iconSize + 12 - iconSize) / 2}px;">
            <path d="${svgPath}"/>
          </svg>
        </a>`;
        })
        .join("");

      return `<div style="${styles}; text-align: ${block.styles.alignment || "center"};">${iconsHtml}</div>`;
    }

    case "columns": {
      const content = block.content as ColumnsBlockContent;
      const gap = content.gap || 16;
      const columnWidth = content.columnCount === 2 ? "48%" : "31%";
      const columnsHtml = content.columns
        .map((col, _i) => {
          const colContent = col.blocks
            .map((b) => renderBlockToHtml(b, variables))
            .join("");
          return `<td style="width: ${columnWidth}; vertical-align: top; padding: 0 ${gap / 2}px;">${colContent || '<p style="color: #9ca3af; font-size: 12px;">Column ${i + 1}</p>'}</td>`;
        })
        .join("");
      return `
        <div style="${styles}">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>${columnsHtml}</tr>
          </table>
        </div>
      `;
    }

    default:
      return "";
  }
}

export function blocksToHtml(
  blocks: EmailBlock[],
  variables: Record<string, string> = {},
): string {
  const bodyContent = blocks
    .map((block) => renderBlockToHtml(block, variables))
    .join("");

  // Get Google Fonts link for all fonts used in the email
  const usedFonts = collectUsedFonts(blocks);
  const googleFontsLink = getGoogleFontsLink(usedFonts);

  // Default font family (first used font or fallback)
  const defaultFont =
    usedFonts[0] || "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${googleFontsLink}
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: ${defaultFont};
      font-size: 13px;
      line-height: 1.5;
      color: #374151;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-container {
      max-width: 480px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    p {
      margin: 0 0 0.75em 0;
      font-size: 13px;
    }
    p:last-child {
      margin-bottom: 0;
    }
    h1, h2, h3 {
      margin: 0 0 0.5em 0;
    }
    /* Reset for email clients */
    table {
      border-collapse: collapse;
    }
    a {
      color: inherit;
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${bodyContent}
  </div>
</body>
</html>
  `.trim();
}

export function BlockPreview({ blocks, variables = {} }: BlockPreviewProps) {
  const html = useMemo(
    () => blocksToHtml(blocks, variables),
    [blocks, variables],
  );

  return (
    <div className="h-full overflow-auto bg-muted/30 p-2">
      <div className="mx-auto max-w-[480px] rounded border bg-card shadow-sm">
        <iframe
          title="Email Preview"
          srcDoc={html}
          className="h-full min-h-[400px] w-full border-0"
          style={{ height: "calc(100vh - 180px)" }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
