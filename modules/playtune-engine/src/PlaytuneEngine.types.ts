/** Playtune has 2 loop states: off, or loop the current song. */
export type RepeatMode = "off" | "one";

/** A song found by scanSongs(). Missing tags are null (the app shows "Unknown artist" etc.). */
export type EngineSong = {
  id: string;
  uri: string;
  title: string;
  artist: string | null;
  album: string | null;
  albumId: string;
  durationMs: number;
  track: number;
  year: number;
  /** Seconds since 1970 */
  dateAdded: number;
  size: number;
  mimeType: string | null;
  fileName: string | null;
  path: string | null;
};

/** What the engine needs to play a song. */
export type QueueItem = {
  id: string;
  uri: string;
  title: string;
  artist?: string | null;
  album?: string | null;
};

export type PlayerState = {
  isPlaying: boolean;
  playWhenReady: boolean;
  state: "idle" | "buffering" | "ready" | "ended";
  repeatMode: RepeatMode;
  index: number;
  mediaId: string | null;
  queueLength: number;
  positionMs: number;
  durationMs: number;
};

export type Progress = {
  positionMs: number;
  durationMs: number;
  bufferedMs: number;
};

export type EqualizerBand = {
  index: number;
  centerHz: number;
  /** millibels */
  level: number;
};

export type EqualizerInfo = {
  supported: boolean;
  enabled?: boolean;
  /** -1 = custom */
  preset?: number;
  presets?: string[];
  bands?: EqualizerBand[];
  /** [min, max] in millibels */
  levelRange?: [number, number];
  bassSupported?: boolean;
  /** 0–1000 */
  bassStrength?: number;
  virtualizerSupported?: boolean;
  /** 0–1000 */
  virtualizerStrength?: number;
};

export type LastSession = {
  mediaIds: string[];
  index: number;
  positionMs: number;
} | null;

export type EngineInfo = {
  engineVersion: string;
  media3Version: string;
  androidSdk: number;
};

export type TrackChangeEvent = {
  mediaId: string | null;
  reason: "auto" | "seek" | "repeat" | "playlist";
};

export type EngineErrorEvent = {
  code: string;
  message: string;
  mediaId: string | null;
};

/** Phone media volume (steps, e.g. 0–15). */
export type VolumeInfo = {
  volume: number;
  min: number;
  max: number;
  /** true on phones where the volume can't be changed by apps */
  fixed: boolean;
};

export type SleepTimerInfo = {
  active: boolean;
  remainingMs: number;
};

export type PlaytuneEngineEvents = {
  onPlayerState: (state: PlayerState) => void;
  onTrackChange: (event: TrackChangeEvent) => void;
  onError: (event: EngineErrorEvent) => void;
  onVolumeChange: (info: VolumeInfo) => void;
};
