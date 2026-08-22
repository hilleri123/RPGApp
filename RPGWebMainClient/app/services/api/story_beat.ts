import { BaseApiClient } from '@/app/services/api/base';
import { StoryBeatCreate, StoryBeat, StoryBeatUpdate } from '../types2/story_beat';
// StoryBeat

class StoryBeatsApiService extends BaseApiClient {
  async listStoryBeats(scenarioId: string): Promise<StoryBeat[]> {
    return this.get<StoryBeat[]>('/story_beats', { scenario_id: scenarioId });
  }

  async getById(id: string): Promise<StoryBeat> {
    return this.get<StoryBeat>(`/story_beats/${id}`);
  }

  async createStoryBeat(payload: StoryBeatCreate): Promise<StoryBeat> {
    return this.post<StoryBeat>('/story_beats', payload);
  }

  async updateStoryBeat(id: string, payload: StoryBeatUpdate): Promise<StoryBeat> {
    return this.put<StoryBeat>(`/story_beats/${id}`, payload);
  }

  async deleteStoryBeat(id: string): Promise<{ ok: boolean }> {
    return this.delete<{ ok: boolean }>(`/story_beats/${id}`);
  }
}

export const storyBeatsApiService = new StoryBeatsApiService();
