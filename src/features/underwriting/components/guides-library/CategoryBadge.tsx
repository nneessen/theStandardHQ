import { T } from "@/components/board";
import {
  ACCENT,
  CATEGORY_ACCENT,
  tint,
  type Category,
} from "./guideAttributes";

/**
 * Mono uppercase category pill, color-tinted by category (bg 13% / inset ring
 * 24%). Restrained, fintech-grade — never an initials-in-a-square tile.
 */
export function CategoryBadge({ category }: { category: Category }) {
  const accent = CATEGORY_ACCENT[category];
  return (
    <span
      style={{
        font: `700 10px ${T.mono}`,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: ACCENT[accent],
        background: tint(accent, 13),
        boxShadow: `inset 0 0 0 1px ${tint(accent, 24)}`,
        padding: "2px 7px",
        borderRadius: 5,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {category}
    </span>
  );
}
