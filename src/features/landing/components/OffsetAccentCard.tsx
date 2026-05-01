type Props = {
  children: React.ReactNode;
  className?: string;
};

export function OffsetAccentCard({ children, className = "" }: Props) {
  return (
    <div className={`relative inline-block ${className}`}>
      <div className="landing-card-offset relative z-10">{children}</div>
    </div>
  );
}
