import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageEntry } from "../types";

interface ImageGridProps {
  images: ImageEntry[];
  selected: Set<string>;
  onToggle: (path: string) => void;
}

const GAP = 12;
const MIN_TILE = 48;
const MAX_TILE = 320;

// Picks a column count (via the container's aspect ratio) that lets square
// tiles fill the measured area as large as possible on both axes. If even
// the readability floor can't fit everyone, it fixes the tile size at that
// floor, fits as many columns as the width allows, and lets rows overflow
// into a vertical scroll instead of overflowing/shrinking unpredictably.
function computeLayout(width: number, height: number, count: number) {
  if (count === 0 || width <= 0 || height <= 0) {
    return { columns: 1, tileSize: MAX_TILE, needsScroll: false };
  }

  const ratio = width / height;
  const idealColumns = Math.min(count, Math.max(1, Math.round(Math.sqrt(count * ratio))));
  const idealRows = Math.ceil(count / idealColumns);
  const idealTileSize = Math.min(
    (width - GAP * (idealColumns - 1)) / idealColumns,
    (height - GAP * (idealRows - 1)) / idealRows,
  );

  if (idealTileSize >= MIN_TILE) {
    return { columns: idealColumns, tileSize: Math.min(MAX_TILE, idealTileSize), needsScroll: false };
  }

  const columns = Math.max(1, Math.floor((width + GAP) / (MIN_TILE + GAP)));
  return { columns, tileSize: MIN_TILE, needsScroll: true };
}

export function ImageGrid({ images, selected, onToggle }: ImageGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { columns, tileSize, needsScroll } = useMemo(
    () => computeLayout(size.width, size.height, images.length),
    [size.width, size.height, images.length],
  );

  return (
    <div
      ref={containerRef}
      className={`min-h-0 flex-1 p-4 ${needsScroll ? "overflow-y-auto" : "overflow-hidden"}`}
    >
      {images.length === 0 ? (
        <div className="flex h-full items-center justify-center text-neutral-400 dark:text-neutral-500">
          표시할 이미지가 없습니다.
        </div>
      ) : (
        <div
          className="grid place-content-center"
          style={{
            gridTemplateColumns: `repeat(${columns}, ${tileSize}px)`,
            gap: GAP,
          }}
        >
          {images.map((image) => {
            const isSelected = selected.has(image.path);
            return (
              <button
                key={image.path}
                type="button"
                onClick={() => onToggle(image.path)}
                style={{ width: tileSize, height: tileSize }}
                className={`group relative overflow-hidden rounded-lg border-2 transition ${
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
      )}
    </div>
  );
}
