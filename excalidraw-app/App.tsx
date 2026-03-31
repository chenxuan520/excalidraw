import polyfill from "../packages/excalidraw/polyfill";
import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "../packages/excalidraw/analytics";
import { ErrorDialog } from "../packages/excalidraw/components/ErrorDialog";
import { TopErrorBoundary } from "./components/TopErrorBoundary";
import { useMathSubtype } from "../packages/excalidraw/element/subtypes/mathjax";
import {
  APP_NAME,
  EVENT,
  THEME,
  TITLE_TIMEOUT,
  VERSION_TIMEOUT,
} from "../packages/excalidraw/constants";
import { loadFromBlob } from "../packages/excalidraw/data/blob";
import { serializeAsJSON } from "../packages/excalidraw/data/json";
import type {
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "../packages/excalidraw/element/types";
import { useCallbackRefState } from "../packages/excalidraw/hooks/useCallbackRefState";
import { t } from "../packages/excalidraw/i18n";
import {
  Excalidraw,
  TTDDialog,
  TTDDialogTrigger,
  StoreAction,
  reconcileElements,
} from "../packages/excalidraw";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
} from "../packages/excalidraw/types";
import type { ResolvablePromise } from "../packages/excalidraw/utils";
import {
  debounce,
  getVersion,
  getFrame,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  isRunningInIframe,
} from "../packages/excalidraw/utils";
import {
  FIREBASE_STORAGE_PREFIXES,
  STORAGE_KEYS,
  SYNC_BROWSER_TABS_TIMEOUT,
} from "./app_constants";
import type { CollabAPI } from "./collab/Collab";
import { collabAPIAtom, isCollaboratingAtom } from "./collab/Collab";
import {
  getCollaborationLinkData,
  isCollaborationLink,
  loadScene,
} from "./data";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
  importWebDAVConfigFromLocalStorage,
  saveWebDAVConfigToLocalStorage,
  clearWebDAVConfigFromLocalStorage,
} from "./data/localStorage";
import CustomStats from "./CustomStats";
import type { RestoredDataState } from "../packages/excalidraw/data/restore";
import type { ImportedDataState } from "../packages/excalidraw/data/types";
import { restore, restoreAppState } from "../packages/excalidraw/data/restore";
import { updateStaleImageStatuses } from "./data/FileManager";
import { newElementWith } from "../packages/excalidraw/element/mutateElement";
import { isInitializedImageElement } from "../packages/excalidraw/element/typeChecks";
import { loadFilesFromFirebase } from "./data/firebase";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
} from "./data/LocalData";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import clsx from "clsx";
import {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "../packages/excalidraw/data/library";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import { AppFooter } from "./components/AppFooter";
import { Provider, useAtom } from "jotai";
import { useAtomWithInitialValue } from "../packages/excalidraw/jotai";
import { appJotaiStore } from "./app-jotai";

import "./index.scss";
import type { ResolutionType } from "../packages/excalidraw/utility-types";
import { openConfirmModal } from "../packages/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { OverwriteConfirmDialog } from "../packages/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import type { RemoteExcalidrawElement } from "../packages/excalidraw/data/reconcile";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "../packages/excalidraw/components/CommandPalette/CommandPalette";
import Trans from "../packages/excalidraw/components/Trans";
import {
  GithubIcon,
  XBrandIcon,
  DiscordIcon,
  loginIcon,
  LibraryIcon,
  ExportIcon,
} from "../packages/excalidraw/components/icons";
import { appThemeAtom, useHandleAppTheme } from "./useHandleAppTheme";
import { getPreferredLanguage } from "./app-language/language-detector";
import { useAppLangCode } from "./app-language/language-state";
import {
  createEmptyExcalidrawContent,
  createWebDAVFile,
  deleteWebDAVFile,
  downloadWebDAVFile,
  fileNameFromRemotePath,
  listExcalidrawFiles,
  renameWebDAVFile,
  uploadWebDAVFile,
  validateWebDAVConfig,
} from "./data/webdav";
import {
  initialWebDAVSessionState,
  webdavFileManagerOpenAtom,
  webdavFilesAtom,
  webdavLoginDialogOpenAtom,
  webdavSessionAtom,
} from "./webdav/state";
import type {
  WebDAVConfig,
  WebDAVFileEntry,
  WebDAVRestoreMode,
  WebDAVStoredSession,
} from "./webdav/state";
import { WebDAVTopRight } from "./webdav/WebDAVTopRight";
import { WebDAVLoginDialog } from "./webdav/WebDAVLoginDialog";
import { WebDAVFileManagerDialog } from "./webdav/WebDAVFileManagerDialog";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
  },
);

let isSelfEmbedding = false;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

const renderExternalSceneOverwriteDescription = () => (
  <Trans
    i18nKey="overwriteConfirm.modal.shareableLink.description"
    bold={(text) => <strong>{text}</strong>}
    br={() => <br />}
  />
);

const renderWebDAVSwitchOverwriteDescription = () => (
  <Trans
    i18nKey="overwriteConfirm.modal.webdavSwitch.description"
    bold={(text) => <strong>{text}</strong>}
    br={() => <br />}
  />
);

const getCurrentSceneName = (excalidrawAPI: ExcalidrawImperativeAPI | null) => {
  return (excalidrawAPI?.getAppState().name || "").replace(/\.excalidraw$/, "");
};

