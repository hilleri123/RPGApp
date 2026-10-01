'use client';

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Trash2, Plus, FileText, Copy, Eye, Archive, Upload } from "lucide-react";
import { PlayLifecycleGuide } from '@/app/components/common/PlayLifecycleGuide';
import Header from "../components/layout/Header";
import { scenariosApiService } from "../services/api/scenario";
import { Scenario } from "../services/types2";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import ScenarioModal from "../components/scenarios/ScenarioModal";
import { RuleSystemSelect, useRuleSystemLabels } from "@/app/components/rules/RuleSystemSelect";
import {
  canCopyScenario,
  canDeleteScenario,
  canEditScenarioMeta,
} from "@/app/lib/scenarioPermissions";

export default function ScenariosListPage() {
  const router = useRouter();
  const [scenariosList, setScenariosList] = useState<Scenario[]>([]);
  const [search, setSearch] = useState("");
  const [ruleFilter, setRuleFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const ruleLabel = useRuleSystemLabels();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [exportingArchiveId, setExportingArchiveId] = useState<string | null>(null);
  const [importingArchive, setImportingArchive] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  const loadScenariosList = async () => {
    setLoading(true);
    try {
      const scenarios = await scenariosApiService.getScenarios(
        ruleFilter ? { rule_id_str: ruleFilter, limit: 500 } : { limit: 500 },
      );
      setScenariosList(scenarios);
    } catch (e) {
      console.error("Ошибка загрузки сценариев", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenariosList();
  }, [ruleFilter]);

  const handleAddScenario = () => {
    setSelectedScenario(null);
    setEditOpen(true);
  };

  const handleEditScenario = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setEditOpen(true);
  };

  const handleDeleteScenario = async (id: string) => {
    if (!confirm("Уверены, что хотите удалить сценарий?")) return;
    try {
      await scenariosApiService.deleteScenario(id);
      await loadScenariosList();
    } catch (e) {
      console.error("Ошибка удаления сценария", e);
    }
  };

  const handleDuplicateScenario = async (scenario: Scenario) => {
    setDuplicatingId(scenario.id);
    try {
      const copy = await scenariosApiService.duplicateScenario(scenario.id);
      await loadScenariosList();
      router.push(`/scenarios/${copy.id}`);
    } catch (e) {
      console.error("Ошибка копирования сценария", e);
      alert("Не удалось скопировать сценарий");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDownloadPdf = async (id: string) => {
    try {
      await scenariosApiService.downloadScenarioPdf(id, true);
    } catch (e) {
      console.error("Ошибка скачивания PDF", e);
      alert("Не удалось скачать PDF сценария");
    }
  };

  const handleDownloadArchive = async (id: string) => {
    setExportingArchiveId(id);
    try {
      await scenariosApiService.downloadScenarioArchive(id);
    } catch (e) {
      console.error("Ошибка скачивания архива", e);
      alert("Не удалось скачать архив сценария");
    } finally {
      setExportingArchiveId(null);
    }
  };

  const handleImportArchive = async (file: File | null) => {
    if (!file) return;
    setImportingArchive(true);
    try {
      const report = await scenariosApiService.importScenarioArchive(file);
      if (!report.imported) {
        if (report.reason === "scenario_exists") {
          alert(`Сценарий уже существует (id=${report.id}), импорт пропущен`);
        } else {
          alert(`Импорт пропущен: ${report.reason ?? "неизвестная причина"}`);
        }
        return;
      }
      const warn =
        report.warnings?.length > 0 ? `\nПредупреждения: ${report.warnings.join("; ")}` : "";
      alert(`Сценарий импортирован (id=${report.id})${warn}`);
      await loadScenariosList();
    } catch (e) {
      console.error("Ошибка импорта архива", e);
      alert("Не удалось импортировать архив сценария");
    } finally {
      setImportingArchive(false);
    }
  };

  const onSaveScenario = async () => {
    await loadScenariosList();
    setEditOpen(false);
  };

  const filtered = useMemo(
    () =>
      scenariosList.filter((scenario) =>
        scenario.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [scenariosList, search],
  );

  const selectedCanEditMeta = selectedScenario
    ? canEditScenarioMeta(selectedScenario.permission)
    : false;

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header section="Сценарии" />
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-4">
          <PlayLifecycleGuide />
        </div>
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> На главную
            </Button>
          </Link>

          <h1 className="text-2xl font-bold text-white">Список сценариев</h1>

          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={handleAddScenario}
          >
            <Plus className="w-4 h-4 mr-2" /> Добавить сценарий
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
            disabled={importingArchive}
            onClick={() => document.getElementById("scenario-archive-import")?.click()}
          >
            {importingArchive ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Импорт архива
          </Button>
          <input
            id="scenario-archive-import"
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              void handleImportArchive(file);
            }}
          />

          {selectedScenario && selectedCanEditMeta && (
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              onClick={() => handleEditScenario(selectedScenario)}
            >
              <Pencil className="w-4 h-4 mr-2" /> Редактировать выбранный
            </Button>
          )}
        </div>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            type="text"
            placeholder="Поиск сценариев по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <RuleSystemSelect
            label=""
            value={ruleFilter}
            onChange={setRuleFilter}
            placeholder="Все системы правил"
            allowEmpty
          />
        </div>

        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
          {loading ? (
            <div className="text-gray-400 py-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
              Загрузка...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-gray-400 py-8 text-center">
              Нет подходящих сценариев
            </div>
          ) : (
            <ul className="divide-y divide-gray-700">
              {filtered.map((scenario) => {
                const isSelected = selectedScenario?.id === scenario.id;
                const canCopy = canCopyScenario(scenario.permission);
                const canDelete = canDeleteScenario(scenario.permission);
                const canEditMeta = canEditScenarioMeta(scenario.permission);

                return (
                  <li
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario)}
                    className={`flex cursor-pointer items-center justify-between py-3 gap-2 group transition rounded px-2 ${
                      isSelected
                        ? "bg-blue-700 text-white"
                        : "hover:bg-gray-700 text-gray-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-lg block truncate">{scenario.name}</span>
                      <span className="text-xs opacity-70 block truncate">
                        {scenario.rule_id_str ? ruleLabel(scenario.rule_id_str) : '—'}
                        {scenario.permission ? ` · ${scenario.permission}` : ''}
                      </span>
                    </div>
                    <div className="flex gap-2 opacity-80 group-hover:opacity-100 shrink-0">
                      <Link href={`/scenarios/${scenario.id}`}>
                        <Button
                          variant="outline"
                          size="icon"
                          title={canEditMeta ? "Открыть сценарий" : "Просмотр сценария"}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canEditMeta ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </Link>

                      <Button
                        variant="outline"
                        size="icon"
                        title="Скачать PDF"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPdf(scenario.id);
                        }}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        title="Скачать архив"
                        disabled={exportingArchiveId === scenario.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDownloadArchive(scenario.id);
                        }}
                      >
                        {exportingArchiveId === scenario.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Archive className="w-4 h-4" />
                        )}
                      </Button>

                      {canCopy ? (
                        <Button
                          variant="outline"
                          size="icon"
                          title="Копировать сценарий"
                          disabled={duplicatingId === scenario.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDuplicateScenario(scenario);
                          }}
                        >
                          {duplicatingId === scenario.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      ) : null}

                      {canDelete ? (
                        <Button
                          variant="destructive"
                          size="icon"
                          title="Удалить"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScenario(scenario.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <ScenarioModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSave={onSaveScenario}
          scenario={selectedScenario}
        />
      </div>
    </div>
  );
}
