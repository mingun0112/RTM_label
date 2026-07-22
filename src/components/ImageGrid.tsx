import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageEntry } from "../types";

interface ImageGridProps {
  images: ImageEntry[];
  selected: Set<string>;
  onToggle: (path: string) => void;
}

export function ImageGrid({ images, selected, onToggle }: ImageGridProps) {
  if (images.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-400 dark:text-neutral-500">
        표시할 이미지가 없습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 overflow-y-auto p-4">
      {images.map((image) => {
        const isSelected = selected.has(image.path);
        return (
          <button
            key={image.path}
            type="button"
            onClick={() => onToggle(image.path)}
            className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition ${
              isSelected
                ? "border-blue-500 ring-2 ring-blue-500"
                : "border-transparent hover:border-neutral-300 dark:hover:border-neutral-600"
            }`}
            title={image.name}
          >
            <img
              src={convertFileSrc(image.path)}
              alt={image.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {isSelected && (
              <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                ✓
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[11px] text-white opacity-0 group-hover:opacity-100">
              {image.name}
            </div>
          </button>
        );
      })}
    </div>
  );
}
