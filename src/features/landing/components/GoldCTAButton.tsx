import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Props = {
  to?: string;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
};

export function GoldCTAButton({
  to,
  href,
  onClick,
  children,
  className = "",
}: Props) {
  const content = (
    <>
      <span>{children}</span>
      <ArrowRight size={18} strokeWidth={2} />
    </>
  );
  const cls = `landing-btn-primary ${className}`.trim();

  if (to)
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  if (href)
    return (
      <a href={href} className={cls}>
        {content}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}
