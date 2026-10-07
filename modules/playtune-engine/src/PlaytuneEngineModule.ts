import { NativeModule, requireNativeModule } from "expo";

import type {
  EngineInfo,
  EngineSong,
  EqualizerInfo,
  LastSession,
  PlayerState,
  PlaytuneEngineEvents,
  Progress,
  QueueItem,
  RepeatMode,
  SleepTimerInfo,
  VolumeInfo,
} from "./PlaytuneEngine.types";

declare class PlaytuneEngineModule extends NativeModule<PlaytuneEngineEvents> {
  getEngineInfo(): EngineInfo;

  // Library
  scanSongs(minDurationMs: number): Promise<EngineSong[]>;
  /** file:// uri of a cached JPEG, or null if the song has no artwork */
  getArtwork(id: string, size: number): Promise<string | null>;
  clearArtworkCache(): Promise<number>;
  getLastSession(): Promise<LastSession>;

  // Queue
  setQueue(
    items: QueueItem[],
    startIndex: number,
    startPositionMs: number,
    playNow: boolean,
  ): Promise<void>;
  addToQueue(items: QueueItem[], playNext: boolean): Promise<void>;
  removeFromQueue(index: number): Promise<void>;
  moveInQueue(from: number, to: number): Promise<void>;
  getQueueIds(): Promise<string[]>;

  // Playback
  play(): Promise<void>;
  pause(): Promise<void>;
  togglePlay(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  skipToIndex(index: number): Promise<void>;
  seekTo(positionMs: number): Promise<void>;
  stop(): Promise<void>;
  setRepeatMode(mode: RepeatMode): Promise<void>;
  getState(): Promise<PlayerState>;
  getProgress(): Promise<Progress>;

  // Phone media volume (no system volume bar is shown)
  getVolume(): Promise<VolumeInfo>;
  setVolume(index: number): Promise<VolumeInfo>;

  // Sleep timer (runs in the background service)
  startSleepTimer(durationMs: number): Promise<SleepTimerInfo>;
  cancelSleepTimer(): Promise<SleepTimerInfo>;
  getSleepTimer(): Promise<SleepTimerInfo>;

  /**
   * Pause when headphones / Bluetooth disconnect (on by default).
   * Added in the next native build: older app builds don't have it, so call it through engine.ts.
   */
  setPauseOnDetach?(enabled: boolean): Promise<boolean>;

  /** Opens Android's share screen with the song file. */
  shareSong(
    id: string,
    mimeType: string | null,
    title: string,
  ): Promise<boolean>;

  // Equalizer (each setter returns the updated info)
  getEqualizer(): Promise<EqualizerInfo>;
  setEqualizerEnabled(enabled: boolean): Promise<EqualizerInfo>;
  setBandLevel(band: number, levelMb: number): Promise<EqualizerInfo>;
  usePreset(index: number): Promise<EqualizerInfo>;
  setBassBoost(strength: number): Promise<EqualizerInfo>;
  setVirtualizer(strength: number): Promise<EqualizerInfo>;
}

export default requireNativeModule<PlaytuneEngineModule>("PlaytuneEngine");
