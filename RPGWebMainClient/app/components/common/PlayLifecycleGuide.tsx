'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

const STEPS: { title: string; text: string; href?: string }[] = [
  {
    title: 'Сценарий',
    text: 'Ваша подготовка: сюжет, локации, NPC, предметы. Во время игры не меняется — можно спокойно дописывать.',
    href: '/scenarios',
  },
  {
    title: 'Запущенный мир',
    text: 'Живая копия сценария. Создаётся при первом запуске из лобби и помнит всё, что случилось в игре: сцены, время, NPC, предметы.',
    href: '/launched-scenarios',
  },
  {
    title: 'Подход',
    text: 'Один заход за стол: лобби → игра → завершение. Подходов у одного мира может быть сколько угодно, мир между ними сохраняется.',
  },
  {
    title: 'Кампания',
    text: 'Необязательная цепочка эпизодов над одним миром: переносит состояние между подходами и ведёт по шагам сюжета.',
    href: '/campaigns',
  },
];

/**
 * Короткая памятка «как всё связано». Свёрнута по умолчанию, чтобы не мешать тем,
 * кто уже разобрался, но всегда под рукой на страницах цепочки.
 */
export function PlayLifecycleGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-gray-700 bg-gray-950/60 text-sm text-gray-300"
    >
      <summary className="cursor-pointer select-none px-4 py-2.5 text-gray-200 marker:text-gray-500">
        Как это работает: сценарий → запущенный мир → подход → кампания
      </summary>

      <div className="space-y-3 border-t border-gray-800 px-4 py-3">
        <ol className="grid gap-2 md:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-md border border-gray-800 bg-gray-900 p-3">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/30 text-[11px]">
                  {i + 1}
                </span>
                {step.href ? (
                  <Link href={step.href} className="hover:underline">
                    {step.title}
                  </Link>
                ) : (
                  step.title
                )}
                {i < STEPS.length - 1 ? (
                  <ChevronRight className="ml-auto hidden h-4 w-4 text-gray-600 md:block" />
                ) : null}
              </div>
              <p className="text-xs leading-relaxed text-gray-400">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="space-y-1.5 text-xs leading-relaxed text-gray-400">
          <p>
            <span className="text-gray-200">Заполнить сюжет, запустить и развивать сессиями:</span> заполните
            сценарий → создайте лобби и выберите его (мир создастся сам) → после игры снова откройте лобби
            и выберите этот же запущенный мир. Одновременно в мире идёт только один подход.
          </p>
          <p>
            <span className="text-gray-200">Перенести персонажей в другой сюжет:</span> по окончании подхода
            персонаж каждого игрока сохраняется в его пуле персонажей (вместе с характеристиками, историей
            и предметами пула). В лобби другого сценария с теми же правилами игрок выбирает его из пула.
            Предметы и счётчики, созданные внутри конкретного сценария, остаются в нём.
          </p>
        </div>
      </div>
    </details>
  );
}
