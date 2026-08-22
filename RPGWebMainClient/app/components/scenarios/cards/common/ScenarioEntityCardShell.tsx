'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { truncateHtmlPreserveMarkup } from '@/lib/htmlTruncate';
import { TodoPopover } from './TodoPopover';
import { FrontRibbon } from './FrontRibbon';
import type { TodoElementType } from '@/app/services/types2';
import type { FrontBadgeInfo } from '@/app/services/types2';

function isOverflowing(el: HTMLElement | null) {
  if (!el) return false;
  return el.scrollWidth > el.clientWidth;
}

export type ScenarioEntityCardShellProps = {
  accentColor: string;
  typeLabel: string;
  title: string;
  subtitle?: string | null;
  subtitleHtml?: string | null;
  subtitleHtmlMaxLen?: number | null;
  iconNode: React.ReactNode;
  badges?: React.ReactNode;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<void> | void;
  readOnly?: boolean;
  todoProps?: {
    elementType: TodoElementType;
    elementId: string;
    elementName: string;
  };
  footer?: React.ReactNode;
  frontBadges?: FrontBadgeInfo[];
  onOpenFront?: (frontId: string) => void;
  // deleteConfirmText убран — диалог живёт в ScenarioEntityListShell
};

export function ScenarioEntityCardShell({
  accentColor,
  typeLabel,
  title,
  subtitle = null,
  subtitleHtml = null,
  subtitleHtmlMaxLen = 140,
  iconNode,
  badges = null,
  onView,
  onEdit,
  onDelete,
  readOnly = false,
  todoProps,
  footer,
  frontBadges,
  onOpenFront,
}: ScenarioEntityCardShellProps) {
  const titleRef = useRef<HTMLDivElement | null>(null);
  const [titleIsLong, setTitleIsLong] = useState(false);

  useEffect(() => {
    setTitleIsLong(isOverflowing(titleRef.current));
  }, [title]);

  const subtitleHtmlPrepared = useMemo(() => {
    if (!subtitleHtml) return null;
    const lim = subtitleHtmlMaxLen ?? undefined;
    if (!lim) return subtitleHtml;
    return truncateHtmlPreserveMarkup(subtitleHtml, { maxLen: lim }).html;
  }, [subtitleHtml, subtitleHtmlMaxLen]);

  const subtitleNode = subtitleHtmlPrepared ? (
    <div
      className="text-xs text-gray-400 mt-1 line-clamp-2 prose prose-invert prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: subtitleHtmlPrepared }}
    />
  ) : subtitle ? (
    <div className="text-xs text-gray-400 mt-1 line-clamp-2">{subtitle}</div>
  ) : null;

  return (
    <div
      className="relative rounded-xl border border-gray-700 bg-[#0b1020] overflow-hidden"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.03) inset' }}
    >
      <FrontRibbon fronts={frontBadges ?? []} onOpenFront={onOpenFront} />
      <div className="h-1" style={{ backgroundColor: accentColor }} />

      <div className={frontBadges?.length ? 'p-3 pl-7' : 'p-3'}>
        <div>
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <div className="shrink-0">{iconNode}</div>

                <div className="min-w-0 flex-1">
                  <div ref={titleRef} className="relative w-full overflow-hidden" title={title}>
                    {!titleIsLong ? (
                      <div className="text-base font-semibold text-white truncate">{title}</div>
                    ) : (
                      <div className="text-base font-semibold text-white whitespace-nowrap">
                        <div className="inline-block animate-entity-marquee hover:[animation-play-state:paused]">
                          {title}
                          <span className="inline-block w-10" />
                          {title}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>

            <div className="flex gap-1 shrink-0 items-center">
              {onView && (
                <Button variant="ghost" size="sm" onClick={onView}
                  className="hover:bg-white/5" title="Просмотр">
                  <Eye className="w-4 h-4" />
                </Button>
              )}

              {onEdit && !readOnly && (
                <Button variant="ghost" size="sm" onClick={onEdit}
                  className="hover:bg-white/5" title="Редактировать">
                  <Pencil className="w-4 h-4" />
                </Button>
              )}

              {todoProps && !readOnly && (
                <TodoPopover
                  elementType={todoProps.elementType}
                  elementId={todoProps.elementId}
                  elementName={todoProps.elementName}
                />
              )}

              {onDelete && !readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onDelete()}
                  className="hover:bg-white/5 hover:text-red-400"
                  title="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {subtitleNode}

          {badges ? <div className="mt-2">{badges}</div> : null}
          {footer}
        </div>

        <div className="mt-2 text-[11px] text-gray-500">{typeLabel}</div>
      </div>
    </div>
  );
}