// app/components/scenarios/dialogs/common/EntityEditDialogShell.tsx
'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, Minus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { DialogModeProvider } from './DialogModeContext';
import { ValidateResult } from '@/app/services/hooks/scenario/useScenarioObjectDialog';
import { useMinimizedDialogsStore } from '@/app/services/stores/minimizedDialogs';

export type DialogTab = {
  key: string;
  title: React.ReactNode;
  content: React.ReactNode;
};

type RulesSection = {
  tabTitle?: React.ReactNode;
  content: React.ReactNode;
  onValidate: () => void | Promise<ValidateResult>;
  onForceSave: () => void | Promise<any>;
  forceSaveDisabled?: boolean;
  loading?: boolean;
};

export type EntityEditDealogProps = {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  templateSetId?: string;
  ruleIdStr?: string;
  onSave?: () => void;
  /** Вызывается после успешного сохранения с id созданной/обновлённой сущности */
  onEntitySaved?: (id: string) => void | Promise<void>;
  readOnly?: boolean;
};

export type EntityEditDialogFooterCtx = {
  loading: boolean;
  readOnly: boolean;
  disableSave: boolean;
  tab: string;
  setTab: (k: string) => void;

  onClose: () => void;
  onSave?: () => void | Promise<void>;

  rules?: {
    onValidate: () => void | Promise<ValidateResult>;
    onForceSave: () => void | Promise<any>;
    loading?: boolean;
    forceSaveDisabled?: boolean;
  };
};

export function EntityEditDialogShell(props: {
  open: boolean;
  onClose: () => void;
  title: string;

  loading?: boolean;
  disableSave?: boolean;
  onSave?: () => void | Promise<void>;

  tabs: DialogTab[];
  defaultTabKey?: string;

  rules?: RulesSection;

  readOnly?: boolean;
  onReadOnlyChange?: (readOnly: boolean) => void;

  allowMinimize?: boolean;

  footer?: {
    render: (ctx: EntityEditDialogFooterCtx) => React.ReactNode;
    align?: 'left' | 'right';
    showInReadOnly?: boolean;
  };
}) {
  const {
    open,
    onClose,
    title,
    loading = false,
    disableSave = false,
    onSave,
    tabs,
    defaultTabKey,
    rules,
    readOnly = false,
    onReadOnlyChange,
    allowMinimize = true,
    footer,
  } = props;

  const dialogId = useId();
  const pushMinimized = useMinimizedDialogsStore((s) => s.push);
  const removeMinimized = useMinimizedDialogsStore((s) => s.remove);

  const [minimized, setMinimized] = useState(false);

  const allTabs = useMemo<DialogTab[]>(() => {
    const base = [...tabs];
    if (rules) {
      base.splice(1, 0, { key: 'rules', title: rules.tabTitle ?? 'Правила', content: rules.content });
    }
    return base;
  }, [tabs, rules]);

  const firstKey = allTabs[0]?.key ?? 'main';
  const [tab, setTab] = useState<string>(defaultTabKey ?? firstKey);

  const handleClose = useCallback(() => {
    setMinimized(false);
    removeMinimized(dialogId);
    onClose();
  }, [dialogId, onClose, removeMinimized]);

  const handleRestore = useCallback(() => {
    setMinimized(false);
    removeMinimized(dialogId);
  }, [dialogId, removeMinimized]);

  const handleMinimize = useCallback(() => {
    setMinimized(true);
    pushMinimized({
      id: dialogId,
      title,
      onRestore: handleRestore,
      onClose: handleClose,
    });
  }, [dialogId, title, pushMinimized, handleRestore, handleClose]);

  useEffect(() => {
    if (!open) {
      setMinimized(false);
      removeMinimized(dialogId);
    }
  }, [open, dialogId, removeMinimized]);

  const footerCtx: EntityEditDialogFooterCtx = useMemo(
    () => ({
      loading,
      readOnly,
      disableSave,
      tab,
      setTab,
      onClose: handleClose,
      onSave,
      rules: rules
        ? {
            onValidate: rules.onValidate,
            onForceSave: rules.onForceSave,
            loading: rules.loading,
            forceSaveDisabled: rules.forceSaveDisabled,
          }
        : undefined,
    }),
    [loading, readOnly, disableSave, tab, handleClose, onSave, rules],
  );

  const customFooterNode = footer?.render ? footer.render(footerCtx) : null;
  const customLeft = footer?.align !== 'right' ? customFooterNode : null;
  const customRight = footer?.align === 'right' ? customFooterNode : null;

  const body = (
    <DialogModeProvider readOnly={readOnly}>
      <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden">
        <TabsList className="mb-2">
          {allTabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key as any}>
              {t.title}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="overflow-y-auto pr-1 max-h-[70vh]">
          {allTabs.map((t) => (
            <TabsContent key={t.key} value={t.key as any} className="space-y-3">
              {t.content}
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {!readOnly ? (
        <DialogFooter className="gap-2">
          {customLeft}

          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Отмена
          </Button>

          {rules && (
            <Button
              variant="secondary"
              onClick={() => void rules.onValidate()}
              disabled={loading || !!rules.loading}
            >
              {loading || rules.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Проверить'}
            </Button>
          )}

          {onSave && (
            <Button onClick={() => void onSave()} disabled={loading || disableSave || readOnly}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
            </Button>
          )}

          {rules && (
            <Button
              variant="destructive"
              onClick={() => void rules.onForceSave()}
              disabled={loading || !!rules.loading || !!rules.forceSaveDisabled || readOnly}
            >
              Сохранить принудительно
            </Button>
          )}

          {customRight}
        </DialogFooter>
      ) : (
        footer?.showInReadOnly && (
          <DialogFooter className="gap-2">
            {customLeft}
            {customRight}
          </DialogFooter>
        )
      )}
    </DialogModeProvider>
  );

  if (!open) return null;

  if (minimized) {
    return (
      <div className="fixed -left-[9999px] top-0 w-[800px] opacity-0 pointer-events-none" aria-hidden>
        {body}
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-4xl w-full bg-gray-900 max-h-[100vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between gap-3">
          <DialogTitle>{title}</DialogTitle>

          <div className="flex items-center gap-2 shrink-0">
            {onReadOnlyChange ? (
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400">Редактирование</div>
                <Switch checked={!readOnly} onCheckedChange={(v) => onReadOnlyChange(!v)} />
              </div>
            ) : readOnly ? (
              <div className="text-xs text-gray-400">Только просмотр</div>
            ) : null}

            {allowMinimize ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-gray-400 hover:text-white"
                onClick={handleMinimize}
                title="Свернуть"
              >
                <Minus className="w-4 h-4" />
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        {body}
      </DialogContent>
    </Dialog>
  );
}
