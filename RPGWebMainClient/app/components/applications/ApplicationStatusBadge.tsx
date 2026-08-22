// app/components/application/ApplicationStatusBadge.tsx
import { Badge } from '@/components/ui/badge';

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'needs_changes'
  | 'approved'
  | 'rejected';

const CONFIG: Record<ApplicationStatus, { label: string; className: string }> = {
  draft:         { label: 'Черновик',       className: 'bg-gray-700 text-gray-300 border-gray-600' },
  submitted:     { label: 'Отправлена',     className: 'bg-blue-900 text-blue-300 border-blue-700' },
  in_review:     { label: 'На проверке',    className: 'bg-yellow-900 text-yellow-300 border-yellow-700' },
  needs_changes: { label: 'Нужны правки',   className: 'bg-orange-900 text-orange-300 border-orange-700' },
  approved:      { label: 'Одобрена',       className: 'bg-green-900 text-green-300 border-green-700' },
  rejected:      { label: 'Отклонена',      className: 'bg-red-900 text-red-300 border-red-700' },
};

interface Props {
  status: ApplicationStatus | string;
  className?: string;
}

export function ApplicationStatusBadge({ status, className }: Props) {
  const cfg = CONFIG[status as ApplicationStatus] ?? {
    label: status,
    className: 'bg-gray-700 text-gray-300 border-gray-600',
  };

  return (
    <Badge
      variant="outline"
      className={`${cfg.className} ${className ?? ''}`}
    >
      {cfg.label}
    </Badge>
  );
}
