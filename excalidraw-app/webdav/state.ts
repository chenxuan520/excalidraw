import { atom } from "jotai";

export type WebDAVConfig = {
  serverUrl: string;
  basePath: string;
  username: string;
  password: string;
};

export type WebDAVStoredSession = WebDAVConfig & {
  activeFilePath: string | null;
};

export type WebDAVFileEntry = {
  path: string;
  name: string;
  href: string;
  etag: string | null;
  lastModified: string | null;
  size: number | null;
};

export type WebDAVSessionState = {
  loggedIn: boolean;
  config: WebDAVConfig | null;
  activeFile: WebDAVFileEntry | null;
  isConnecting: boolean;
  isSaving: boolean;
  isLoadingFile: boolean;
  remoteDirty: boolean;
  error: string | null;
};

export const initialWebDAVSessionState: WebDAVSessionState = {
  loggedIn: false,
  config: null,
  activeFile: null,
  isConnecting: false,
  isSaving: false,
  isLoadingFile: false,
  remoteDirty: false,
  error: null,
};

export const webdavSessionAtom = atom<WebDAVSessionState>(
  initialWebDAVSessionState,
);

export const webdavFilesAtom = atom<WebDAVFileEntry[]>([]);

export const webdavLoginDialogOpenAtom = atom(false);
export const webdavFileManagerOpenAtom = atom(false);
