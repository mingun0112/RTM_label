import { invoke } from "@tauri-apps/api/core";
import type { ImageEntry, MoveOutcome } from "../types";

export function listImages(folder: string, limit: number): Promise<ImageEntry[]> {
  return invoke("list_images", { folder, limit });
}

export function moveImages(paths: string[], targetDir: string): Promise<MoveOutcome[]> {
  return invoke("move_images", { paths, targetDir });
}
