import { Library } from "lucide-react";
import { GuideList } from "./GuideManager";

export default function UnderwritingGuidesPage() {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Library className="h-4 w-4 text-v2-ink" />
          <h1 className="text-base font-semibold tracking-tight text-v2-ink">
            UW Guides
          </h1>
        </div>
        <p className="text-[11px] text-v2-ink-muted">
          Carrier underwriting guides — upload, parse, and extract criteria.
        </p>
      </header>

      <GuideList />
    </div>
  );
}