const initializeScene = async (opts: {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
  localDataState?: ImportedDataState | null;
}): Promise<
  { scene: ExcalidrawInitialDataState | null } & (
    | { isExternalScene: true; id: string; key: string }
    | { isExternalScene: false; id?: null; key?: null }
  )
> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState =
    opts.localDataState !== undefined
      ? opts.localDataState
      : importFromLocalStorage();

  let scene: RestoredDataState & {
    scrollToContent?: boolean;
  } = await loadScene(null, null, localDataState);

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal({
        title: t("overwriteConfirm.modal.shareableLink.title"),
        description: renderExternalSceneOverwriteDescription(),
        actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
        color: "danger",
      })) === "confirm"
    ) {
      if (jsonBackendMatch) {
        scene = await loadScene(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
          localDataState,
        );
      }
      scene.scrollToContent = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal({
          title: t("overwriteConfirm.modal.shareableLink.title"),
          description: renderExternalSceneOverwriteDescription(),
          actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
          color: "danger",
        })) === "confirm"
      ) {
        return { scene: data, isExternalScene };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene,
      };
    }
  }

  if (roomLinkData && opts.collabAPI) {
    const { excalidrawAPI } = opts;

    const scene = await opts.collabAPI.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...scene,
        appState: {
          ...restoreAppState(
            {
              ...scene?.appState,
              theme: localDataState?.appState?.theme || scene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
        },
        elements: reconcileElements(
          scene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
    };
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
          scene,
          isExternalScene,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
        }
      : { scene, isExternalScene: false };
  }
  return { scene: null, isExternalScene: false };
};

