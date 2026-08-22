import { AudioTrack, AudioTrackCreateResult, AudioTrackUpdatePayload, ExposureAudioLink, ExposureAudioLinkPayload } from '../types/audio';
import { BaseApiClient } from './base';


function buildMultipart(data: unknown, files?: Record<string, File | null | undefined>): FormData {
  const form = new FormData();
  form.append('data', JSON.stringify(data));
  if (files) {
    for (const [k, f] of Object.entries(files)) {
      if (f) form.append(k, f);
    }
  }
  return form;
}

export class AudioApiService extends BaseApiClient {
  private p(path: string) {
    return `/audio${path}`;
  }

  // -------- Tracks --------

  async getTracks(params?: { search?: string; tag?: string; limit?: number; offset?: number }): Promise<AudioTrack[]> {
    return this.get<AudioTrack[]>(this.p(''), params);
  }

  async getTrack(id: string): Promise<AudioTrack> {
    return this.get<AudioTrack>(this.p(`/${id}`));
  }

  async createTrack(
    file: File,
    payload?: { name?: string; description?: string; tags?: string[] }
  ): Promise<AudioTrackCreateResult> {
    const form = new FormData();
    form.append('file', file);

    const params: Record<string, any> = {};
    if (payload?.name) params.name = payload.name;
    if (payload?.description) params.description = payload.description;

    const created = await this.postMultipart<AudioTrackCreateResult>(this.p(''), form, params);
    if (payload?.tags?.length) {
      return this.updateTrack(created.id, { tags: payload.tags });
    }
    return created;
  }

  async updateTrack(id: string, payload: AudioTrackUpdatePayload): Promise<AudioTrack> {
    return this.patch<AudioTrack>(this.p(`/${id}`), payload);
  }

  async deleteTrack(id: string): Promise<void> {
    await this.delete<void>(this.p(`/${id}`));
  }

  // -------- Exposure links --------

  async getExposureAudio(exposureId: string): Promise<ExposureAudioLink[]> {
    return this.get<ExposureAudioLink[]>(this.p(`/exposure/${exposureId}`));
  }

  async addAudioToExposure(
    exposureId: string,
    payload: ExposureAudioLinkPayload
  ): Promise<ExposureAudioLink> {
    return this.post<ExposureAudioLink>(this.p(`/exposure/${exposureId}`), payload);
  }

  async updateExposureAudio(
    exposureId: string,
    trackId: string,
    payload: ExposureAudioLinkPayload
  ): Promise<ExposureAudioLink> {
    return this.patch<ExposureAudioLink>(this.p(`/exposure/${exposureId}/${trackId}`), payload);
  }

  async removeAudioFromExposure(exposureId: string, trackId: string): Promise<void> {
    await this.delete<void>(this.p(`/exposure/${exposureId}/${trackId}`));
  }
}


export const audioApiService = new AudioApiService();