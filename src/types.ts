export interface ImageEntry {
  path: string;
  name: string;
}

export interface MoveOutcome {
  originalName: string;
  movedTo: string | null;
  renamed: boolean;
  error: string | null;
}

export interface Settings {
  sourceFolder: string | null;
  targetFolder: string | null;
  displayCount: number;
}

export const DEFAULT_SETTINGS: Settings = {
  sourceFolder: null,
  targetFolder: null,
  displayCount: 30,
};
