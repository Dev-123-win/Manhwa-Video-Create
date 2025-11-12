// Fix: Define the types used throughout the application.
export interface ManhwaPanel {
  id: string;
  file: File;
  preview: string; // URL.createObjectURL
}

export type VoiceOption = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface PanelTiming {
  panel: number; // 1-based index of the panel
  startTime: number; // in seconds
}

export type ResolutionOption = '720p' | '1080p' | '1440p';
export type AspectRatioOption = '16:9' | '9:16' | '1:1' | '4:3';
export type FpsOption = 24 | 30 | 60;
export type TransitionOption = 'cut' | 'fade' | 'slideleft' | 'slideright' | 'wipeleft' | 'wipedown';

export interface VideoSettings {
  resolution: ResolutionOption;
  fps: FpsOption;
  aspectRatio: AspectRatioOption;
  transition: TransitionOption;
}