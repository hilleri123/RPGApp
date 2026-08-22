'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Lock, UserPlus } from 'lucide-react';
import { useLobbyWebSocket } from '@/app/services/hooks/useLobbyWebSocket';
import type { PlayerCharacter } from '@/app/services/types2';
import { CharacterInfoDialog } from './CharacterInfoDialog';
import { findPlayerWithCharacter } from './lobbyCharacterOccupancy';

interface CharacterCardProps {
  lobbyId: string;
  character: PlayerCharacter & { application_id?: string | null };
  compact?: boolean;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ lobbyId, character, compact }) => {
  const [infoOpen, setInfoOpen] = useState(false);

  const { lobby, isPlayer, selfPlayer, playerSelectCharacter, playerSelectApplicationCharacter } =
    useLobbyWebSocket(lobbyId);

  const selectedBy = useMemo(() => {
    return findPlayerWithCharacter(lobby?.players, character);
  }, [lobby?.players, character]);

  const isSelectedBySomeone = !!selectedBy;
  const isSelectedByMe = !!selectedBy && selectedBy.id === selfPlayer?.id;
  const disableSelect = isSelectedBySomeone && !isSelectedByMe;

  const importedIds = ((lobby as any)?.imported_characters || []).map((ch: any) => String(ch.id));
  const isImported = importedIds.includes(String(character.id));
  const applicationId = character.application_id ? String(character.application_id) : null;

  const pickCharacter = () => {
    if (isImported && applicationId) {
      playerSelectApplicationCharacter(applicationId);
      return;
    }
    playerSelectCharacter(String(character.id));
  };

  const accentColor = useMemo(() => {
    // если у персонажа есть свой цвет — можно сюда подставить, иначе фикс
    return '#7c3aed'; // violet-600
  }, []);

  const selectButtonText = useMemo(() => {
    if (disableSelect) return 'Уже выбран';
    if (isSelectedByMe) return 'Выбран';
    return 'Выбрать';
  }, [disableSelect, isSelectedByMe]);

  return (
    <div>
      <div
        className="rounded-xl border border-gray-700 bg-[#0b1020] overflow-hidden transition
                   hover:border-white/15 hover:bg-[#0b1020]/95 cursor-pointer"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.03) inset' }}
        onClick={() => setInfoOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setInfoOpen(true);
        }}
      >
        {/* акцентная полоска сверху */}
        <div className="h-1" style={{ backgroundColor: accentColor }} />

        <div className={compact ? 'p-2.5' : 'p-3'}>
          <div className="flex items-start justify-between gap-2">
            {/* Левая часть: заголовок/описание */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                {/* Иконка/мини-аватар */}
                <div className="shrink-0">
                  <div
                    className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded-lg border border-white/10 bg-white/5 flex items-center justify-center`}
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.25) inset' }}
                  >
                    <span className="text-white/80 text-sm font-semibold">
                      {character.name?.slice(0, 1)?.toUpperCase() ?? 'C'}
                    </span>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-white truncate" title={character.name}>
                    {character.name}
                  </div>

                  {character.short_desc && !compact ? (
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {character.short_desc}
                    </div>
                  ) : null}

                  {/* Статус-бейджи */}
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
                    {isSelectedByMe ? (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-200 border border-emerald-500/20">
                        <Check className="w-3 h-3 mr-1" />
                        Вы выбрали
                      </Badge>
                    ) : isSelectedBySomeone ? (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-200 border border-amber-500/20">
                        <Lock className="w-3 h-3 mr-1" />
                        Занят: {selectedBy?.name ?? 'игрок'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-white/5 text-gray-200 border border-white/10">
                        Свободен
                      </Badge>
                    )}

                    {isImported && (
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-200">
                        Из заявки
                      </span>
                    )}

                    {/* пример доп. бейджа: есть story/нет */}
                    {character.story && !compact ? (
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                        Есть история
                      </span>
                    ) : !compact ? (
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-500">
                        Без истории
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Правая часть: единственная кнопка управления */}
            {isPlayer ? (
              <Button
                variant={isSelectedByMe ? 'secondary' : disableSelect ? 'secondary' : 'default'}
                size="sm"
                disabled={disableSelect}
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  pickCharacter();
                }}
                title={disableSelect ? 'Персонаж уже выбран другим игроком' : 'Выбрать персонажа'}
              >
                {!disableSelect && !isSelectedByMe ? <UserPlus className="w-4 h-4 mr-2" /> : null}
                {selectButtonText}
              </Button>
            ) : null}
          </div>

          {/* Нижняя подпись как в shell */}
          {!compact ? <div className="mt-2 text-[11px] text-gray-500">Персонаж</div> : null}
        </div>
      </div>

      {infoOpen && (
        <CharacterInfoDialog
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          lobbyId={lobbyId}
          character={character}
        />
      )}
    </div>
  );
};
