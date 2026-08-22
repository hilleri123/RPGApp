// plugins/gumshoe/ui/CharacterDataView.tsx
'use client';

import { memo } from 'react';
import type { CharacterConfig, CharacterData } from '../types';
import { CharacterDataView as BaseCharacterDataView } from '../../../../base/ui';

type Props = {
    data: CharacterData;
    config?: CharacterConfig;
};

function GumshoeCharacterDataView({ data, config }: Props) {
    return (
        <div className="space-y-4">
            {/* ДО: специфичное для gumshoe — роль и бонусы */}
            <div className="space-y-2">
                <div className="text-sm text-gray-300">Роль персонажа</div>
                <div className="inline-flex items-center gap-2 rounded border border-gray-700 bg-black/30 px-2 py-1">
                    <span className="text-sm text-gray-100">
                        {data?.role?.trim() || '—'}
                    </span>
                </div>
            </div>

            <div className="space-y-1">
                <div className="text-sm text-gray-300">Бонусы по задачам</div>
                {(data?.bonuses?.length ?? 0) === 0 ? (
                    <div className="text-xs text-gray-500">
                        Бонусов пока нет.
                    </div>
                ) : (
                    <div className="space-y-1">
                        {data.bonuses.map((b, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between gap-2 rounded border border-gray-700 bg-black/30 px-2 py-1"
                            >
                                <div className="text-xs text-gray-100">
                                    {b.description || '(без описания)'}
                                </div>
                                <div className="text-xs font-semibold text-emerald-300">
                                    +{b.bonus}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* САМИ СКИЛЛЫ — базовый вьювер */}
            <BaseCharacterDataView data={data} config={config} />
        </div>
    );
}

export default memo(GumshoeCharacterDataView);