'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Header from '@/app/components/layout/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Search, Trash2, Link2, Unlink2, Music2, FileAudio, Pencil, Check, X } from 'lucide-react';
import { audioApiService } from '../services/api/audio';
import { AudioTrack, ExposureAudioLink } from '../services/types/audio';
import { AudioTagFilter } from '@/app/components/audio/AudioTagFilter';
import { AudioTrackTagBadges } from '@/app/components/audio/AudioTrackTagBadges';
import { filterAudioTracks } from '@/app/components/audio/audioTags';

type Props = {
  exposureId?: string | null;
};

function fmtBytes(n?: number | null) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AudioLibraryPage({ exposureId = null }: Props) {
  const [items, setItems] = useState<AudioTrack[]>([]);
  const [linked, setLinked] = useState<ExposureAudioLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayedItems = useMemo(
    () => filterAudioTracks(items, '', activeTags),
    [items, activeTags],
  );

  async function loadTracks(q?: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await audioApiService.getTracks(
        q?.trim() ? { search: q.trim() } : undefined
      );
      setItems(data);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки списка');
    } finally {
      setLoading(false);
    }
  }

  async function loadExposureAudio() {
    if (!exposureId) {
      setLinked([]);
      return;
    }
    try {
      const data = await audioApiService.getExposureAudio(exposureId);
      setLinked(data);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки музыки экспозиции');
    }
  }

  useEffect(() => {
    loadTracks(search);
  }, [search]);

  useEffect(() => {
    loadExposureAudio();
  }, [exposureId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setError('Выбери аудиофайл');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await audioApiService.createTrack(selectedFile, {
        name: uploadName.trim() || undefined,
        description: uploadDescription.trim() || undefined,
        tags: uploadTags.length ? uploadTags : undefined,
      });

      setSelectedFile(null);
      setUploadName('');
      setUploadDescription('');
      setUploadTags([]);
      await loadTracks(search);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(trackId: string) {
    if (!window.confirm('Удалить этот трек?')) return;
    setError(null);

    try {
      await audioApiService.deleteTrack(trackId);
      setItems((prev) => prev.filter((x) => x.id !== trackId));
      setLinked((prev) => prev.filter((x) => x.audio_track_id !== trackId));
    } catch (e: any) {
      setError(e?.message || 'Ошибка удаления');
    }
  }

  async function handleAttach(trackId: string) {
    if (!exposureId) return;
    setError(null);

    try {
      await audioApiService.addAudioToExposure(exposureId, {
        audio_track_id: trackId,
        volume: 0.5,
        loop: true,
        fade_in: 2.0,
        fade_out: 2.0,
        order_num: linked.length,
      });

      await loadExposureAudio();
    } catch (e: any) {
      setError(e?.message || 'Ошибка привязки');
    }
  }

  async function handleDetach(trackId: string) {
    if (!exposureId) return;
    setError(null);

    try {
      await audioApiService.removeAudioFromExposure(exposureId, trackId);
      await loadExposureAudio();
    } catch (e: any) {
      setError(e?.message || 'Ошибка отвязки');
    }
  }

  async function handleSaveTags(trackId: string) {
    setSavingTags(true);
    setError(null);
    try {
      const updated = await audioApiService.updateTrack(trackId, { tags: editingTags });
      setItems((prev) => prev.map((x) => (x.id === trackId ? updated : x)));
      setEditingTagsId(null);
    } catch (e: any) {
      setError(e?.message || 'Ошибка сохранения тегов');
    } finally {
      setSavingTags(false);
    }
  }

  const linkedIds = useMemo(() => new Set(linked.map((x) => x.audio_track_id)), [linked]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section="Аудиотека" />

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Music2 className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Аудиотека сцены</h1>
            <p className="text-sm text-gray-400">
              Загружай треки, ищи по библиотеке и привязывай музыку к экспозиции.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-400" />
              <div className="text-sm font-semibold text-white">Загрузка трека</div>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-300">Файл</label>
                <input
                  type="file"
                  accept="audio/*,.mp3,.ogg,.wav,.flac,.aac,.m4a,.opus"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white file:mr-4 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1.5 file:text-sm file:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-300">Название</label>
                <Input
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder={selectedFile?.name || 'Например: Тревожный эмбиент'}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-300">Описание</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={4}
                  className="block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
                  placeholder="Например: мрачная сцена, шёпот, лаборатория, напряжение"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-300">Теги</label>
                <AudioTagFilter value={uploadTags} onChange={setUploadTags} />
              </div>

              <Button type="submit" disabled={uploading} variant="secondary" className="w-full">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? 'Загрузка...' : 'Загрузить'}
              </Button>
            </form>
          </section>

          <section className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-400" />
              <div className="text-sm font-semibold text-white">Поиск</div>
            </div>

            <div className="flex gap-2">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Поиск по названию, описанию и тегам"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setSearch(searchInput);
                  }
                }}
              />
              <Button type="button" onClick={() => setSearch(searchInput)} variant="secondary">
                Найти
              </Button>
            </div>

            <div className="mt-3 space-y-1">
              <label className="text-xs text-gray-400">Фильтр по тегам</label>
              <AudioTagFilter value={activeTags} onChange={setActiveTags} />
            </div>

            <div className="mt-4 text-sm text-gray-400">
              {loading ? 'Загрузка списка...' : `${displayedItems.length} из ${items.length} треков`}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Библиотека треков</div>
              <div className="text-xs text-gray-400">Прослушивание, удаление, привязка</div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка списка...
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="text-sm text-gray-400">Ничего не найдено.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-gray-400">
                    <th className="px-3 py-2 font-medium">Название</th>
                    <th className="px-3 py-2 font-medium">Описание</th>
                    <th className="px-3 py-2 font-medium">Теги</th>
                    <th className="px-3 py-2 font-medium">Размер</th>
                    <th className="px-3 py-2 font-medium">Тип</th>
                    <th className="px-3 py-2 font-medium">Прослушать</th>
                    <th className="px-3 py-2 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedItems.map((item) => {
                    const isAttached = linkedIds.has(item.id);

                    return (
                      <tr key={item.id} className="border-b border-gray-700/60 align-top">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <FileAudio className="w-4 h-4 text-blue-400" />
                            <div className="font-medium text-white">{item.name}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-300">
                          {item.description || <span className="text-gray-500">—</span>}
                        </td>
                        <td className="px-3 py-3 text-gray-300 min-w-[200px]">
                          {editingTagsId === item.id ? (
                            <div className="space-y-2">
                              <AudioTagFilter value={editingTags} onChange={setEditingTags} />
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={savingTags}
                                  onClick={() => handleSaveTags(item.id)}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingTagsId(null)}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <AudioTrackTagBadges tags={item.tags} />
                              {!item.tags?.length ? (
                                <span className="text-gray-500 text-xs">—</span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTagsId(item.id);
                                  setEditingTags(item.tags ?? []);
                                }}
                                className="shrink-0 text-gray-500 hover:text-gray-300"
                                aria-label="Редактировать теги"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-300">{fmtBytes(item.file_size)}</td>
                        <td className="px-3 py-3 text-gray-300">{item.mime_type || '—'}</td>
                        <td className="px-3 py-3">
                          <audio controls preload="none" src={item.url} className="max-w-[260px]" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            {exposureId && !isAttached && (
                              <Button
                                type="button"
                                onClick={() => handleAttach(item.id)}
                                variant="secondary"
                                size="sm"
                              >
                                <Link2 className="w-4 h-4 mr-2" />
                                В экспозицию
                              </Button>
                            )}

                            {exposureId && isAttached && (
                              <Button
                                type="button"
                                onClick={() => handleDetach(item.id)}
                                variant="outline"
                                size="sm"
                              >
                                <Unlink2 className="w-4 h-4 mr-2" />
                                Убрать
                              </Button>
                            )}

                            <Button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              variant="destructive"
                              size="sm"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Удалить
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}