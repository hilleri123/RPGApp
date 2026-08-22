'use client';

import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Location } from "@/app/services/types2";
import { EyeOff, Eye, ChevronRight, ChevronDown, ClipboardList, X, Check, Search } from "lucide-react";
import React, { useState, useRef, useEffect, useMemo } from "react";

export function buildLocationTree(locations: Location[]) {
  const map = new Map<string, Location & { children: (Location & { children: any[] })[] }>();
  const roots: (Location & { children: any[] })[] = [];

  locations.forEach((loc) => map.set(loc.id, { ...loc, children: [] }));

  map.forEach((loc) => {
    if (loc.parent_location_id && map.has(loc.parent_location_id)) {
      map.get(loc.parent_location_id)!.children.push(loc);
    } else {
      roots.push(loc);
    }
  });

  const byName = (a: { name: string }, b: { name: string }) =>
    (a.name ?? "").localeCompare(b.name ?? "", "ru", { sensitivity: "base" });

  roots.sort(byName);
  map.forEach((loc) => loc.children.sort(byName));

  return roots;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-yellow-200 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function nodeMatchesSearch(
  node: Location & { children?: any[] },
  query: string
): boolean {
  if (!query.trim()) return true;
  if (node.name.toLowerCase().includes(query.toLowerCase())) return true;
  return (node.children ?? []).some((child) => nodeMatchesSearch(child, query));
}

// ─── Inline TODO popup ───────────────────────────────────────────────────────

interface TodoPopupProps {
  onSubmit: (text: string) => void;
  onClose: () => void;
}

function TodoPopup({ onSubmit, onClose }: TodoPopupProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  return (
    <div
      className="absolute z-50 right-0 top-full mt-1 w-64 bg-gray-900 border border-gray-600 rounded-lg shadow-xl p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 mb-2">
        <ClipboardList size={13} className="text-gray-400 shrink-0" />
        <span className="text-xs text-gray-400 font-medium">Добавить заметку</span>
        <button
          className="ml-auto text-gray-500 hover:text-gray-200 transition-colors"
          onClick={onClose}
        >
          <X size={13} />
        </button>
      </div>
      <input
        ref={inputRef}
        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        placeholder="Текст заметки..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") onClose();
        }}
      />
      <div className="flex justify-end mt-2">
        <button
          disabled={!text.trim()}
          onClick={handleSubmit}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Check size={12} />
          Добавить
        </button>
      </div>
    </div>
  );
}

// ─── Node ────────────────────────────────────────────────────────────────────

interface LocationTreeNodeProps {
  node: Location & { children?: (Location & { children?: any[] })[] };
  onSelect: (location_id: string) => void;
  onToggleHidden?: (locationId: string, hidden: boolean) => void;
  onAddTODO?: (locationId: string, text: string) => void;
  currentLocation?: Location | null;
  isMaster?: boolean;
  showDescription?: boolean;
  showHidden?: boolean;
  searchQuery?: string;
  depth?: number;
}

