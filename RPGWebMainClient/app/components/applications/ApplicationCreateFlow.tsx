// app/components/applications/ApplicationCreateFlow.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, BookOpen } from 'lucide-react';
import { scenariosApiService } from '@/app/services/api/scenario';
import { ApplicationEditDialog } from './ApplicationEditDialog';
import type { RuleSystemInfo } from '@/app/services/types2';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

type Step = 'pick-rule' | 'edit';

export function ApplicationCreateFlow({ open, onClose, onSaved }: Props) {
  const [step, setStep]           = useState<Step>('pick-rule');
  const [rules, setRules]         = useState<RuleSystemInfo[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [selectedRule, setSelectedRule] = useState<string>('');

  // сбрасываем при каждом открытии
  useEffect(() => {
    if (!open) return;
    setStep('pick-rule');
    setSelectedRule('');
    setRulesLoading(true);
    scenariosApiService
      .getRuleSystems()
      .then(setRules)
      .finally(() => setRulesLoading(false));
  }, [open]);

  function handleNext() {
    if (!selectedRule) return;
    setStep('edit');
  }

  // если пользователь закрыл редактор — возвращаемся к выбору правил
  function handleEditClose() {
    setStep('pick-rule');
    onClose();
  }

  // шаг 2 — полный диалог редактирования персонажа
  if (step === 'edit') {
    return (
      <ApplicationEditDialog
        open={open}
        ruleIdStr={selectedRule}
        onClose={handleEditClose}
        onSaved={onSaved}
      />
    );
  }

  // шаг 1 — выбор системы правил
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <BookOpen className="w-5 h-5 text-blue-400" />
            Выберите систему правил
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-gray-400 text-sm">
            Персонаж будет создан по выбранной системе правил.
            После создания систему сменить нельзя.
          </p>

          <div className="space-y-1.5">
            <Label className="text-gray-300">Система правил</Label>
            {rulesLoading ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Загружаем...
              </div>
            ) : (
              <Select value={selectedRule} onValueChange={setSelectedRule}>
                <SelectTrigger className="text-white bg-gray-800 border-gray-600">
                  <SelectValue placeholder="Выберите систему..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {rules.map((r) => (
                    console.log('rule item:', r.plugin_id, r.name, r),  // ← посмотри в консоли
                    <SelectItem
                      key={r.plugin_id}
                      value={String(r.id)}
                      className="hover:bg-gray-700"
                    >
                      <div>
                        <div className="font-medium">{r.name}</div>
                        {r.description && (
                          <div className="text-gray-400 text-xs">{r.description}</div>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="border-gray-600 text-gray-300" onClick={onClose}>
            Отмена
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-500"
            disabled={!selectedRule || rulesLoading}
            onClick={handleNext}
          >
            Далее →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}