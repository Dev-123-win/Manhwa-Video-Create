
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

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
  id: string; // Unique ID for React key prop
}

export interface EditedClip {
  startTime: number;
  duration: number;
  inpaintedImageBase64: string;
  mimeType: string;
  crops: CropRect[];
  // Store original panel id for referencing the source image
  panelId: string; 
}

export type ResolutionOption = '720p' | '1080p' | '1440p';
export type AspectRatioOption = '16:9' | '9:16' | '1:1' | '4:3';
export type FpsOption = 24 | 30 | 60;
export type TransitionOption = 'cut' | 'fade' | 'slideleft' | 'slideright' | 'wipeleft' | 'wipedown';
export type AnimationStyleOption = 'none' | 'zoom' | 'pan_down';

export interface VideoSettings {
  resolution: ResolutionOption;
  fps: FpsOption;
  aspectRatio: AspectRatioOption;
  transition: TransitionOption;
  animation: AnimationStyleOption;
}
