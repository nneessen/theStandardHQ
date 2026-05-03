// src/features/reports/components/InsightCard.tsx

import React from "react";
import { ActionableInsight } from "../../../types/reports.types";
import { Card } from "../../../components/ui/card";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  Shield,
} from "lucide-react";

interface InsightCardProps {
  insight: ActionableInsight;
  className?: string;
}

export function InsightCard({ insight, className = "" }: InsightCardProps) {
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "critical":
        return {
          border: "border-l-4 border-l-red-500",
          bg: "bg-destructive/10",
          icon: AlertTriangle,
          iconColor: "text-destructive",
          badge:
            "bg-destructive/20 text-destructive dark:bg-destructive dark:text-destructive",
        };
      case "high":
        return {
          border: "border-l-4 border-l-orange-500",
          bg: "bg-warning/10 dark:bg-warning/20",
          icon: AlertCircle,
          iconColor: "text-warning",
          badge: "bg-warning/20 text-warning dark:bg-warning dark:text-warning",
        };
      case "medium":
        return {
          border: "border-l-4 border-l-yellow-500",
          bg: "bg-warning/10 dark:bg-warning/20",
          icon: Info,
          iconColor: "text-warning",
          badge: "bg-warning/20 text-warning dark:bg-warning dark:text-warning",
        };
      case "low":
        return {
          border: "border-l-4 border-l-blue-500",
          bg: "bg-info/10",
          icon: TrendingUp,
          iconColor: "text-info",
          badge: "bg-info/20 text-info dark:bg-info dark:text-info",
        };
      default:
        return {
          border: "border-l-4 border-l-gray-500",
          bg: "bg-muted dark:bg-muted/20",
          icon: Shield,
          iconColor: "text-muted-foreground",
          badge: "bg-muted text-foreground dark:bg-card dark:text-foreground",
        };
    }
  };

  const styles = getSeverityStyles(insight.severity);
  const Icon = styles.icon;

  return (
    <Card className={`${styles.border} ${styles.bg} ${className} p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`${styles.iconColor} w-5 h-5 mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-sm text-foreground leading-tight">
              {insight.title}
            </h3>
            <span
              className={`${styles.badge} px-2 py-0.5 rounded text-xs font-medium uppercase flex-shrink-0`}
            >
              {insight.severity}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-2">
            {insight.description}
          </p>

          {/* Impact */}
          <div className="mb-3 p-2 bg-card rounded border border-border">
            <p className="text-xs font-medium text-foreground">
              <span className="text-muted-foreground">Impact:</span>{" "}
              {insight.impact}
            </p>
          </div>

          {/* Recommended Actions */}
          {insight.recommendedActions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
                Recommended Actions:
              </h4>
              <ul className="space-y-1">
                {insight.recommendedActions.map((action, index) => (
                  <li
                    key={index}
                    className="text-xs text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-primary mt-0.5">•</span>
                    <span className="flex-1">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
