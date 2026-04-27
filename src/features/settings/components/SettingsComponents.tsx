// src/features/settings/components/SettingsComponents.tsx
// Redesigned with zinc palette and compact design patterns

import React from "react";

interface SettingsCardProps {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  children,
  icon,
  className = "",
}) => {
  return (
    <div className={`bg-v2-card rounded-lg border border-v2-ring ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-v2-ring/60">
        <h4 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
          {title}
        </h4>
        {icon && <div className="text-v2-ink-subtle">{icon}</div>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
};

interface SettingsHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-2 border border-v2-ring mb-2">
      <div>
        <h1 className="text-sm font-semibold text-v2-ink">{title}</h1>
        {description && (
          <p className="text-[11px] text-v2-ink-muted">{description}</p>
        )}
      </div>
      {children && <div>{children}</div>}
    </div>
  );
};

interface SettingsGridProps {
  children: React.ReactNode;
  columns?: number;
}

export const SettingsGrid: React.FC<SettingsGridProps> = ({
  children,
  columns = 2,
}) => {
  const gridColsClass =
    {
      1: "grid-cols-1",
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
    }[columns] || "grid-cols-2";

  return <div className={`grid ${gridColsClass} gap-2`}>{children}</div>;
};
