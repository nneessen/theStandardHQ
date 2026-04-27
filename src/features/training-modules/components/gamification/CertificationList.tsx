import { useUserCertifications } from "../../hooks/useTrainingGamification";
import { CertificationCard } from "./CertificationCard";
import { Loader2 } from "lucide-react";

export function CertificationList() {
  const { data: certs = [], isLoading } = useUserCertifications();

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {certs.map((cert) => (
        <CertificationCard key={cert.id} userCert={cert} />
      ))}
      {certs.length === 0 && (
        <div className="text-center py-6 text-xs text-v2-ink-subtle">
          No certifications yet
        </div>
      )}
    </div>
  );
}
