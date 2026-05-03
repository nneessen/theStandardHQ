export function ProgressBar({
  value,
  max = 100,
  className = "",
  size = "sm",
}: {
  value: number;
  max?: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const height = size === "sm" ? "h-1" : "h-1.5";

  return (
    <div
      className={`w-full bg-v2-ring dark:bg-v2-ring-strong rounded-full ${height} ${className}`}
    >
      <div
        className={`${height} rounded-full transition-all duration-300 ${
          pct === 100 ? "bg-success" : pct > 50 ? "bg-info" : "bg-warning"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
