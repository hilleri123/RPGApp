'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Dices,
  History,
  Loader2,
  Pencil,
  ScrollText,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionHistoryList } from '@/app/components/profile/SessionHistoryList';
import type { ProfileSessionStats } from '@/app/components/profile/sessionHistoryUtils';
import { userDisplayName } from '@/app/components/access_groups/UserRoleBadges';
import type { User } from '@/app/services/types/auth';
import type { CampaignSessionHistoryItem } from '@/app/services/types/sessionDispatch';
import type { GameSessionPreview } from '@/app/services/types/session';
import type { RollListResponse, RollRecord } from '@/app/services/api/users';

type Props = {
  user: User;
  sessionStats: ProfileSessionStats;
  sessionHistory: CampaignSessionHistoryItem[];
  profileLoading: boolean;
  charactersCount: number | null;
  launchedCount: number | null;
  sessions: GameSessionPreview[];
  sessionsLoading: boolean;
  rolls: RollListResponse | null;
  rollsLoading: boolean;
};

export function ProfileDashboard({
  user,
  sessionStats,
  sessionHistory,
  profileLoading,
  charactersCount,
  launchedCount,
  sessions,
  sessionsLoading,
  rolls,
  rollsLoading,
}: Props) {
  const router = useRouter();
  const rollStats = rolls?.stats;
  const recentRolls = (rolls?.items ?? []).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Identity */}
      <section className="rounded-xl border border-gray-700 bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white/10">
            {user.img_url ? (
              <img src={user.img_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-semibold text-white truncate">{userDisplayName(user)}</h2>
            <p className="text-gray-400 text-sm mt-0.5 truncate">{user.email || '—'}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {user.can_be_master && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Мастер
                </span>
              )}
              {user.is_admin && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  Админ
                </span>
              )}
            </div>
          </div>
          <Link href="/me" className="sm:self-start">
            <Button variant="outline" size="sm" className="border-gray-600 text-gray-200 hover:bg-gray-700 gap-2">
              <Pencil className="w-3.5 h-3.5" />
              Настройки
            </Button>
          </Link>
        </div>
      </section>

      {/* Statistics */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-sky-400" />
          <h3 className="text-lg font-semibold text-white">Статистика</h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric
            label="Сессий"
            value={profileLoading ? '…' : String(sessionStats.total)}
            hint={`${sessionStats.completed} завершено · ${sessionStats.active} активных`}
            accent="text-sky-400"
          />
          <Metric
            label="Часов в игре"
            value={profileLoading ? '…' : String(sessionStats.hoursPlayed)}
            hint={`${sessionStats.asMaster} мастер · ${sessionStats.asPlayer} игрок`}
            accent="text-emerald-400"
          />
          <Metric
            label="Бросков"
            value={rollsLoading ? '…' : String(rollStats?.total_rolls ?? 0)}
            hint={
              rollStats?.avg_total != null
                ? `средний итог ${rollStats.avg_total.toFixed(1)}`
                : 'пока нет данных'
            }
            accent="text-amber-400"
          />
          <Metric
            label="Персонажей"
            value={charactersCount == null ? '—' : String(charactersCount)}
            hint={launchedCount == null ? 'запущенные —' : `запущенных миров: ${launchedCount}`}
            accent="text-violet-300"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-gray-800/80 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <History className="w-4 h-4 text-sky-400" />
                По сессиям
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Как мастер" value={sessionStats.asMaster} />
                <MiniStat label="Как игрок" value={sessionStats.asPlayer} />
                <MiniStat label="Завершено" value={sessionStats.completed} />
                <MiniStat label="Активных" value={sessionStats.active} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/80 border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Dices className="w-4 h-4 text-amber-400" />
                  Броски
                </CardTitle>
                <Link href="/me/rolls">
                  <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 h-8 px-2">
                    Все броски
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Всего" value={rollStats?.total_rolls ?? 0} />
                <MiniStat label="Со seed" value={rollStats?.with_seed_image ?? 0} />
              </div>
              {rollStats && Object.keys(rollStats.by_kind || {}).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(rollStats.by_kind).map(([kind, count]) => (
                    <span
                      key={kind}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-gray-700/80 text-gray-300 border border-gray-600"
                    >
                      {kindLabel(kind)} · {count}
                    </span>
                  ))}
                </div>
              )}
              {rollsLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Загрузка бросков…
                </div>
              ) : recentRolls.length === 0 ? (
                <p className="text-sm text-gray-500">Сделайте бросок в сессии — он появится здесь.</p>
              ) : (
                <ul className="space-y-1.5">
                  {recentRolls.map((roll) => (
                    <RecentRollRow key={roll.id} roll={roll} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* History + side actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-gray-800/80 border-gray-700 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" />
              История игр
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SessionHistoryList
              items={sessionHistory}
              loading={profileLoading}
              emptyText="Вы ещё не участвовали в игровых сессиях"
              maxHeightClass="max-h-[28rem]"
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-gray-800/80 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Активные сессии</CardTitle>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Загрузка…
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-gray-500 text-sm">Нет активных сессий</p>
              ) : (
                <ul className="space-y-2">
                  {sessions.slice(0, 5).map((session) => (
                    <li key={session.id}>
                      <Link
                        href={`/session/${session.id}`}
                        className="block px-3 py-2 rounded-lg bg-gray-700/70 text-sm text-white hover:bg-gray-700 transition-colors"
                      >
                        {session.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-800/80 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-sky-400" />
                Персонажи
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 text-sm mb-3">
                Заявки и листы персонажей — согласование с мастером.
              </p>
              <Button
                className="w-full bg-sky-600 hover:bg-sky-500 gap-2"
                onClick={() => router.push('/applications')}
              >
                <ScrollText className="w-4 h-4" />
                К персонажам
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/70 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${accent}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1 truncate" title={hint}>
        {hint}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-900/50 border border-gray-700/80 px-3 py-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-white tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function RecentRollRow({ roll }: { roll: RollRecord }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-gray-900/40 border border-gray-700/60 px-2.5 py-1.5">
      <div className="min-w-0">
        <div className="text-sm text-white truncate">{roll.title || 'Бросок'}</div>
        <div className="text-[11px] text-gray-500 truncate">
          {roll.expression || roll.roll_kind}
          {roll.outcome ? ` · ${roll.outcome}` : ''}
        </div>
      </div>
      <div className="font-mono text-xs text-amber-200 shrink-0">
        [{(roll.dice || []).join(', ')}]
        {roll.total != null ? `=${roll.total}` : ''}
      </div>
    </li>
  );
}

function kindLabel(kind: string): string {
  if (kind === 'dice.roll') return 'ход';
  if (kind === 'damage') return 'урон';
  return kind;
}
