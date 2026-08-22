// plugins/gumshoe/npc_dialog/stages/DialogLoopStage.tsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, ShoppingCart, LogOut, Bot, ChevronDown, ChevronRight } from 'lucide-react';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

export function DialogLoopStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf    = action?.workflow ?? {};
  const ctx   = wf?.context ?? {};
  const entry = ctx?.entry ?? {};
  const spendRecords: any[] = entry?.spend_records ?? [];

  const scene      = action?.scene?.scene ?? {};
  const characters: any[] = scene?.characters ?? [];
  const npcs: any[]       = scene?.npcs ?? [];
  const isGm = asStr(action?.participants?.gmUserId) === asStr(user_id);

  const participantChars = useMemo(
    () => characters.filter((c: any) => (entry.character_ids ?? []).includes(String(c.id))),
    [characters, entry.character_ids],
  );
  const participantNpcs = useMemo(
    () => npcs.filter((n: any) => (entry.npc_ids ?? []).includes(String(n.id))),
    [npcs, entry.npc_ids],
  );

  const wfCtx      = action?.workflow?.context ?? {};
  const codex      = wfCtx?.skills ?? {};
  const allSkills: any[]  = codex?.skills ?? [];
  const allGroups: any[]  = codex?.skillGroups ?? [];

  const [selectedSkill,  setSelectedSkill]  = useState<string>('');
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [note,           setNote]           = useState<string>('');
  const [expandedNpc,    setExpandedNpc]    = useState<string | null>(null);
  const [skillSearch, setSkillSearch]       = useState<string>('');

  useEffect(() => { setSubmitEnabled(true); }, []);

  // Сбрасываем выбор персонажа при смене навыка
  useEffect(() => { setSelectedCharId(''); }, [selectedSkill]);

  // Траты по персонажу + навыку
  const spentMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const r of spendRecords) {
      if (!r.confirmed) continue;
      if (!m[r.character_id]) m[r.character_id] = {};
      m[r.character_id][r.skill_name] = (m[r.character_id][r.skill_name] ?? 0) + r.cost;
    }
    return m;
  }, [spendRecords]);

  const getAvail = (charId: string, skillId: string) => {
    const ch = characters.find((c: any) => String(c.id) === charId);
    const total = ch?.data?.skills?.[skillId] ?? 0;
    const spent = spentMap[charId]?.[skillId] ?? 0;
    return Math.max(0, total - spent);
  };

  const canRequest = isGm && selectedSkill && selectedCharId;

  const handleRequestSpend = () => {
    if (!canRequest) return;
    onSubmit({
      action: 'request_spend',
      skill_name: selectedSkill,
      character_id: selectedCharId,
      note: note.trim() || null,
    });
    setNote('');
    setSelectedSkill('');
    setSelectedCharId('');
  };

  const confirmedRecords = spendRecords.filter((r: any) => r.confirmed);


  const filteredGroups = useMemo(() => {
    const q = skillSearch.toLowerCase();
    return allGroups.map((g: any) => ({
      ...g,
      skills: allSkills.filter(
        (s: any) => s.group === g.id &&
          (s.title?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      ),
    })).filter((g: any) => g.skills.length > 0);
  }, [allGroups, allSkills, skillSearch]);

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <div className="font-medium flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-purple-400" />
        Разговор
      </div>

      {/* ── НПС с описаниями ── */}
      {participantNpcs.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" /> НПС
          </div>
          {participantNpcs.map((npc: any) => {
            const expanded = expandedNpc === String(npc.id);
            const hasAnyDesc = !!(npc.description_for_players || (isGm && npc.description_for_master));
            return (
              <div key={npc.id} className="rounded border border-amber-500/25 bg-amber-500/5">
                <button
                  type="button"
                  onClick={() => setExpandedNpc(expanded ? null : String(npc.id))}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-amber-200"
                >
                  <span className="font-semibold">{asStr(npc.name, 'НПС')}</span>
                  {hasAnyDesc
                    ? (expanded
                        ? <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 shrink-0" />)
                    : null}
                </button>

                {expanded && (
                  <div className="border-t border-amber-500/15 px-3 py-2 flex flex-col gap-2">
                    {npc.description_for_players && (
                      <div
                        className="text-sm text-white/75 leading-relaxed prose prose-invert prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: npc.description_for_players }}
                      />
                    )}
                    {isGm && npc.description_for_master && (
                      <div className="rounded border border-yellow-500/20 bg-yellow-500/5 px-2 py-1.5">
                        <div className="text-xs text-yellow-400/70 uppercase tracking-wide mb-1">
                          Только мастер
                        </div>
                        <div
                          className="text-sm text-yellow-100/80 leading-relaxed prose prose-invert prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: npc.description_for_master }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Участники-персонажи с балансами ── */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-white/50 uppercase tracking-wide">Персонажи</div>
        {participantChars.map((ch: any) => (
          <div key={ch.id} className="rounded border border-white/10 bg-zinc-950/30 px-3 py-2 text-sm">
            <div className="font-semibold text-white/90 mb-1">{asStr(ch.name, 'Персонаж')}</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ch?.data?.skills ?? {})
                .filter(([, v]: any) => v > 0)
                .map(([skillId]: any) => {
                  const avail = getAvail(String(ch.id), skillId);
                  const total = ch.data.skills[skillId];
                  const spent = spentMap[String(ch.id)]?.[skillId] ?? 0;
                  return (
                    <span
                      key={skillId}
                      className={`text-xs rounded px-2 py-0.5 border tabular-nums
                        ${spent > 0
                          ? 'border-red-500/30 bg-red-500/5 text-red-200'
                          : 'border-white/10 text-white/50'}`}
                    >
                      {skillId}: {avail}/{total}
                      {spent > 0 && <span className="ml-1 text-red-400">−{spent}</span>}
                    </span>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Запрос траты (только ГМ) ── */}
      {isGm && (
        <div className="rounded border border-purple-500/20 bg-purple-500/5 px-3 py-3 flex flex-col gap-3">
          <div className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-1">
            <ShoppingCart className="w-3.5 h-3.5" /> Запросить трату навыка
          </div>

          {/* Поиск навыка */}
          <input
            type="text"
            className="w-full rounded border border-white/15 bg-zinc-900 px-3 py-1.5 text-sm text-white placeholder:text-white/30"
            placeholder="Поиск навыка…"
            value={skillSearch}
            onChange={(e) => { setSkillSearch(e.target.value); setSelectedSkill(''); }}
          />

          {/* Группы с навыками */}
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {filteredGroups.map((g: any) => (
              <div key={g.id}>
                {/* Заголовок группы */}
                <div
                  className="text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5"
                  style={{ color: g.color ?? '#94a3b8' }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: g.color ?? '#64748b' }}
                  />
                  {g.title}
                </div>
                {/* Навыки группы */}
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {g.skills.map((s: any) => {
                    const isSelected = selectedSkill === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setSelectedSkill(s.id); setSkillSearch(''); }}
                        className={`rounded border px-2.5 py-1 text-xs transition-colors
                          ${isSelected
                            ? 'font-semibold'
                            : 'border-white/15 text-white/60 hover:border-white/30 hover:text-white/80'}`}
                        style={isSelected ? {
                          borderColor: g.color ?? '#a855f7',
                          backgroundColor: (g.color ?? '#a855f7') + '22',
                          color: g.color ?? '#a855f7',
                        } : undefined}
                      >
                        {s.title ?? s.id}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <div className="text-xs text-white/30">Навык не найден</div>
            )}
          </div>

          {/* Кто тратит — показываем только если выбран навык */}
          {selectedSkill && (
            <div className="flex flex-col gap-1">
              <div className="text-xs text-white/40">Кто тратит</div>
              {participantChars.map((ch: any) => {
                const avail = getAvail(String(ch.id), selectedSkill);
                const isSelected = selectedCharId === String(ch.id);
                const canAfford = avail > 0;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    disabled={!canAfford}
                    onClick={() => setSelectedCharId(String(ch.id))}
                    className={`flex justify-between items-center rounded border px-3 py-1.5 text-sm transition-colors
                      ${isSelected
                        ? 'border-purple-400 bg-purple-500/15 text-purple-200'
                        : canAfford
                          ? 'border-white/15 hover:border-white/30 text-white/80'
                          : 'border-white/5 text-white/25 cursor-not-allowed'}`}
                  >
                    <span>{asStr(ch.name, '—')}</span>
                    <span className={`text-xs tabular-nums font-semibold
                      ${avail > 0 ? 'text-green-300' : 'text-white/25'}`}>
                      {avail} pts
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Заметка */}
          <textarea
            className="w-full rounded border border-white/15 bg-zinc-900 px-3 py-2 text-sm resize-none"
            placeholder="Заметка: за что трата, что даёт…"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <button
            type="button"
            disabled={!canRequest}
            onClick={handleRequestSpend}
            className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors
              ${canRequest
                ? 'border-purple-400/60 text-purple-300 hover:bg-purple-500/10'
                : 'border-white/10 text-white/25 cursor-not-allowed'}`}
          >
            Запросить трату
          </button>
        </div>
      )}

      {/* ── История трат ── */}
      {confirmedRecords.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-white/50 uppercase tracking-wide">Потрачено в разговоре</div>
          {confirmedRecords.map((r: any, i: number) => {
            const ch = characters.find((c: any) => String(c.id) === r.character_id);
            return (
              <div key={i} className="rounded border border-green-500/25 bg-green-500/5 px-3 py-2 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="font-semibold text-green-200">{r.skill_name}</span>
                    {' '}
                    <span className="text-white/50 text-xs">({asStr(ch?.name, r.character_id)})</span>
                  </div>
                  <span className="text-red-300 text-xs tabular-nums shrink-0">−{r.cost} pts</span>
                </div>
                {r.note && <div className="text-white/60 text-xs mt-0.5 italic">«{r.note}»</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Завершить (только ГМ) ── */}
      {isGm && (
        <button
          type="button"
          onClick={() => onSubmit({ action: 'finish' })}
          className="flex items-center justify-center gap-2 rounded border border-white/20 px-3 py-2 text-sm text-white/70 hover:border-white/40 hover:text-white/90 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Завершить разговор
        </button>
      )}
    </div>
  );
}