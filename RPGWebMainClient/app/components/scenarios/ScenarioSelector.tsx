'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { scenariosApiService } from '@/app/services/api/scenario';
import { Scenario } from '@/app/services/types2'
import { useAuth } from '@/app/services/hooks/useAuth';
import ScenarioModal from '@/app/components/scenarios/ScenarioModal';

interface ScenarioSelectorProps {
  onScenarioSelect: (scenario: Scenario) => void;
  currentScenario?: Scenario | null;
}

export default function ScenarioSelector({ onScenarioSelect, currentScenario }: ScenarioSelectorProps) {
  
  const { state, logout } = useAuth();
  const { user, isAuthenticated, loading } = state;

  const [visible, setVisible] = useState(true);
  
  const [scenario, setScenario] = useState<Scenario[]>([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // const [newScenarioName, setNewScenarioName] = useState('');
  // const [newScenarioIntro, setNewScenarioIntro] = useState('');
  // const [maxPlayers, setMaxPlayers] = useState(4);
  // const [creating, setCreating] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);

  useEffect(() => {
    loadScenario();
  }, []);

  const loadScenario = async () => {
    try {
      setApiLoading(true);
      setError(null);
      const scenarioData = await scenariosApiService.getScenarios();
      setScenario(scenarioData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки сценария');
    } finally {
      setApiLoading(false);
    }
  };

  const scenarioSelect = (scenario: Scenario) => {
    onScenarioSelect(scenario);
    setVisible(false);
  };


  const handleDeleteScenario = async (ruleId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот сценарий?')) return;

    try {
      await scenariosApiService.deleteScenario(ruleId);
      setScenario(scenario.filter(rule => rule.id !== ruleId));
      if (currentScenario?.id === ruleId) {
        // Если удаляем текущее правило, выбираем первое доступное
        const remainingScenario = scenario.filter(rule => rule.id !== ruleId);
        if (remainingScenario.length > 0) {
          scenarioSelect(remainingScenario[0]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления сценария');
    }
  };

  if (apiLoading || loading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-white">Загрузка сценариев...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            Выбор сценариев игры
            <Button
              onClick={() => setIsEditModalOpen(true)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать
            </Button>
            <Button
              className="p-2 rounded hover:bg-gray-700 transition flex items-center"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Скрыть" : "Показать"}
              type="button"
            >
              {visible ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        {visible &&
          <CardContent className="space-y-4">
            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-900/50 rounded-md p-3">
                {error}
              </div>
            )}

            {scenario.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">Сценарии не найдены</p>
                <Button
                  onClick={() => setIsEditModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Создать первый сценарий
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-white">Выберите сценарий для редактирования:</Label>
                  <Select 
                    value={currentScenario?.id.toString() || ''} 
                    onValueChange={(value) => {
                      const rule = scenario.find(r => r.id.toString() === value);
                      if (rule) scenarioSelect(rule);
                    }}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Выберите сценарий" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {scenario.map((rule) => (
                        <SelectItem key={rule.id} value={rule.id.toString()}>
                          {rule.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Список правил */}
                <div className="space-y-2">
                  <Label className="text-white">Доступные сценарии:</Label>
                  {scenario.map((rule) => (
                    <div 
                      key={rule.id} 
                      className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
                        currentScenario?.id === rule.id 
                          ? 'bg-blue-900/30 border-blue-600' 
                          : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex-1">
                        <span className="text-white font-medium">{rule.name}</span>
                        <div className="text-xs text-gray-400 mt-1">
                          {/* {rule.data.skillGroups.length} групп навыков, {' '} */}
                          {/* {rule.data.propertyTemplates.length} свойств */}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => scenarioSelect(rule)}
                          size="sm"
                          variant="outline"
                          className="border-gray-600 text-gray-300"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Редактировать
                        </Button>
                        <Button
                          onClick={() => handleDeleteScenario(rule.id)}
                          size="sm"
                          variant="outline"
                          className="border-red-600 text-red-400 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        }
      </Card>

      {/* Модальное окно создания правила */}
      <ScenarioModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={loadScenario}
        scenario={editingScenario}
      />
    </>
  );
}

export type { ScenarioSelectorProps };
