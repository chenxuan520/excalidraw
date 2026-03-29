import { useEffect, useState } from "react";
import { Dialog } from "../../packages/excalidraw/components/Dialog";
import { TextField } from "../../packages/excalidraw/components/TextField";
import { FilledButton } from "../../packages/excalidraw/components/FilledButton";
import { useUIAppState } from "../../packages/excalidraw/context/ui-appState";
import { useI18n } from "../../packages/excalidraw/i18n";
import type { WebDAVConfig } from "./state";

import "./WebDAVDialog.scss";

type WebDAVLoginDialogProps = {
  isOpen: boolean;
  initialConfig: WebDAVConfig | null;
  isConnecting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (config: WebDAVConfig) => Promise<void> | void;
};

export const WebDAVLoginDialog = ({
  isOpen,
  initialConfig,
  isConnecting,
  error,
  onClose,
  onSubmit,
}: WebDAVLoginDialogProps) => {
  const { t } = useI18n();
  const openDialog = useUIAppState().openDialog;
  const [serverUrl, setServerUrl] = useState(initialConfig?.serverUrl || "");
  const [basePath, setBasePath] = useState(initialConfig?.basePath || "/");
  const [username, setUsername] = useState(initialConfig?.username || "");
  const [password, setPassword] = useState(initialConfig?.password || "");

  useEffect(() => {
    setServerUrl(initialConfig?.serverUrl || "");
    setBasePath(initialConfig?.basePath || "/");
    setUsername(initialConfig?.username || "");
    setPassword(initialConfig?.password || "");
  }, [initialConfig, isOpen]);

  useEffect(() => {
    if (isOpen && openDialog) {
      onClose();
    }
  }, [isOpen, onClose, openDialog]);

  const isDisabled =
    !serverUrl.trim() || !basePath.trim() || !username.trim() || !password;

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      size="small"
      onCloseRequest={onClose}
      title={t("webdav.loginDialog.title")}
    >
      <div className="WebDAVDialog">
        <TextField
          label={t("webdav.loginDialog.serverUrl")}
          value={serverUrl}
          onChange={setServerUrl}
          placeholder={t("webdav.loginDialog.serverUrlPlaceholder")}
          fullWidth
        />
        <TextField
          label={t("webdav.loginDialog.basePath")}
          value={basePath}
          onChange={setBasePath}
          placeholder={t("webdav.loginDialog.basePathPlaceholder")}
          fullWidth
        />
        <TextField
          label={t("webdav.loginDialog.username")}
          value={username}
          onChange={setUsername}
          placeholder={t("webdav.loginDialog.usernamePlaceholder")}
          fullWidth
        />
        <TextField
          label={t("webdav.loginDialog.password")}
          value={password}
          onChange={setPassword}
          placeholder={t("webdav.loginDialog.passwordPlaceholder")}
          fullWidth
          isRedacted
        />
        <div className="WebDAVDialog__help">{t("webdav.loginDialog.help")}</div>
        {error && <div className="WebDAVDialog__error">{error}</div>}
        <div className="WebDAVDialog__actions">
          <FilledButton
            variant="outlined"
            label={t("buttons.cancel")}
            onClick={onClose}
          />
          <FilledButton
            label={
              isConnecting
                ? t("webdav.loginDialog.loggingIn")
                : t("webdav.loginDialog.login")
            }
            onClick={() => {
              if (isDisabled || isConnecting) {
                return;
              }
              return onSubmit({
                serverUrl,
                basePath,
                username,
                password,
              });
            }}
            color="primary"
          />
        </div>
      </div>
    </Dialog>
  );
};
