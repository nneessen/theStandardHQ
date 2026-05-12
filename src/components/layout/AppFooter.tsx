import { Link } from "@tanstack/react-router";

export function AppFooter() {
  return (
    <footer className="border-t border-border/40 px-6 py-3 text-xs text-muted-foreground">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          &copy; {new Date().getFullYear()} Nick Neessen. All rights reserved.{" "}
          <span className="hidden sm:inline">
            The Standard HQ&trade; is owned and operated by Nick Neessen as an
            independent commercial software product.
          </span>
        </p>
        <nav className="flex items-center gap-4">
          <Link to="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <Link
            to="/privacy"
            className="transition-colors hover:text-foreground"
          >
            Privacy
          </Link>
          <a
            href="mailto:support@thestandardhq.com"
            className="transition-colors hover:text-foreground"
          >
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
}
