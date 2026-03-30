import type { ExcalidrawElement } from "../../packages/excalidraw/element/types";
import type { AppState } from "../../packages/excalidraw/types";
import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "../../packages/excalidraw/appState";
import { clearElementsForLocalStorage } from "../../packages/excalidraw/element";
import { STORAGE_KEYS } from "../app_constants";
import type {
  WebDAVConfig,
  WebDAVRestoreMode,
  WebDAVStoredSession,
} from "../webdav/state";

export const saveUsernameToLocalStorage = (username: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username }),
    );
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const importUsernameFromLocalStorage = (): string | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);
    if (data) {
      return JSON.parse(data).username;
    }
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  return null;
};

export const importFromLocalStorage = () => {
  let savedElements = null;
  let savedState = null;

  try {
    savedElements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    savedState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = clearElementsForLocalStorage(JSON.parse(savedElements));
    } catch (error: any) {
      console.error(error);
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = {
        ...getDefaultAppState(),
        ...clearAppStateForLocalStorage(
          JSON.parse(savedState) as Partial<AppState>,
        ),
      };
    } catch (error: any) {
      console.error(error);
      // Do nothing because appState is already null
    }
  }
  return { elements, appState };
};

export const getElementsStorageSize = () => {
  try {
    const elements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    const elementsSize = elements?.length || 0;
    return elementsSize;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};

export const getTotalStorageSize = () => {
  try {
    let total = 0;
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key) {
        continue;
      }
      const value = localStorage.getItem(key) || "";
      total += key.length + value.length;
    }
    return total;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};

export const saveWebDAVConfigToLocalStorage = (
  config: WebDAVConfig,
  activeFilePath: string | null,
  restoreMode: WebDAVRestoreMode = "remote",
  lastSyncedContent: string | null = null,
) => {
  try {
    const payload: WebDAVStoredSession = {
      ...config,
      activeFilePath,
      restoreMode,
      lastSyncedContent,
    };
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_WEBDAV,
      JSON.stringify(payload),
    );
  } catch (error: any) {
    console.error(error);
  }
};

export const importWebDAVConfigFromLocalStorage =
  (): WebDAVStoredSession | null => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_WEBDAV);
      if (!data) {
        return null;
      }
      const parsed = JSON.parse(data) as
        | (Partial<WebDAVStoredSession> & { remoteDirty?: boolean })
        | null;
      if (
        !parsed ||
        typeof parsed.serverUrl !== "string" ||
        typeof parsed.basePath !== "string" ||
        typeof parsed.username !== "string" ||
        typeof parsed.password !== "string"
      ) {
        return null;
      }
      return {
        serverUrl: parsed.serverUrl,
        basePath: parsed.basePath,
        username: parsed.username,
        password: parsed.password,
        activeFilePath:
          typeof parsed.activeFilePath === "string"
            ? parsed.activeFilePath
            : null,
        restoreMode: parsed.restoreMode === "draft" ? "draft" : "remote",
        lastSyncedContent:
          typeof parsed.lastSyncedContent === "string"
            ? parsed.lastSyncedContent
            : null,
      };
    } catch (error: any) {
      console.error(error);
      return null;
    }
  };

export const clearWebDAVConfigFromLocalStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_WEBDAV);
  } catch (error: any) {
    console.error(error);
  }
};
