'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type TemplatePackOption = {
  id: string;
  name: string;
  isPrimary?: boolean;
};

export function TemplatePackFilter({
  value,
  onChange,
  packs,
}: {
  value: string;
  onChange: (packId: string) => void;
  packs: TemplatePackOption[];
}) {
  if (packs.length <= 1) return null;

  return (
    <Select value={value || '__all__'} onValueChange={(v) => onChange(v === '__all__' ? '' : v)}>
      <SelectTrigger className="w-52">
        <SelectValue placeholder="Все паки" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">Все паки</SelectItem>
        {packs.map((pack) => (
          <SelectItem key={pack.id} value={pack.id}>
            {pack.name}
            {pack.isPrimary ? ' (основной)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
