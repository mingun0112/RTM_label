import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";
import { FolderBar } from "./components/FolderBar";
import { ImageGrid } from "./components/ImageGrid";
import { listImages, moveImages, moveToFinished } from "./lib/commands";
import { loadSettings, saveSettings } from "./lib/settingsStore";
import { DEFAULT_SETTINGS, type ImageEntry, type Settings } from "./types";

function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [remainingCount, setRemainingCount] = useState<number | null>(null);
  // Snapshot of remainingCount taken when a folder is (re)registered, used as
  // the baseline for the progress bar so it doesn't reset on every refresh.
  const [sessionStartCount, setSessionStartCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const refreshImages = useCallback(
    async (folder: string, displayCount: number, resetSession: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const listing = await listImages(folder, displayCount);
        setImages(listing.images);
        setSelected(new Set());
        setRemainingCount(listing.totalRemaining);
        if (resetSession) {
          setSessionStartCount(listing.totalRemaining);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    (async () => {
      const saved = await loadSettings();
      setSettings(saved);
      setReady(true);
      if (saved.sourceFolder) {
        await refreshImages(saved.sourceFolder, saved.displayCount, true);
      }
    })();
  }, [refreshImages]);

  const updateSettings = useCallback(async (next: Settings) => {
    setSettings(next);
    await saveSettings(next);
  }, []);

  const handlePickSource = useCallback(async () => {
    const picked = await open({ directory: true });
    if (typeof picked !== "string") return;
    const next = { ...settings, sourceFolder: picked };
    await updateSettings(next);
    await refreshImages(picked, next.displayCount, true);
  }, [settings, updateSettings, refreshImages]);

  const handlePickTarget = useCallback(async () => {
    const picked = await open({ directory: true });
    if (typeof picked !== "string") return;
    await updateSettings({ ...settings, targetFolder: picked });
  }, [settings, updateSettings]);

  const handleDisplayCountChange = useCallback(
    async (count: number) => {
      const next = { ...settings, displayCount: count };
      await updateSettings(next);
      if (next.sourceFolder) {
        await refreshImages(next.sourceFolder, count, false);
      }
    },
    [settings, updateSettings, refreshImages],
  );

  const toggleSelect = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleTransfer = useCallback(async () => {
    if (!settings.targetFolder || selected.size === 0) return;
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const selectedPaths = Array.from(selected);
      const unselectedPaths = images
        .filter((image) => !selected.has(image.path))
        .map((image) => image.path);

      const [transferOutcomes, finishedOutcomes] = await Promise.all([
        moveImages(selectedPaths, settings.targetFolder),
        unselectedPaths.length > 0 ? moveToFinished(unselectedPaths) : Promise.resolve([]),
      ]);

      const movedCount = transferOutcomes.filter((o) => !o.error).length;
      const renamedCount = transferOutcomes.filter((o) => !o.error && o.renamed).length;
      const finishedCount = finishedOutcomes.filter((o) => !o.error).length;
      const failedCount =
        transferOutcomes.filter((o) => o.error).length +
        finishedOutcomes.filter((o) => o.error).length;

      const parts = [`${movedCount}개 전송됨`];
      if (renamedCount > 0) parts.push(`${renamedCount}개 이름 변경`);
      if (finishedCount > 0) parts.push(`${finishedCount}개 검토 완료`);
      if (failedCount > 0) parts.push(`${failedCount}개 실패`);
      setStatusMessage(parts.join(", "));

      if (settings.sourceFolder) {
        await refreshImages(settings.sourceFolder, settings.displayCount, false);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [settings, selected, images, refreshImages]);

  const canTransfer = settings.targetFolder !== null && selected.size > 0 && !loading;

  const processedCount =
    sessionStartCount !== null ? sessionStartCount - (remainingCount ?? sessionStartCount) : 0;
  const progressPct =
    sessionStartCount !== null && sessionStartCount > 0
      ? Math.min(100, (processedCount / sessionStartCount) * 100)
      : 0;

  return (
    <div className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <FolderBar
        settings={settings}
        onPickSource={handlePickSource}
        onPickTarget={handlePickTarget}
        onDisplayCountChange={handleDisplayCountChange}
        disabled={!ready || loading}
      />

      {remainingCount !== null && (
        <div className="border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
          <div className="mb-1 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>라벨링 진행도</span>
            <span>
              {sessionStartCount ? `${processedCount} / ${sessionStartCount} 처리` : null}
              {sessionStartCount ? " · " : null}
              폴더에 {remainingCount}장 남음
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 px-4 py-2">
        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          {loading
            ? "불러오는 중..."
            : `${images.length}개 표시 중 · ${selected.size}개 선택됨`}
        </div>
        <button
          type="button"
          onClick={handleTransfer}
          disabled={!canTransfer}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          전송 ({selected.size})
        </button>
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
      {statusMessage && !error && (
        <div className="mx-4 mb-2 rounded-md bg-green-100 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          {statusMessage}
        </div>
      )}

      <ImageGrid images={images} selected={selected} onToggle={toggleSelect} />
    </div>
  );
}

export default App;