const ExcalidrawWrapper = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const isCollabDisabled = isRunningInIframe();

  const [appTheme, setAppTheme] = useAtom(appThemeAtom);
  const { editorTheme } = useHandleAppTheme();

  const [langCode, setLangCode] = useAppLangCode();

  const [webdavSession, setWebdavSession] = useAtom(webdavSessionAtom);
  const [webdavFiles, setWebdavFiles] = useAtom(webdavFilesAtom);
  const [isWebDAVLoginOpen, setWebDAVLoginOpen] = useAtom(
    webdavLoginDialogOpenAtom,
  );
  const [isWebDAVFileManagerOpen, setWebDAVFileManagerOpen] = useAtom(
    webdavFileManagerOpenAtom,
  );
  const hasRestoredWebDAVSessionRef = useRef(false);
  const isApplyingRemoteSceneRef = useRef(false);
  const ignoreNextWebDAVChangeRef = useRef(false);
  const lastSyncedWebDAVContentRef = useRef<string | null>(null);
  const pendingWebDAVRestorePathRef = useRef<string | null>(null);
  const webdavRestoreSnapshotRef = useRef<WebDAVStoredSession | null>(
    importWebDAVConfigFromLocalStorage(),
  );

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  const [excalidrawAPI, excalidrawRefCallback] =
    useCallbackRefState<ExcalidrawImperativeAPI>();

  useMathSubtype(excalidrawAPI);

  const [collabAPI] = useAtom(collabAPIAtom);

  const getInitialLocalDataState = useCallback((): ImportedDataState | null => {
    const localDataState = importFromLocalStorage();
    const snapshot = webdavRestoreSnapshotRef.current;

    if (snapshot?.activeFilePath && snapshot.restoreMode === "remote") {
      return {
        appState: localDataState.appState,
        elements: [],
      };
    }

    return localDataState;
  }, []);

  const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
    return isCollaborationLink(window.location.href);
  });

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    // TODO maybe remove this in several months (shipped: 24-03-11)
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  const refreshWebDAVFiles = useCallback(
    async (config = webdavSession.config) => {
      if (!config) {
        setWebdavFiles([]);
        return [];
      }
      const files = await listExcalidrawFiles(config);
      setWebdavFiles(files);
      return files;
    },
    [setWebdavFiles, webdavSession.config],
  );

  const updateStoredWebDAVSession = useCallback(
    (snapshot: Partial<WebDAVStoredSession> & { config?: WebDAVConfig | null }) => {
      const config = snapshot.config ?? webdavSession.config;
      if (!config) {
        return;
      }

      const nextSnapshot: WebDAVStoredSession = {
        serverUrl: config.serverUrl,
        basePath: config.basePath,
        username: config.username,
        password: config.password,
        activeFilePath:
          snapshot.activeFilePath !== undefined
            ? snapshot.activeFilePath
            : webdavRestoreSnapshotRef.current?.activeFilePath ?? null,
        restoreMode:
          snapshot.restoreMode ??
          webdavRestoreSnapshotRef.current?.restoreMode ??
          "remote",
        lastSyncedContent:
          snapshot.lastSyncedContent !== undefined
            ? snapshot.lastSyncedContent
            : webdavRestoreSnapshotRef.current?.lastSyncedContent ?? null,
      };

      webdavRestoreSnapshotRef.current = nextSnapshot;
      saveWebDAVConfigToLocalStorage(
        config,
        nextSnapshot.activeFilePath,
        nextSnapshot.restoreMode,
        nextSnapshot.lastSyncedContent,
      );
    },
    [webdavSession.config],
  );

  const clearWebDAVBinding = useCallback(
    (config = webdavSession.config) => {
      lastSyncedWebDAVContentRef.current = null;
      pendingWebDAVRestorePathRef.current = null;
      if (config) {
        updateStoredWebDAVSession({
          config,
          activeFilePath: null,
          restoreMode: "remote",
          lastSyncedContent: null,
        });
      } else {
        webdavRestoreSnapshotRef.current = null;
      }
      setWebdavSession((current) => ({
        ...current,
        activeFile: null,
        sceneSource: "local",
        documentStatus: "local-only",
        isCurrentSceneWebDAV: false,
        isSaving: false,
        isLoadingFile: false,
        remoteDirty: false,
      }));
    },
    [setWebdavSession, updateStoredWebDAVSession, webdavSession.config],
  );

  const applyWebDAVSyncedState = useCallback(
    (
      activeFile: WebDAVFileEntry | null,
      syncedContent: string | null,
      restoreMode: WebDAVRestoreMode = "remote",
      config = webdavSession.config,
    ) => {
      lastSyncedWebDAVContentRef.current = syncedContent;
      updateStoredWebDAVSession({
        config,
        activeFilePath: activeFile?.path || null,
        restoreMode,
        lastSyncedContent: syncedContent,
      });
      setWebdavSession((current) => ({
        ...current,
        activeFile,
        sceneSource: activeFile ? "webdav" : "local",
        documentStatus: activeFile
          ? restoreMode === "draft"
            ? "dirty"
            : "clean"
          : "local-only",
        isCurrentSceneWebDAV: activeFile !== null,
        isLoadingFile: false,
        remoteDirty: activeFile !== null && restoreMode === "draft",
        error: null,
      }));
    },
    [setWebdavSession, updateStoredWebDAVSession, webdavSession.config],
  );

  const getCurrentWebDAVSyncedContent = useCallback(
    (activeFileName?: string | null) => {
      if (!excalidrawAPI) {
        return null;
      }
      const normalizedSyncedState = {
        ...excalidrawAPI.getAppState(),
        name: activeFileName?.replace(/\.excalidraw$/, "") || "",
      };
      return serializeAsJSON(
        excalidrawAPI.getSceneElements(),
        normalizedSyncedState,
        excalidrawAPI.getFiles(),
        "local",
      );
    },
    [excalidrawAPI],
  );

  const loadWebDAVFile = useCallback(
    async (
      path: string,
      options?: {
        config?: WebDAVConfig | null;
        skipDirtyConfirm?: boolean;
      },
    ) => {
      const resolvedConfig = options?.config || webdavSession.config;
      if (!excalidrawAPI || !resolvedConfig) {
        return;
      }
      const shouldConfirmWebDAVSwitch =
        !options?.skipDirtyConfirm &&
        webdavSession.activeFile?.path !== path &&
        webdavSession.isCurrentSceneWebDAV &&
        webdavSession.remoteDirty;

      if (shouldConfirmWebDAVSwitch) {
        const result = await openConfirmModal({
          title: t("overwriteConfirm.modal.webdavSwitch.title"),
          description: renderWebDAVSwitchOverwriteDescription(),
          actionLabel: t("overwriteConfirm.modal.webdavSwitch.button"),
          color: "danger",
          actions: [
            {
              key: "save-to-cloud",
              title: t("overwriteConfirm.action.saveToCloud.title"),
              description: t("overwriteConfirm.action.saveToCloud.description"),
              actionLabel: t("overwriteConfirm.action.saveToCloud.button"),
            },
          ],
        });

        if (result === "cancel") {
          return;
        }

        if (result === "save-to-cloud") {
          const saved = await saveCurrentSceneToWebDAV();
          if (!saved) {
            return;
          }
        }
      }

      const targetFile = webdavFiles.find((file) => file.path === path) || null;
      setWebdavSession((current) => ({
        ...current,
        sceneSource: "webdav",
        documentStatus: "loading-remote",
        isCurrentSceneWebDAV: true,
        isLoadingFile: true,
        error: null,
      }));
      try {
        const blob = await downloadWebDAVFile(resolvedConfig, path);
        const data = await loadFromBlob(
          blob,
          excalidrawAPI.getAppState(),
          excalidrawAPI.getSceneElementsIncludingDeleted(),
        );
        const activeFile =
          targetFile ||
          ({
            path,
            href: path,
            name: fileNameFromRemotePath(path),
            etag: null,
            lastModified: null,
            size: null,
          } as const);
        const normalizedAppState = {
          ...data.appState,
          name: activeFile.name.replace(/\.excalidraw$/, ""),
        };
        isApplyingRemoteSceneRef.current = true;
        excalidrawAPI.addFiles(Object.values(data.files || {}));
        excalidrawAPI.updateScene({
          elements: data.elements,
          appState: normalizedAppState,
          storeAction: StoreAction.CAPTURE,
        });
        excalidrawAPI.scrollToContent(data.elements, {
          fitToContent: true,
        });
        const syncedContent = serializeAsJSON(
          data.elements,
          normalizedAppState,
          {
            ...excalidrawAPI.getFiles(),
            ...(data.files || {}),
          },
          "local",
        );
        applyWebDAVSyncedState(activeFile, syncedContent, "remote", resolvedConfig);
        excalidrawAPI.setToast({
          message: t("webdav.toast.loaded", { name: activeFile.name }),
          duration: 1500,
        });
      } catch (error: any) {
        setWebdavSession((current) => ({
          ...current,
          sceneSource: current.activeFile ? "webdav" : "local",
          documentStatus: current.activeFile
            ? current.remoteDirty
              ? "dirty"
              : "clean"
            : "local-only",
          isLoadingFile: false,
          error: error.message || t("webdav.errors.loadFailed"),
        }));
        throw error;
      } finally {
        window.setTimeout(() => {
          isApplyingRemoteSceneRef.current = false;
        }, 0);
      }
    },
    [
      applyWebDAVSyncedState,
      excalidrawAPI,
      webdavFiles,
      webdavSession.config,
      webdavSession.isCurrentSceneWebDAV,
      webdavSession.remoteDirty,
      setWebdavSession,
    ],
  );

  const restoreWebDAVSession = useCallback(
    async (config: WebDAVConfig) => {
      const normalizedConfig = {
        ...config,
        serverUrl: config.serverUrl.trim(),
        basePath: config.basePath.trim() || "/",
        username: config.username.trim(),
        password: config.password,
      };
      setWebdavSession((current) => ({
        ...current,
        isConnecting: true,
        error: null,
      }));
      try {
        await validateWebDAVConfig(normalizedConfig);
        const files = await listExcalidrawFiles(normalizedConfig);
        const stored = webdavRestoreSnapshotRef.current;
        const nextActiveFile =
          files.find((file) => file.path === stored?.activeFilePath) || null;
        const restoreMode =
          nextActiveFile && stored?.restoreMode === "draft" ? "draft" : "remote";
        const isRemoteRestore = nextActiveFile !== null && restoreMode === "remote";
        pendingWebDAVRestorePathRef.current = isRemoteRestore
          ? nextActiveFile?.path || null
          : null;

        if (stored) {
          webdavRestoreSnapshotRef.current = {
            ...stored,
            ...normalizedConfig,
            activeFilePath: nextActiveFile?.path || null,
            restoreMode,
          };
        }

        lastSyncedWebDAVContentRef.current = stored?.lastSyncedContent ?? null;
        setWebdavFiles(files);
        setWebdavSession({
          loggedIn: true,
          config: normalizedConfig,
          activeFile: nextActiveFile,
          sceneSource: nextActiveFile ? "webdav" : "local",
          documentStatus: nextActiveFile
            ? isRemoteRestore
              ? "loading-remote"
              : "dirty"
            : "local-only",
          isCurrentSceneWebDAV: nextActiveFile !== null,
          isConnecting: false,
          isSaving: false,
          isLoadingFile: isRemoteRestore && Boolean(excalidrawAPI),
          remoteDirty: nextActiveFile !== null && restoreMode === "draft",
          error: null,
        });
        updateStoredWebDAVSession({
          config: normalizedConfig,
          activeFilePath: nextActiveFile?.path || null,
          restoreMode,
          lastSyncedContent: stored?.lastSyncedContent ?? null,
        });
        setWebDAVLoginOpen(false);

        return {
          config: normalizedConfig,
          activeFile: nextActiveFile,
          restoreMode,
        };
      } catch (error: any) {
        setWebdavSession((current) => ({
          ...current,
          isConnecting: false,
          isLoadingFile: false,
          error: error.message || t("webdav.errors.loginFailed"),
        }));
        return null;
      }
    },
    [excalidrawAPI, setWebDAVLoginOpen, setWebdavFiles, setWebdavSession, updateStoredWebDAVSession],
  );

  const handleWebDAVLogin = useCallback(
    async (config: WebDAVConfig) => {
      const restored = await restoreWebDAVSession(config);
      if (restored?.activeFile && restored.restoreMode === "remote") {
        pendingWebDAVRestorePathRef.current = restored.activeFile.path;
      }
    },
    [excalidrawAPI, loadWebDAVFile, restoreWebDAVSession],
  );

  const handleWebDAVLogout = useCallback(async () => {
    const confirmed = await openConfirmModal({
      title: t("webdav.confirm.logoutTitle"),
      description: t("webdav.confirm.logoutDescription"),
      actionLabel: t("webdav.confirm.logoutAction"),
      color: "danger",
    });

    if (confirmed !== "confirm") {
      return;
    }

    clearWebDAVConfigFromLocalStorage();
    lastSyncedWebDAVContentRef.current = null;
    pendingWebDAVRestorePathRef.current = null;
    webdavRestoreSnapshotRef.current = null;
    setWebdavFiles([]);
    setWebdavSession(initialWebDAVSessionState);
    setWebDAVFileManagerOpen(false);
    setWebDAVLoginOpen(false);
    excalidrawAPI?.updateScene({
      appState: {
        name: "",
      },
      storeAction: StoreAction.UPDATE,
    });
    excalidrawAPI?.setToast({
      message: t("webdav.toast.loggedOut"),
      duration: 1500,
    });
  }, [
    excalidrawAPI,
    setWebDAVFileManagerOpen,
    setWebDAVLoginOpen,
    setWebdavFiles,
    setWebdavSession,
  ]);

  const saveCurrentSceneToWebDAV = useCallback(
    async (targetPath?: string | null) => {
      if (!excalidrawAPI || !webdavSession.config) {
        return false;
      }
      const resolvedPath = targetPath || webdavSession.activeFile?.path;
      if (!resolvedPath) {
        setWebDAVFileManagerOpen(true);
        excalidrawAPI.setToast({
          message: t("webdav.toast.selectFileFirst"),
          duration: 1500,
        });
        return false;
      }
      setWebdavSession((current) => ({
        ...current,
        isSaving: true,
        error: null,
      }));
      try {
        const content = serializeAsJSON(
          excalidrawAPI.getSceneElements(),
          excalidrawAPI.getAppState(),
          excalidrawAPI.getFiles(),
          "local",
        );
        await uploadWebDAVFile(webdavSession.config, resolvedPath, content);
        const files = await refreshWebDAVFiles(webdavSession.config);
        const activeFile =
          files.find((file) => file.path === resolvedPath) ||
          webdavSession.activeFile;
        const syncedContent = getCurrentWebDAVSyncedContent(activeFile?.name);
        if (!syncedContent) {
          return false;
        }
        applyWebDAVSyncedState(activeFile || null, syncedContent, "remote");
        setWebdavSession((current) => ({
          ...current,
          isSaving: false,
        }));
        ignoreNextWebDAVChangeRef.current = true;
        window.setTimeout(() => {
          excalidrawAPI.setToast({
            message: t("webdav.toast.saved"),
            duration: 1500,
          });
        }, 0);
        return true;
      } catch (error: any) {
        setWebdavSession((current) => ({
          ...current,
          isSaving: false,
          error: error.message || t("webdav.errors.saveFailed"),
        }));
        return false;
      }
    },
    [
      excalidrawAPI,
      refreshWebDAVFiles,
      setWebDAVFileManagerOpen,
      setWebdavSession,
      updateStoredWebDAVSession,
      webdavSession.activeFile,
      webdavSession.config,
    ],
  );

  const handleOverwriteCurrentToWebDAVFile = useCallback(
    async (file: WebDAVFileEntry) => {
      if (!excalidrawAPI || !webdavSession.config) {
        return;
      }

      const isOverwritingDifferentFile =
        file.path !== webdavSession.activeFile?.path;
      if (
        isOverwritingDifferentFile &&
        (await openConfirmModal({
          title: t("webdav.confirm.overwriteTitle"),
          description: t("webdav.confirm.overwriteDescription", {
            name: file.name,
          }),
          actionLabel: t("webdav.confirm.overwriteAction"),
          color: "danger",
        })) !== "confirm"
      ) {
        return;
      }

      await saveCurrentSceneToWebDAV(file.path);
      setWebDAVFileManagerOpen(false);
    },
    [
      excalidrawAPI,
      saveCurrentSceneToWebDAV,
      setWebDAVFileManagerOpen,
      webdavSession.activeFile,
      webdavSession.config,
    ],
  );

  const handleCreateEmptyWebDAVFile = useCallback(
    async (fileName: string) => {
      if (!webdavSession.config || !fileName.trim()) {
        return;
      }
      const remotePath = await createWebDAVFile(
        webdavSession.config,
        fileName,
        createEmptyExcalidrawContent(fileName),
      );
      const files = await refreshWebDAVFiles(webdavSession.config);
      const activeFile = files.find((file) => file.path === remotePath) || null;
      pendingWebDAVRestorePathRef.current = null;
      applyWebDAVSyncedState(activeFile, createEmptyExcalidrawContent(fileName), "remote");
      await loadWebDAVFile(remotePath, { skipDirtyConfirm: true });
    },
    [
      loadWebDAVFile,
      refreshWebDAVFiles,
      setWebdavSession,
      updateStoredWebDAVSession,
      webdavSession.config,
    ],
  );

  const handleSaveCurrentAsNewWebDAVFile = useCallback(
    async (fileName: string) => {
      if (!excalidrawAPI || !webdavSession.config || !fileName.trim()) {
        return;
      }
      const content = serializeAsJSON(
        excalidrawAPI.getSceneElements(),
        excalidrawAPI.getAppState(),
        excalidrawAPI.getFiles(),
        "local",
      );
      const remotePath = await createWebDAVFile(
        webdavSession.config,
        fileName,
        content,
      );
      const files = await refreshWebDAVFiles(webdavSession.config);
      const activeFile = files.find((file) => file.path === remotePath) || null;
      applyWebDAVSyncedState(activeFile, content, "remote");
      excalidrawAPI.setToast({
        message: t("webdav.toast.created"),
        duration: 1500,
      });
    },
    [
      excalidrawAPI,
      refreshWebDAVFiles,
      setWebdavSession,
      updateStoredWebDAVSession,
      webdavSession.config,
    ],
  );

  const handleRenameWebDAVFile = useCallback(
    async (file: WebDAVFileEntry, nextName: string) => {
      if (!webdavSession.config || !nextName.trim()) {
        return;
      }
      const nextPath = await renameWebDAVFile(
        webdavSession.config,
        file.path,
        nextName,
      );
      const files = await refreshWebDAVFiles(webdavSession.config);
      const activeFile =
        webdavSession.activeFile?.path === file.path
          ? files.find((item) => item.path === nextPath) || null
          : webdavSession.activeFile;
      applyWebDAVSyncedState(
        activeFile,
        activeFile?.path ? lastSyncedWebDAVContentRef.current : null,
        activeFile?.path ? (webdavSession.remoteDirty ? "draft" : "remote") : "remote",
      );
      excalidrawAPI?.setToast({
        message: t("webdav.toast.renamed"),
        duration: 1500,
      });
    },
    [
      excalidrawAPI,
      refreshWebDAVFiles,
      setWebdavSession,
      updateStoredWebDAVSession,
      webdavSession.activeFile,
      webdavSession.config,
    ],
  );

  const handleDeleteWebDAVFile = useCallback(
    async (file: WebDAVFileEntry) => {
      if (!webdavSession.config) {
        return;
      }
      const confirmed = await openConfirmModal({
        title: t("webdav.confirm.deleteTitle"),
        description: t("webdav.confirm.deleteDescription", {
          name: file.name,
        }),
        actionLabel: t("labels.delete"),
        color: "danger",
      });
      if (confirmed !== "confirm") {
        return;
      }
      await deleteWebDAVFile(webdavSession.config, file.path);
      const files = await refreshWebDAVFiles(webdavSession.config);
      const activeFile =
        webdavSession.activeFile?.path === file.path
          ? null
          : files.find((item) => item.path === webdavSession.activeFile?.path) ||
            webdavSession.activeFile;
      if (!activeFile) {
        clearWebDAVBinding(webdavSession.config);
      } else {
        applyWebDAVSyncedState(
          activeFile,
          lastSyncedWebDAVContentRef.current,
          webdavSession.remoteDirty ? "draft" : "remote",
        );
      }
      excalidrawAPI?.setToast({
        message: t("webdav.toast.deleted"),
        duration: 1500,
      });
    },
    [
      excalidrawAPI,
      refreshWebDAVFiles,
      setWebdavSession,
      updateStoredWebDAVSession,
      webdavSession.activeFile,
      webdavSession.config,
    ],
  );

  useEffect(() => {
    if (hasRestoredWebDAVSessionRef.current) {
      return;
    }
    hasRestoredWebDAVSessionRef.current = true;

    const storedConfig = webdavRestoreSnapshotRef.current;
    if (!storedConfig) {
      return;
    }
    handleWebDAVLogin({
      serverUrl: storedConfig.serverUrl,
      basePath: storedConfig.basePath,
      username: storedConfig.username,
      password: storedConfig.password,
    });
  }, [handleWebDAVLogin]);

  useEffect(() => {
    if (!excalidrawAPI || !webdavSession.loggedIn || !webdavSession.config) {
      return;
    }
    const pendingPath = pendingWebDAVRestorePathRef.current;
    if (!pendingPath) {
      return;
    }
    if (!webdavSession.activeFile || webdavSession.activeFile.path !== pendingPath) {
      return;
    }
    if (webdavSession.documentStatus !== "loading-remote") {
      return;
    }

    pendingWebDAVRestorePathRef.current = null;
    loadWebDAVFile(pendingPath, {
      config: webdavSession.config,
      skipDirtyConfirm: true,
    });
  }, [
    excalidrawAPI,
    loadWebDAVFile,
    webdavSession.activeFile,
    webdavSession.config,
    webdavSession.documentStatus,
    webdavSession.loggedIn,
  ]);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    const loadImages = (
      data: ResolutionType<typeof initializeScene>,
      isInitialLoad = false,
    ) => {
      if (!data.scene) {
        return;
      }
      if (collabAPI?.isCollaborating()) {
        if (data.scene.elements) {
          collabAPI
            .fetchImageFilesFromFirebase({
              elements: data.scene.elements,
              forceFetchFiles: true,
            })
            .then(({ loadedFiles, erroredFiles }) => {
              excalidrawAPI.addFiles(loadedFiles);
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
      } else {
        const fileIds =
          data.scene.elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element)) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (data.isExternalScene) {
          loadFilesFromFirebase(
            `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
            data.key,
            fileIds,
          ).then(({ loadedFiles, erroredFiles }) => {
            excalidrawAPI.addFiles(loadedFiles);
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
          });
        } else if (isInitialLoad) {
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
          // on fresh load, clear unused files from IDB (from previous
          // session)
          LocalData.fileStorage.clearObsoleteFiles({ currentFileIds: fileIds });
        }
      }
    };

    initializeScene({
      collabAPI,
      excalidrawAPI,
      localDataState: getInitialLocalDataState(),
    }).then(async (data) => {
      loadImages(data, /* isInitialLoad */ true);
      initialStatePromiseRef.current.promise.resolve(data.scene);
    });

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens) {
        if (
          collabAPI?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collabAPI.stopCollaboration(false);
        }
        excalidrawAPI.updateScene({ appState: { isLoading: true } });

        initializeScene({
          collabAPI,
          excalidrawAPI,
          localDataState: getInitialLocalDataState(),
        }).then((data) => {
          loadImages(data);
          if (data.scene) {
            excalidrawAPI.updateScene({
              ...data.scene,
              ...restore(data.scene, null, null, { repairBindings: true }),
              storeAction: StoreAction.CAPTURE,
            });
          }
        });
      }
    };

    const titleTimeout = setTimeout(
      () => (document.title = APP_NAME),
      TITLE_TIMEOUT,
    );

    const syncData = debounce(() => {
      if (isTestEnv()) {
        return;
      }
      if (
        !document.hidden &&
        ((collabAPI && !collabAPI.isCollaborating()) || isCollabDisabled)
      ) {
        // don't sync if local state is newer or identical to browser state
        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
          const localDataState = importFromLocalStorage();
          const username = importUsernameFromLocalStorage();
          setLangCode(getPreferredLanguage());
          excalidrawAPI.updateScene({
            ...localDataState,
            storeAction: StoreAction.UPDATE,
          });
          LibraryIndexedDBAdapter.load().then((data) => {
            if (data) {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
              });
            }
          });
          collabAPI?.setUsername(username || "");
        }

        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          const currFiles = excalidrawAPI.getFiles();
          const fileIds =
            elements?.reduce((acc, element) => {
              if (
                isInitializedImageElement(element) &&
                // only load and update images that aren't already loaded
                !currFiles[element.fileId]
              ) {
                return acc.concat(element.fileId);
              }
              return acc;
            }, [] as FileId[]) || [];
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onUnload = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
      if (
        event.type === EVENT.VISIBILITY_CHANGE ||
        event.type === EVENT.FOCUS
      ) {
        syncData();
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
      clearTimeout(titleTimeout);
    };
  }, [getInitialLocalDataState, isCollabDisabled, collabAPI, excalidrawAPI, setLangCode]);

  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      if (
        excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          excalidrawAPI.getSceneElements(),
        )
      ) {
        preventUnload(event);
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (collabAPI?.isCollaborating()) {
      collabAPI.syncElements(elements);
    }

    const currentSerializedContent = serializeAsJSON(
      elements,
      appState,
      files,
      "local",
    );

    setWebdavSession((current) => {
      if (
        ignoreNextWebDAVChangeRef.current ||
        current.documentStatus === "loading-remote"
      ) {
        ignoreNextWebDAVChangeRef.current = false;
        return current;
      }

      if (
        !current.loggedIn ||
        current.isSaving ||
        current.error ||
        current.sceneSource !== "webdav" ||
        !current.activeFile
      ) {
        return current;
      }

      const nextRemoteDirty =
        currentSerializedContent !== lastSyncedWebDAVContentRef.current;

      if (current.remoteDirty === nextRemoteDirty) {
        return current;
      }

      updateStoredWebDAVSession({
        config: current.config,
        activeFilePath: current.activeFile.path,
        restoreMode: nextRemoteDirty ? "draft" : "remote",
        lastSyncedContent: lastSyncedWebDAVContentRef.current,
      });

      return {
        ...current,
        documentStatus: nextRemoteDirty ? "dirty" : "clean",
        remoteDirty: nextRemoteDirty,
      };
    });

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;

          const elements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements,
              storeAction: StoreAction.UPDATE,
            });
          }
        }
      });
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  // browsers generally prevent infinite self-embedding, there are
  // cases where it still happens, and while we disallow self-embedding
  // by not whitelisting our own origin, this serves as an additional guard
  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  const currentLocalSceneName = webdavSession.isCurrentSceneWebDAV
    ? ""
    : getCurrentSceneName(excalidrawAPI);

  return (
    <div
      style={{ height: "100%" }}
      className={clsx("excalidraw-app", {
        "is-collaborating": isCollaborating,
      })}
    >
      <Excalidraw
        excalidrawAPI={excalidrawRefCallback}
        aiEnabled={false}
        onChange={onChange}
        initialData={initialStatePromiseRef.current.promise}
        isCollaborating={isCollaborating}
        onPointerUpdate={collabAPI?.onPointerUpdate}
        UIOptions={{
          activeFileDirty: webdavSession.loggedIn && webdavSession.remoteDirty,
          isLocalFile: !webdavSession.isCurrentSceneWebDAV,
          canvasActions: {
            toggleTheme: true,
          },
        }}
        langCode={langCode}
        renderCustomStats={renderCustomStats}
        detectScroll={false}
        handleKeyboardGlobally={true}
        autoFocus={true}
        theme={editorTheme}
        renderTopRightUI={(isMobile) => {
          if (isMobile) {
            return null;
          }
          return (
            <WebDAVTopRight
              loggedIn={webdavSession.loggedIn}
              remoteDirty={webdavSession.remoteDirty}
              isSaving={webdavSession.isSaving}
              onLogin={() => setWebDAVLoginOpen(true)}
              onLogout={handleWebDAVLogout}
              onOpenManager={() => setWebDAVFileManagerOpen(true)}
              onSave={() => saveCurrentSceneToWebDAV()}
            />
          );
        }}
      >
        <AppMainMenu
          loggedIn={webdavSession.loggedIn}
          remoteDirty={webdavSession.remoteDirty}
          onOpenLogin={() => setWebDAVLoginOpen(true)}
          onOpenManager={() => setWebDAVFileManagerOpen(true)}
          onSave={() => saveCurrentSceneToWebDAV()}
          onLogout={handleWebDAVLogout}
          theme={appTheme}
          setTheme={(theme) => setAppTheme(theme)}
        />
        <AppWelcomeScreen onOpenLogin={() => setWebDAVLoginOpen(true)} />
        <OverwriteConfirmDialog>
          <OverwriteConfirmDialog.Actions.ExportToImage />
          <OverwriteConfirmDialog.Actions.SaveToDisk />
        </OverwriteConfirmDialog>
        <AppFooter />
        <TTDDialog
          onTextSubmit={async (input) => {
            try {
              const response = await fetch(
                `${
                  import.meta.env.VITE_APP_AI_BACKEND
                }/v1/ai/text-to-diagram/generate`,
                {
                  method: "POST",
                  headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ prompt: input }),
                },
              );

              const rateLimit = response.headers.has("X-Ratelimit-Limit")
                ? parseInt(response.headers.get("X-Ratelimit-Limit") || "0", 10)
                : undefined;

              const rateLimitRemaining = response.headers.has(
                "X-Ratelimit-Remaining",
              )
                ? parseInt(
                    response.headers.get("X-Ratelimit-Remaining") || "0",
                    10,
                  )
                : undefined;

              const json = await response.json();

              if (!response.ok) {
                if (response.status === 429) {
                  return {
                    rateLimit,
                    rateLimitRemaining,
                    error: new Error(
                      "Too many requests today, please try again tomorrow!",
                    ),
                  };
                }

                throw new Error(json.message || "Generation failed...");
              }

              const generatedResponse = json.generatedResponse;
              if (!generatedResponse) {
                throw new Error("Generation failed...");
              }

              return { generatedResponse, rateLimit, rateLimitRemaining };
            } catch (err: any) {
              throw new Error("Request failed");
            }
          }}
        />
        <TTDDialogTrigger />

        <WebDAVLoginDialog
          isOpen={isWebDAVLoginOpen}
          initialConfig={webdavSession.config}
          isConnecting={webdavSession.isConnecting}
          error={webdavSession.error}
          onClose={() => setWebDAVLoginOpen(false)}
          onSubmit={handleWebDAVLogin}
        />
        <WebDAVFileManagerDialog
          isOpen={isWebDAVFileManagerOpen}
          files={webdavFiles}
          basePath={webdavSession.config?.basePath || "/"}
          serverUrl={webdavSession.config?.serverUrl || ""}
          activeFilePath={webdavSession.activeFile?.path || null}
          defaultCreateName={currentLocalSceneName}
          isBusy={webdavSession.isLoadingFile || webdavSession.isSaving}
          remoteDirty={webdavSession.remoteDirty}
          onClose={() => setWebDAVFileManagerOpen(false)}
          onLoadFile={async (file) => {
            await loadWebDAVFile(file.path);
            setWebDAVFileManagerOpen(false);
          }}
          onRenameFile={handleRenameWebDAVFile}
          onDeleteFile={handleDeleteWebDAVFile}
          onOverwriteCurrentToFile={handleOverwriteCurrentToWebDAVFile}
          onCreateEmptyFile={handleCreateEmptyWebDAVFile}
          onSaveCurrentAsNewFile={handleSaveCurrentAsNewWebDAVFile}
        />

        {errorMessage && (
          <ErrorDialog onClose={() => setErrorMessage("")}>
            {errorMessage}
          </ErrorDialog>
        )}

        <CommandPalette
          customCommandPaletteItems={[
            {
              label: t("webdav.commandPalette.onlineMode"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !webdavSession.loggedIn,
              icon: loginIcon,
              keywords: ["webdav", "remote", "cloud", "login"],
              perform: () => setWebDAVLoginOpen(true),
            },
            {
              label: webdavSession.remoteDirty
                ? t("webdav.commandPalette.saveDirty")
                : t("webdav.commandPalette.save"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => webdavSession.loggedIn,
              icon: ExportIcon,
              keywords: ["webdav", "remote", "cloud", "save"],
              perform: () => {
                saveCurrentSceneToWebDAV();
              },
            },
            {
              label: t("webdav.commandPalette.manageFiles"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => webdavSession.loggedIn,
              icon: LibraryIcon,
              keywords: ["webdav", "remote", "list", "files"],
              perform: () => setWebDAVFileManagerOpen(true),
            },
            {
              label: t("webdav.commandPalette.logout"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => webdavSession.loggedIn,
              icon: loginIcon,
              keywords: ["webdav", "logout", "disconnect"],
              perform: handleWebDAVLogout,
            },
            {
              label: "GitHub",
              icon: GithubIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: [
                "issues",
                "bugs",
                "requests",
                "report",
                "features",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://github.com/chenxuan520/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              ...CommandPalette.defaultItems.toggleTheme,
              perform: () => {
                setAppTheme(
                  editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK,
                );
              },
            },
            {
              label: t("labels.installPWA"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!pwaEvent,
              perform: () => {
                if (pwaEvent) {
                  pwaEvent.prompt();
                  pwaEvent.userChoice.then(() => {
                    // event cannot be reused, but we'll hopefully
                    // grab new one as the event should be fired again
                    pwaEvent = null;
                  });
                }
              },
            },
          ]}
        />
      </Excalidraw>
    </div>
  );
};

const ExcalidrawApp = () => {
  return (
    <TopErrorBoundary>
      <Provider unstable_createStore={() => appJotaiStore}>
        <ExcalidrawWrapper />
      </Provider>
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;
