'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Users } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { accessGroupsApiService } from '@/app/services/api/access_groups';
import {
  MasterGroupScenarioAccess,
  ROLE_ACCESS_HINTS,
  ROLE_ACCESS_LABELS,
  RoleAccess,
} from '@/app/services/types/access_groups';

const PERMISSION_ORDER: RoleAccess[] = [
  RoleAccess.NONE_ROLE,
  RoleAccess.READ_ROLE,
  RoleAccess.EDIT_PARTIAL_ROLE,
  RoleAccess.EDIT_FULL_ROLE,
  RoleAccess.ALL_ROLE,
];

function errorText(e: unknown, fallback: string): string {
  const err = e as { message?: string; detail?: string | { detail?: string } };
  if (typeof err?.detail === 'string') return err.detail;
  if (typeof err?.detail === 'object' && err.detail?.detail) return String(err.detail.detail);
  return err?.message || fallback;
}

/** Кто из групп доступа видит и правит этот сценарий. */
export function ScenarioAccessPanel({ scenarioId }: { scenarioId: string }) {
  const [rows, setRows] = useState<MasterGroupScenarioAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await accessGroupsApiService.getScenarioGroupAccess(scenarioId));
      setError(null);
    } catch (e) {
      setError(errorText(e, 'Не удалось загрузить группы доступа'));
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = async (groupId: string, permission: RoleAccess) => {
    setSavingGroupId(groupId);
    // Оптимистично: селект не должен отскакивать назад на время запроса.
    setRows((prev) =>
      prev.map((r) => (r.master_group_id === groupId ? { ...r, permission } : r)),
    );
    try {
      if (permission === RoleAccess.NONE_ROLE) {
        await accessGroupsApiService.deleteScenarioGroupAccess(scenarioId, groupId).catch(
          // Права могло и не быть — тогда удалять нечего.
          () => undefined,
        );
      } else {
        await accessGroupsApiService.setScenarioGroupAccess(scenarioId, {
          master_group_id: groupId,
          scenario_id: scenarioId,
          permission,
        });
      }
      setError(null);
    } catch (e) {
      setError(errorText(e, 'Не удалось сохранить доступ'));
      await load();
    } finally {
      setSavingGroupId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-white">
          <Users className="h-4 w-4 text-gray-400" />
          Доступ групп
        </h2>
        <p className="text-sm text-gray-500">
          Участники группы получают этот сценарий с выбранным уровнем прав, но не выше собственного уровня участника (задаётся в карточке группы). Владелец
          сценария и администраторы имеют полный доступ всегда.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Загружаем группы…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
          Групп доступа пока нет. Их создаёт администратор в разделе{' '}
          <Link href="/access_groups" className="text-blue-400 hover:underline">
            «Группы»
          </Link>
          .
        </div>
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {rows.map((row) => {
            const permission = (row.permission || RoleAccess.NONE_ROLE) as RoleAccess;
            const memberCount = row.master_group?.users?.length ?? 0;
            return (
              <li
                key={row.master_group_id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-white">
                    {row.master_group?.name || row.master_group_id}
                  </div>
                  <div className="text-xs text-gray-500">
                    {memberCount === 0
                      ? 'Пока без участников'
                      : `Участников: ${memberCount}`}
                    {' · '}
                    {ROLE_ACCESS_HINTS[permission]}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {savingGroupId === row.master_group_id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  ) : null}
                  <Select
                    value={permission}
                    onValueChange={(v) => handleChange(row.master_group_id, v as RoleAccess)}
                  >
                    <SelectTrigger className="w-52 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERMISSION_ORDER.map((p) => (
                        <SelectItem key={p} value={p}>
                          {ROLE_ACCESS_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <div className="text-sm text-red-400">{error}</div> : null}
    </div>
  );
}
