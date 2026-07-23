import { invoke } from "@tauri-apps/api/core";
import type { ImageListing, MoveOutcome } from "../types";

export function listImages(folder: string, limit: number): Promise<ImageListing> {
  return invoke("list_images", { folder, limit });
}

export function moveImages(paths: string[], targetDir: string): Promise<MoveOutcome[]> {
  return invoke("move_images", { paths, targetDir });
}

export function moveToFinished(paths: string[]): Promise<MoveOutcome[]> {
  return invoke("move_to_finished", { paths });
}
