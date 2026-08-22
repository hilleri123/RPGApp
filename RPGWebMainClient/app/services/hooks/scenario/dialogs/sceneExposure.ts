import type { SceneExposureOut, SceneExposure } from '@/app/services/types2';
import type { ExposureAudioLink, ExposureAudioLinkPayload } from '@/app/services/types/audio';

export function normalizeExposureFromFull(se: any): SceneExposureOut {
  return {
    id: se?.id ?? null,
    name: se?.name ?? '',
    order_num: se?.order_num ?? 0,
    tags: se?.tags ?? [],

    npcs: se?.npcs ?? [],
    items: se?.items ?? [],
    template_npc_links: (se?.template_npc_links ?? []).map((l: any) => ({
      template_npc: l.template_npc,
      qty: l.qty ?? 1,
    })),
    template_item_links: (se?.template_item_links ?? []).map((l: any) => ({
      template_item: l.template_item,
      qty: l.qty ?? 1,
    })),
    audio_tracks: (se?.audio_tracks ?? []).map(normalizeAudioLinkFromFull),

    obstacles: (se?.obstacles ?? []).map(normalizeObstacleFromFull),
  };
}

export function normalizeObstacleFromFull(o: any) {
  return {
    id: o?.id ?? null,
    name: o?.name ?? '',
    description_for_master: o?.description_for_master ?? null,
    description_for_players: o?.description_for_players ?? null,
    data: o?.data ?? {},
    force: !!o?.force,
    tags: o?.tags ?? [],
  };
}

export function normalizeAudioLinkFromFull(a: any): ExposureAudioLink {
  return {
    audio_track_id: String(a?.audio_track_id ?? a?.audio_track?.id ?? ''),
    volume: a?.volume ?? 1.0,
    loop: a?.loop ?? false,
    fade_in: a?.fade_in ?? 0,
    fade_out: a?.fade_out ?? 0,
    order_num: a?.order_num ?? 0,
    audio_track: a?.audio_track ?? null,
  };
}

export function stripTmpIdToNull(id: string | null | undefined): string | null | undefined {
  if (typeof id === 'string' && id.startsWith('tmp_')) return null;
  return id;
}

export function buildExposurePayload(se: any): SceneExposure {
  return {
    id: stripTmpIdToNull(se?.id),
    name: se?.name ?? '',
    order_num: se?.order_num ?? 0,
    tags: se?.tags ?? [],

    npc_ids: (se?.npcs ?? []).map((x: any) => x?.id).filter(Boolean),
    item_ids: (se?.items ?? []).map((x: any) => x?.id).filter(Boolean),
    template_npc_ids: (se?.template_npc_links ?? []).map((l: any) => ({
      id: l.template_npc?.id,
      qty: l.qty ?? 1,
    })).filter((l: any) => l.id),
    template_item_ids: (se?.template_item_links ?? []).map((l: any) => ({
      id: l.template_item?.id,
      qty: l.qty ?? 1,
    })).filter((l: any) => l.id),

    audio_ids: (se?.audio_tracks ?? []).map((a: ExposureAudioLink): ExposureAudioLinkPayload => ({
      audio_track_id: String(a.audio_track_id),
      volume: a.volume,
      loop: a.loop,
      fade_in: a.fade_in,
      fade_out: a.fade_out,
      order_num: a.order_num,
    })),

    obstacles: (se?.obstacles ?? []).map((o: any) => ({
      id: stripTmpIdToNull(o?.id),
      name: String(o?.name ?? '').trim(),
      description_for_master: o?.description_for_master ?? null,
      description_for_players: o?.description_for_players ?? null,
      data: o?.data ?? {},
      tags: o?.tags ?? [],
    })),
  };
}

export function buildExposuresPayload(exposures: any[]): SceneExposure[] {
  return (exposures ?? []).map(buildExposurePayload);
}