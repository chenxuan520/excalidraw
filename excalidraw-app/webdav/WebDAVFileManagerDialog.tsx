import { useEffect, useMemo, useState } from "react";
import { Dialog } from "../../packages/excalidraw/components/Dialog";
import { FilledButton } from "../../packages/excalidraw/components/FilledButton";
import { TextField } from "../../packages/excalidraw/components/TextField";
import {
  DuplicateIcon,
  TrashIcon,
  save,
} from "../../packages/excalidraw/components/icons";
import { useUIAppState } from "../../packages/excalidraw/context/ui-appState";
import { useI18n } from "../../packages/excalidraw/i18n";
import type { WebDAVFileEntry } from "./state";

import "./WebDAVDialog.scss";

const getSearchScore = (fileName: string, query: string) => {
  const normalizedFileName = fileName.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  const directIndex = normalizedFileName.indexOf(normalizedQuery);
  if (directIndex >= 0) {
    return 1000 - directIndex;
  }

  let score = 0;
  let queryIndex = 0;

  for (let fileIndex = 0; fileIndex < normalizedFileName.length; fileIndex++) {
    if (normalizedFileName[fileIndex] !== normalizedQuery[queryIndex]) {
      continue;
    }

    score += 10;
    queryIndex += 1;

    if (queryIndex === normalizedQuery.length) {
      return score - fileIndex;
    }
  }

  return -1;
};

type WebDAVFileManagerDialogProps = {
  isOpen: boolean;
  files: WebDAVFileEntry[];
  basePath: string;
  activeFilePath: string | null;
  isBusy: boolean;
  remoteDirty: boolean;
  onClose: () => void;
  onLoadFile: (file: WebDAVFileEntry) => Promise<void> | void;
  onRenameFile: (file: WebDAVFileEntry, name: string) => Promise<void> | void;
  onDeleteFile: (file: WebDAVFileEntry) => Promise<void> | void;
  onOverwriteCurrentToFile: (file: WebDAVFileEntry) => Promise<void> | void;
  onCreateEmptyFile: (name: string) => Promise<void> | void;
  onSaveCurrentAsNewFile: (name: string) => Promise<void> | void;
};

export const WebDAVFileManagerDialog = ({
  isOpen,
  files,
  basePath,
  activeFilePath,
  isBusy,
  remoteDirty,
  onClose,
  onLoadFile,
  onRenameFile,
  onDeleteFile,
  onOverwriteCurrentToFile,
  onCreateEmptyFile,
  onSaveCurrentAsNewFile,
}: WebDAVFileManagerDialogProps) => {
  const { t } = useI18n();
  const openDialog = useUIAppState().openDialog;
  const [createName, setCreateName] = useState("");
  const [renamePath, setRenamePath] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen && openDialog) {
      onClose();
    }
  }, [isOpen, onClose, openDialog]);

  useEffect(() => {
    if (!isOpen) {
      setCreateName("");
      setRenamePath(null);
      setRenameName("");
      setSearchQuery("");
    }
  }, [isOpen]);

  const filteredFiles = useMemo(() => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      return files;
    }

    return files
      .map((file) => ({
        file,
        score: getSearchScore(file.name, normalizedQuery),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.file.name.localeCompare(right.file.name);
      })
      .map((entry) => entry.file);
  }, [files, searchQuery]);

  const emptyState = useMemo(() => files.length === 0, [files.length]);
  const showNoSearchResults = !emptyState && filteredFiles.length === 0;

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      size="regular"
      onCloseRequest={onClose}
      title={t("webdav.fileManager.title")}
    >
      <div className="WebDAVDialog WebDAVDialog--manager">
        <div className="WebDAVDialog__headerMeta">
          <div className="WebDAVDialog__subtitle">
            {t("webdav.fileManager.currentPath", { path: basePath || "/" })}
          </div>
          {remoteDirty && (
            <div className="WebDAVDialog__warning">
              {t("webdav.fileManager.remoteDirtyWarning")}
            </div>
          )}
        </div>
        <div className="WebDAVDialog__search">
          <TextField
            label={t("webdav.fileManager.searchLabel")}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("webdav.fileManager.searchPlaceholder")}
            fullWidth
          />
        </div>
        <div className="WebDAVDialog__list">
          {emptyState ? (
            <div className="WebDAVDialog__empty">
              {t("webdav.fileManager.empty")}
            </div>
          ) : showNoSearchResults ? (
            <div className="WebDAVDialog__empty">
              {t("webdav.fileManager.noSearchResults", { query: searchQuery })}
            </div>
          ) : (
            filteredFiles.map((file) => {
              const isActive = file.path === activeFilePath;
              const isRenaming = renamePath === file.path;
              return (
                <div
                  key={file.path}
                  className={`WebDAVDialog__fileRow${
                    isActive ? " is-active" : ""
                  }`}
                >
                  <div className="WebDAVDialog__fileMeta">
                    {isRenaming ? (
                      <TextField
                        label={t("webdav.fileManager.renameLabel")}
                        value={renameName}
                        onChange={setRenameName}
                        fullWidth
                      />
                    ) : (
                      <button
                        type="button"
                        className="WebDAVDialog__fileLink"
                        onClick={() => onLoadFile(file)}
                        disabled={isBusy}
                      >
                        <span>{file.name}</span>
                        {isActive && (
                          <span className="WebDAVDialog__badge">
                            {t("webdav.fileManager.currentFile")}
                          </span>
                        )}
                      </button>
                    )}
                    <div className="WebDAVDialog__metaRow">
                      {file.lastModified && <span>{file.lastModified}</span>}
                      {typeof file.size === "number" && (
                        <span>{file.size} B</span>
                      )}
                    </div>
                  </div>
                  <div className="WebDAVDialog__rowActions">
                    {isRenaming ? (
                      <>
                        <FilledButton
                          size="medium"
                          variant="outlined"
                          label={t("buttons.cancel")}
                          onClick={() => {
                            setRenamePath(null);
                            setRenameName("");
                          }}
                        />
                        <FilledButton
                          size="medium"
                          label={t("webdav.fileManager.saveName")}
                          onClick={() => onRenameFile(file, renameName)}
                        />
                      </>
                    ) : (
                      <>
                        <FilledButton
                          size="medium"
                          variant="outlined"
                          label={t("webdav.fileManager.overwrite")}
                          icon={save}
                          onClick={() => onOverwriteCurrentToFile(file)}
                        />
                        <FilledButton
                          size="medium"
                          variant="outlined"
                          label={t("webdav.fileManager.rename")}
                          icon={DuplicateIcon}
                          onClick={() => {
                            setRenamePath(file.path);
                            setRenameName(
                              file.name.replace(/\.excalidraw$/, ""),
                            );
                          }}
                        />
                        <FilledButton
                          size="medium"
                          variant="outlined"
                          color="danger"
                          label={t("labels.delete")}
                          icon={TrashIcon}
                          onClick={() => onDeleteFile(file)}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="WebDAVDialog__footer">
          <TextField
            label={t("webdav.fileManager.newFileName")}
            value={createName}
            onChange={setCreateName}
            placeholder={t("webdav.fileManager.newFilePlaceholder")}
            fullWidth
          />
          <div className="WebDAVDialog__actions WebDAVDialog__actions--stacked">
            <FilledButton
              variant="outlined"
              label={t("webdav.fileManager.createEmpty")}
              onClick={() => onCreateEmptyFile(createName)}
            />
            <FilledButton
              label={t("webdav.fileManager.saveAsNew")}
              onClick={() => onSaveCurrentAsNewFile(createName)}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};
