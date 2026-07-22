import type { Settings } from "../types";

interface FolderBarProps {
  settings: Settings;
  onPickSource: () => void;
  onPickTarget: () => void;
  onDisplayCountChange: (count: number) => void;
  disabled: boolean;
}

function FolderField({
  label,
  path,
  onPick,
  disabled,
}: {
  label: string;
  path: string | null;
  onPick: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
        {label}
      </span>
      <span
        className="text-sm truncate text-neutral-800 dark:text-neutral-200 max-w-64"
        title={path ?? undefined}
      >
        {path ?? "등록되지 않음"}
      </span>
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className="shrink-0 rounded-md bg-neutral-200 dark:bg-neutral-700 px-3 py-1 text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-neutral-300 dark:hover:bg-neutral-600 disabled:opacity-50"
      >
        폴더 선택
      </button>
    </div>
  );
}

export function FolderBar({
  settings,
  onPickSource,
  onPickTarget,
  onDisplayCountChange,
  disabled,
}: FolderBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
      <FolderField
        label="소스 폴더"
        path={settings.sourceFolder}
        onPick={onPickSource}
        disabled={disabled}
      />
      <FolderField
        label="타겟 폴더"
        path={settings.targetFolder}
        onPick={onPickTarget}
        disabled={disabled}
      />
      <label className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
        표시 개수
        <input
          type="number"
          min={1}
          max={500}
          value={settings.displayCount}
          disabled={disabled}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (Number.isFinite(value) && value > 0) {
              onDisplayCountChange(Math.floor(value));
            }
          }}
          className="w-20 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-neutral-800 dark:text-neutral-100"
        />
      </label>
    </div>
  );
}
