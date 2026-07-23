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

// Picks the column count that lets square tiles fill the measured container
// (width and height) as large as possible without overflowing either axis.
function computeLayout(width: number, height: number, count: number) {
  if (count === 0 || width <= 0 || height <= 0) {
    return { columns: 1, tileSize: MAX_TILE };
  }
  let bestColumns = 1;
  let bestTileSize = 0;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const tileFromWidth = (width - GAP * (columns - 1)) / columns;
    const tileFromHeight = (height - GAP * (rows - 1)) / rows;
    const tileSize = Math.min(tileFromWidth, tileFromHeight);
    if (tileSize > bestTileSize) {
      bestTileSize = tileSize;
      bestColumns = columns;
    }
  }
  return { columns: bestColumns, tileSize: Math.min(MAX_TILE, bestTileSize) };
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

  const { columns, tileSize } = useMemo(
    () => computeLayout(size.width, size.height, images.length),
    [size.width, size.height, images.length],
  );
  // Once tiles hit the readability floor, stop shrinking further and let the
  // grid scroll instead of cramming everything into the visible area.
  const needsScroll = tileSize <= MIN_TILE;
  const effectiveTileSize = Math.max(MIN_TILE, tileSize);

  if (images.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-neutral-400 dark:text-neutral-500">
        표시할 이미지가 없습니다.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-0 flex-1 p-4 ${needsScroll ? "overflow-y-auto" : "overflow-hidden"}`}
    >
      <div
        className="grid place-content-center"
        style={{
          gridTemplateColumns: `repeat(${columns}, ${effectiveTileSize}px)`,
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
              style={{ width: effectiveTileSize, height: effectiveTileSize }}
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
    </div>
  );
}
