
export type AudioTrack = {
  id: string;
  name: string;
  description?: string | null;
  url: string;
  duration?: number | null;
  file_size?: number | null;
  mime_type?: string | null;
  tags?: string[] | null;
  created_by?: string | null;
  created_at?: string | null;
};

export type AudioTrackCreateResult = AudioTrack;
export type AudioTrackUpdatePayload = {
  name?: string;
  description?: string | null;
  tags?: string[] | null;
};

export type ExposureAudioLink = {
  audio_track_id: string;
  volume: number;
  loop: boolean;
  fade_in: number;
  fade_out: number;
  order_num: number;
  audio_track: AudioTrack;
};

export type ExposureAudioLinkPayload = {
  audio_track_id: string;
  volume?: number;
  loop?: boolean;
  fade_in?: number;
  fade_out?: number;
  order_num?: number;
};


export type AudioQueueReason = {
  type: 'exposure_applied';
  exposure_id: string;
  exposure_name: string;
  source_type: 'location' | 'story_beat';
  source_name: string;
  source_id: string;
  scene_name?: string | null;
  scene_id?: string | null;
};

export type AudioQueueEntry = {
  id: string;
  audio_track_id: string;
  track_name: string;
  track_url: string;
  track_duration?: number | null;
  volume: number;
  loop: boolean;
  fade_in: number;
  fade_out: number;
  added_at: string;        // ISO datetime
  played: boolean;
  reason: AudioQueueReason;
};


export type AudioPlayerState = {
  current_entry_id: string | null;
  playing: boolean;
  volume: number;
  position_sec: number;
  position_at: string | null;  // ISO datetime
};
