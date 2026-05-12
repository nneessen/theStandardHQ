import { Link } from "@tanstack/react-router";
import { FileText, Shield, Mail } from "lucide-react";
import { SoftCard } from "@/components/v2";

export function LegalSettings() {
  return (
    <div className="space-y-4">
      <SoftCard className="p-6">
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Legal &amp; Support
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Documents governing your use of the platform.
        </p>
        <div className="space-y-2">
          <Link
            to="/terms"
            className="flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            className="flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            <Shield className="h-4 w-4 text-muted-foreground" />
            Privacy Policy
          </Link>
          <a
            href="mailto:support@thestandardhq.com"
            className="flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            <Mail className="h-4 w-4 text-muted-foreground" />
            Contact Support
          </a>
        </div>
      </SoftCard>

      <p className="text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Nick Neessen. All rights reserved. The
        Standard HQ&trade; is owned and operated by Nick Neessen as an
        independent commercial software product.
      </p>
    </div>
  );
}
