import { ShieldCheck, AlertTriangle } from "lucide-react";
import type { TrainingUserCertification } from "../../types/training-module.types";

interface CertificationCardProps {
  userCert: TrainingUserCertification;
}

export function CertificationCard({ userCert }: CertificationCardProps) {
  const cert = userCert.certification;
  const isExpiringSoon =
    userCert.expires_at &&
    new Date(userCert.expires_at).getTime() - Date.now() <
      30 * 24 * 60 * 60 * 1000;

  return (
    <div
      className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${
        userCert.status === "active"
          ? "border-success/30 bg-success/10 dark:bg-success/10"
          : "border-v2-ring dark:border-v2-ring bg-v2-canvas dark:bg-v2-card opacity-60"
      }`}
    >
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center ${
          userCert.status === "active"
            ? "bg-success/20 dark:bg-success/30"
            : "bg-muted dark:bg-v2-card-tinted"
        }`}
      >
        <ShieldCheck
          className={`h-4 w-4 ${
            userCert.status === "active" ? "text-success" : "text-v2-ink-subtle"
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-medium text-v2-ink dark:text-v2-ink">
          {cert?.name}
        </h4>
        <div className="flex items-center gap-2 text-[10px] text-v2-ink-muted">
          <span>
            Earned {new Date(userCert.earned_at).toLocaleDateString()}
          </span>
          {userCert.expires_at && (
            <span
              className={`flex items-center gap-0.5 ${isExpiringSoon ? "text-warning" : ""}`}
            >
              {isExpiringSoon && <AlertTriangle className="h-2.5 w-2.5" />}
              Expires {new Date(userCert.expires_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <span
        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
          userCert.status === "active"
            ? "bg-success/20 dark:bg-success/30 text-success"
            : "bg-v2-ring dark:bg-v2-ring-strong text-v2-ink-muted"
        }`}
      >
        {userCert.status}
      </span>
    </div>
  );
}