function LocationTreeNode({
  node,
  onSelect,
  onToggleHidden,
  onAddTODO,
  currentLocation,
  isMaster,
  showDescription,
  showHidden,
  searchQuery,
  depth = 0,
}: LocationTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const todoRef = useRef<HTMLDivElement>(null);

  const isHidden = node.tags?.includes("hidden");
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = currentLocation?.id === node.id;

  // закрываем попап при клике вне
  useEffect(() => {
    if (!todoOpen) return;
    const handler = (e: MouseEvent) => {
      if (todoRef.current && !todoRef.current.contains(e.target as Node)) {
        setTodoOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [todoOpen]);

  const visibleChildren = useMemo(
    () =>
      (node.children ?? []).filter((child) => {
        const hiddenOk = showHidden || isMaster || !child.tags?.includes("hidden");
        const matchOk = !searchQuery?.trim() || nodeMatchesSearch(child, searchQuery);
        return hiddenOk && matchOk;
      }),
    [node.children, showHidden, isMaster, searchQuery]
  );

  if (isHidden && !showHidden && !isMaster) return null;

  return (
    <li className="list-none">
      <Card
        className={`mb-1 transition-all duration-200 ${
          isSelected
            ? "bg-blue-600 border-blue-500 text-white"
            : isHidden
            ? "bg-gray-800/50 border-gray-700/50 text-gray-500 hover:bg-gray-700/50"
            : "bg-gray-800 border-gray-700 hover:bg-gray-750 text-white"
        }`}
      >
        <CardContent className="p-2">
          <div className="flex items-center gap-2">
            {/* Expand toggle */}
            <button
              className="shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) setExpanded((v) => !v);
              }}
            >
              {hasChildren ? (
                expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : (
                <span className="w-3" />
              )}
            </button>

            {/* Image */}
            <img
              src={node.map_url || "/placeholder.svg"}
              alt={node.name}
              className={`w-10 h-10 object-cover rounded shrink-0 ${isHidden ? "opacity-40" : ""}`}
            />

            {/* Name & description */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(node.id);
              }}
            >
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`font-semibold text-sm ${isHidden ? "line-through text-gray-500" : ""}`}>
                  <HighlightText text={node.name} query={searchQuery ?? ""} />
                </span>
                {isHidden && isMaster && (
                  <span className="text-xs bg-gray-700 text-gray-400 px-1 rounded">скрыта</span>
                )}
              </div>

              {showDescription && (
                <div className="text-xs text-gray-400 truncate max-w-xs">
                  <div dangerouslySetInnerHTML={{ __html: node.description_for_players }} />
                </div>
              )}

              {showDescription && isMaster && (
                <p className="text-xs text-blue-400">
                  {(node.map_objects ?? []).filter((obj: any) => obj.is_shown).length}/
                  {(node.map_objects ?? []).length} объектов видно
                </p>
              )}
            </div>

            {/* Actions (master only) */}
            {isMaster && (
              <div className="flex items-center gap-1 shrink-0">
                {/* TODO button */}
                {onAddTODO && (
                  <div className="relative" ref={todoRef}>
                    <button
                      className={`p-1 rounded transition-colors ${
                        todoOpen
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "hover:bg-gray-600 text-gray-400 hover:text-yellow-400"
                      }`}
                      title="Добавить заметку"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTodoOpen((v) => !v);
                      }}
                    >
                      <ClipboardList size={14} />
                    </button>

                    {todoOpen && (
                      <TodoPopup
                        onSubmit={(text) => onAddTODO(node.id, text)}
                        onClose={() => setTodoOpen(false)}
                      />
                    )}
                  </div>
                )}

                {/* Hide/show button */}
                {onToggleHidden && (
                  <button
                    className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                    title={isHidden ? "Раскрыть локацию" : "Скрыть локацию"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleHidden(node.id, !isHidden);
                    }}
                  >
                    {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Children */}
      {hasChildren && expanded && (
        <ul className="pl-4 border-l border-gray-700/50 ml-3">
          {visibleChildren.map((child) => (
            <LocationTreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              onToggleHidden={onToggleHidden}
              onAddTODO={onAddTODO}
              currentLocation={currentLocation}
              isMaster={isMaster}
              showDescription={showDescription}
              showHidden={showHidden}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Tree ────────────────────────────────────────────────────────────────────

interface LocationTreeProps {
  nodes: (Location & { children?: any[] })[];
  onSelect: (location_id: string) => void;
  onToggleHidden?: (locationId: string, hidden: boolean) => void;
  onAddTODO?: (locationId: string, text: string) => void;
  currentLocation?: Location | null;
  isMaster?: boolean;
  isParent?: boolean;
  showDescription?: boolean;
  showHidden?: boolean;
}

export function LocationTree({
  nodes,
  onSelect,
  onToggleHidden,
  onAddTODO,
  currentLocation,
  isMaster,
  isParent = true,
  showDescription = true,
  showHidden = false,
}: LocationTreeProps) {
  const [searchQuery, setSearchQuery] = useState("");
  // console.info(`[showHidden] ${showHidden}`)
  const visibleNodes = useMemo(
    () =>
      nodes.filter((node) => {
        // игрок никогда не видит скрытые
        // мастер видит скрытые только если showHidden = true
        if (node.tags?.includes("hidden") && !showHidden) return false;
        const matchOk = nodeMatchesSearch(node, searchQuery);
        return matchOk;
      }),
    [nodes, showHidden, searchQuery]
  );

  const content = (
    <>
      {/* Search bar */}
      <div className="relative mb-2">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          className="w-full bg-gray-800 border border-gray-700 rounded-md pl-8 pr-8 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="Поиск локации..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 transition-colors"
            onClick={() => setSearchQuery("")}
          >
            <X size={13} />
          </button>
        )}
      </div>

      <ul className="pl-1 space-y-1">
        {visibleNodes.map((node) => (
          <LocationTreeNode
            key={node.id}
            node={node}
            onSelect={onSelect}
            onToggleHidden={onToggleHidden}
            onAddTODO={onAddTODO}
            currentLocation={currentLocation}
            isMaster={isMaster}
            showDescription={showDescription}
            showHidden={showHidden}
            searchQuery={searchQuery}
          />
        ))}
      </ul>
    </>
  );

  if (isParent) {
    return <ScrollArea className="h-[70vh] pr-2">{content}</ScrollArea>;
  }
  return content;
}