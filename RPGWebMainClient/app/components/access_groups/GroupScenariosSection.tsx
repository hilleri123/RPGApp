'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { accessGroupsApiService } from '@/app/services/api/access_groups';
import {
  MasterGroupScenarioAccess,
  ROLE_ACCESS_LABELS,
  RoleAccess,
} from '@/app/services/types/access_groups';

/**
 * Что группе реально открыто. Выдаёт доступ владелец сценария в его настройках,
 * поэтому здесь только просмотр — иначе состав прав можно было бы менять из двух
 * мест с разными правилами.
 */
export function GroupScenariosSection({ groupId }: { groupId: string }) {
  const [rows, setRows] = useState<MasterGroupScenarioAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    accessGroupsApiService
      .getGroupScenarios(groupId)
      .then((r) => {
        if (!cancelled) {
          setRows(r);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const err = e as { message?: string };
          setError(err?.message || 'Не удалось загрузить сценарии группы');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return (
    <div>
      <h3 className="mb-1 font-bold">Сценарии, открытые группе</h3>
      <p className="mb-3 text-xs text-gray-500">
        Доступ выдаёт владелец сценария на вкладке «Настройки».
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Загружаем…
        </div>
      ) : error ? (
        <div className="text-sm text-red-400">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-500">Пока ни одного</div>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li
              key={row.scenario_id}
              className="flex items-center justify-between gap-2 rounded bg-gray-800 p-2"
            >
              <Link
                href={`/scenarios/${row.scenario_id}`}
                className="min-w-0 truncate hover:underline"
              >
                {row.scenario_name || row.scenario_id}
              </Link>
              <span className="shrink-0 text-sm text-gray-400">
                {ROLE_ACCESS_LABELS[(row.permission || RoleAccess.NONE_ROLE) as RoleAccess]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
