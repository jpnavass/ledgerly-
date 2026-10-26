import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Card({ elevated = false, children, className = '', ...props }: CardProps) {
  return (
    <div className={`${elevated ? 'card-elevated' : 'card'} p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
}

export function StatCard({ label, value, subtext, trend, icon }: StatCardProps) {
  return (
    <Card className="flex flex-col justify-between space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-[var(--text-tertiary)]">{icon}</span>}
      </div>
      <div>
        <div className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)] tabular-nums tracking-tight">
          {value}
        </div>
        {(subtext || trend) && (
          <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-secondary)]">
            {trend && (
              <span
                className={`font-semibold ${
                  trend.isPositive ? 'text-[var(--success-fg)]' : 'text-[var(--danger-fg)]'
                }`}
              >
                {trend.value}
              </span>
            )}
            {subtext && <span>{subtext}</span>}
          </div>
        )}
      </div>
    </Card>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="card p-10 flex flex-col items-center justify-center text-center space-y-4 max-w-lg mx-auto">
      {icon && <div className="p-3 rounded-full bg-[var(--bg-surface-2)] text-[var(--text-secondary)]">{icon}</div>}
      <div className="space-y-1">
        <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
        <p className="text-xs text-[var(--text-secondary)] max-w-sm">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
