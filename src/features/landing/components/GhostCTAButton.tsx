import { Link } from "@tanstack/react-router";

type Props = {
  to?: string;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
};

export function GhostCTAButton({
  to,
  href,
  onClick,
  children,
  className = "",
}: Props) {
  const cls = `landing-btn-ghost ${className}`.trim();
  if (to)
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  if (href)
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
