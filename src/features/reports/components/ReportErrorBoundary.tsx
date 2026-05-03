// src/features/reports/components/ReportErrorBoundary.tsx

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Called when user clicks retry - use to invalidate queries before re-render */
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for report components.
 * Catches render errors and displays a user-friendly error state.
 *
 * When a render error occurs (e.g., due to malformed data), the onRetry callback
 * allows invalidating cached queries before re-rendering, ensuring fresh data is fetched.
 */
export class ReportErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Report render error:", error, errorInfo);
  }

  handleRetry = () => {
    // Invalidate queries first to ensure fresh data on re-render
    this.props.onRetry?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 bg-v2-card rounded-lg border border-destructive/30">
          <div className="flex flex-col items-center text-center">
            <AlertTriangle className="w-8 h-8 text-destructive mb-3" />
            <h3 className="text-sm font-semibold text-v2-ink mb-1">
              Report Error
            </h3>
            <p className="text-xs text-v2-ink-muted mb-4 max-w-md">
              An error occurred while rendering this report. This may be due to
              unexpected data format.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="gap-2"
            >
              <RefreshCw className="w-3 h-3" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Props for QueryErrorAlert component
 */
interface QueryErrorAlertProps {
  title: string;
  errors: Array<{ name: string; error: Error | null }>;
  onRetry?: () => void;
}

/**
 * Displays query-level errors for report components.
 * Use this when one or more queries fail but the component doesn't crash.
 */
export function QueryErrorAlert({
  title,
  errors,
  onRetry,
}: QueryErrorAlertProps) {
  const failedQueries = errors.filter((e) => e.error !== null);

  if (failedQueries.length === 0) return null;

  return (
    <div className="p-4 bg-warning/10 rounded-lg border border-warning/30 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-warning">{title}</h4>
          <ul className="mt-1 text-xs text-warning space-y-0.5">
            {failedQueries.map(({ name, error }) => (
              <li key={name}>
                <span className="font-medium">{name}:</span>{" "}
                {error?.message || "Unknown error"}
              </li>
            ))}
          </ul>
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="mt-2 h-7 text-xs text-warning hover:text-warning hover:bg-warning/20 dark:text-warning"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Props for full-page error state
 */
interface ReportQueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

/**
 * Full error state when primary report data fails to load.
 */
export function ReportQueryError({ message, onRetry }: ReportQueryErrorProps) {
  return (
    <div className="p-8 bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      <div className="flex flex-col items-center text-center">
        <div className="p-3 bg-destructive/20 dark:bg-destructive/30 rounded-full mb-4">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <h3 className="text-sm font-semibold text-v2-ink mb-1">
          Failed to Load Report
        </h3>
        <p className="text-xs text-v2-ink-muted mb-4 max-w-md">
          {message ||
            "An error occurred while loading the report data. Please try again."}
        </p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-2"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
