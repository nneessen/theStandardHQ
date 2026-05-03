// src/features/documents/components/ExpiringDocumentsWidget.tsx
import { useExpiringDocuments } from "@/hooks";
import {
  DOCUMENT_TYPE_LABELS,
  type InsuranceDocumentType,
} from "@/types/documents.types";
// eslint-disable-next-line no-restricted-imports
import { documentExpirationService } from "@/services/documents/DocumentExpirationService";
// eslint-disable-next-line no-restricted-imports
import type { UserDocumentEntity } from "@/services/documents/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, CalendarClock, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpiringDocumentsWidgetProps {
  userId: string;
  className?: string;
  maxItems?: number;
  showTitle?: boolean;
}

/**
 * Dashboard widget showing documents expiring soon
 * Color-coded by urgency: red (<30d), yellow (30-60d), blue (60-90d)
 */
export function ExpiringDocumentsWidget({
  userId,
  className,
  maxItems = 5,
  showTitle = true,
}: ExpiringDocumentsWidgetProps) {
  const { data, isLoading, error } = useExpiringDocuments(userId);

  if (isLoading) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileWarning className="h-4 w-4" />
              Expiring Documents
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("border-destructive/50", className)}>
        <CardContent className="pt-4">
          <p className="text-sm text-destructive">
            Failed to load expiring documents
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.counts.total === 0) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileWarning className="h-4 w-4" />
              Expiring Documents
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No documents expiring in the next 90 days
          </p>
        </CardContent>
      </Card>
    );
  }

  // Combine all documents and sort by expiration date
  const allDocs = [
    ...data.critical.map((d) => ({ ...d, urgency: "critical" as const })),
    ...data.warning.map((d) => ({ ...d, urgency: "warning" as const })),
    ...data.upcoming.map((d) => ({ ...d, urgency: "upcoming" as const })),
  ]
    .sort((a, b) => {
      if (!a.expiresAt || !b.expiresAt) return 0;
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    })
    .slice(0, maxItems);

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileWarning className="h-4 w-4" />
              Expiring Documents
            </CardTitle>
            <ExpirationBadges counts={data.counts} />
          </div>
        </CardHeader>
      )}
      <CardContent className="space-y-1 pt-0">
        {allDocs.map((doc) => (
          <ExpiringDocumentRow
            key={doc.id}
            document={doc}
            urgency={doc.urgency}
          />
        ))}
        {data.counts.total > maxItems && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            +{data.counts.total - maxItems} more expiring documents
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Badge group showing counts by urgency level
 */
function ExpirationBadges({
  counts,
}: {
  counts: { critical: number; warning: number; upcoming: number };
}) {
  return (
    <div className="flex gap-1">
      {counts.critical > 0 && (
        <Badge variant="destructive" className="text-xs px-1.5 py-0">
          {counts.critical}
        </Badge>
      )}
      {counts.warning > 0 && (
        <Badge className="text-xs px-1.5 py-0 bg-warning hover:bg-warning">
          {counts.warning}
        </Badge>
      )}
      {counts.upcoming > 0 && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0">
          {counts.upcoming}
        </Badge>
      )}
    </div>
  );
}

/**
 * Single row for an expiring document
 */
function ExpiringDocumentRow({
  document,
  urgency,
}: {
  document: UserDocumentEntity;
  urgency: "critical" | "warning" | "upcoming";
}) {
  const daysUntil = documentExpirationService.getDaysUntilExpiration(
    document.expiresAt,
  );

  const urgencyConfig = {
    critical: {
      icon: AlertTriangle,
      textColor: "text-destructive",
      bgColor: "bg-destructive/10",
      borderColor: "border-l-red-500",
    },
    warning: {
      icon: Clock,
      textColor: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-l-yellow-500",
    },
    upcoming: {
      icon: CalendarClock,
      textColor: "text-info",
      bgColor: "bg-info/10",
      borderColor: "border-l-blue-500",
    },
  };

  const config = urgencyConfig[urgency];
  const Icon = config.icon;

  const label =
    DOCUMENT_TYPE_LABELS[document.documentType as InsuranceDocumentType] ||
    document.documentType;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-md border-l-2 text-sm",
        config.bgColor,
        config.borderColor,
      )}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", config.textColor)} />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{document.documentName || label}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <div
        className={cn(
          "text-xs font-medium whitespace-nowrap",
          config.textColor,
        )}
      >
        {daysUntil !== null && daysUntil <= 0
          ? "Expired"
          : daysUntil === 1
            ? "1 day"
            : `${daysUntil} days`}
      </div>
    </div>
  );
}

/**
 * Compact badge for use in headers/navigation
 * Shows total count with color based on highest urgency
 */
export function ExpiringDocumentsBadge({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const { data } = useExpiringDocuments(userId);

  if (!data || data.counts.total === 0) return null;

  const hasCritical = data.counts.critical > 0;
  const hasWarning = data.counts.warning > 0;

  return (
    <Badge
      variant={
        hasCritical ? "destructive" : hasWarning ? "default" : "secondary"
      }
      className={cn(
        "text-xs",
        hasWarning && !hasCritical && "bg-warning hover:bg-warning",
        className,
      )}
    >
      {data.counts.total}
    </Badge>
  );
}

export default ExpiringDocumentsWidget;
