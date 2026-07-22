import { load, Store } from "@tauri-apps/plugin-store";
import { DEFAULT_SETTINGS, type Settings } from "../types";

const STORE_PATH = "settings.json";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_PATH, { defaults: {} });
  }
  return storePromise;
}

export async function loadSettings(): Promise<Settings> {
  const store = await getStore();
  const saved = await store.get<Settings>("settings");
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(settings: Settings): Promise<void> {
  const store = await getStore();
  await store.set("settings", settings);
  await store.save();
}
