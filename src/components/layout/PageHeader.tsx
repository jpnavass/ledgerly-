import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  badge?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}

export function PageHeader({
  breadcrumbs,
  title,
  badge,
  description,
  actions,
  secondaryActions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Migas de pan" className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1.5">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.label}>
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-[var(--text-primary)] transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={isLast ? 'text-[var(--text-primary)] font-medium' : ''}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <ChevronRight size={12} className="text-[var(--text-tertiary)]" />}
                </React.Fragment>
              );
            })}
          </nav>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl">{description}</p>
        )}
      </div>

      {(actions || secondaryActions) && (
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {secondaryActions}
          {actions}
        </div>
      )}
    </div>
  );
}
