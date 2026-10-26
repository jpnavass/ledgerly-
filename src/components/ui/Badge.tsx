import React from 'react';
import {
  FileEdit,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Receipt,
  FileCheck,
  BadgeCheck,
  PieChart,
  Ban,
  HelpCircle,
} from 'lucide-react';
import type { DocStatus, Tone } from '@/types';
import { DOC_STATUS_TONE, DOC_STATUS_LABELS } from '@/types';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  FileEdit,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Receipt,
  FileCheck,
  BadgeCheck,
  PieChart,
  Ban,
};

export interface BadgeProps {
  tone?: Tone;
  status?: DocStatus;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function Badge({ tone, status, children, icon, className = '' }: BadgeProps) {
  const resolvedTone: Tone = tone || (status ? DOC_STATUS_TONE[status] : 'neutral');
  const label = children || (status ? DOC_STATUS_LABELS[status] : '');

  let renderedIcon = icon;
  if (!renderedIcon && status) {
    const iconName = status === 'issued' ? 'FileCheck' : (DOC_STATUS_TONE[status] ? 'CheckCircle2' : 'HelpCircle');
    const IconComp = ICON_MAP[iconName] || HelpCircle;
    renderedIcon = <IconComp size={12} className="flex-shrink-0" />;
  }

  return (
    <span className={`badge ${className}`} data-tone={resolvedTone}>
      {renderedIcon}
      <span>{label}</span>
    </span>
  );
}
