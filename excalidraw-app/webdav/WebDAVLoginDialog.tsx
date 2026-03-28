import { useEffect, useState } from "react";
import { Dialog } from "../../packages/excalidraw/components/Dialog";
import { TextField } from "../../packages/excalidraw/components/TextField";
import { FilledButton } from "../../packages/excalidraw/components/FilledButton";
import { useUIAppState } from "../../packages/excalidraw/context/ui-appState";
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
    <Dialog size="small" onCloseRequest={onClose} title="在线模式登录">
      <div className="WebDAVDialog">
        <TextField
          label="服务器地址"
          value={serverUrl}
          onChange={setServerUrl}
          placeholder="https://example.com/webdav"
          fullWidth
        />
        <TextField
          label="路径"
          value={basePath}
          onChange={setBasePath}
          placeholder="/drawings"
          fullWidth
        />
        <TextField
          label="用户名"
          value={username}
          onChange={setUsername}
          placeholder="username"
          fullWidth
        />
        <TextField
          label="密码"
          value={password}
          onChange={setPassword}
          placeholder="password"
          fullWidth
          isRedacted
        />
        <div className="WebDAVDialog__help">
          登录信息会保存在浏览器本地，并在刷新后自动恢复在线模式。
        </div>
        {error && <div className="WebDAVDialog__error">{error}</div>}
        <div className="WebDAVDialog__actions">
          <FilledButton variant="outlined" label="取消" onClick={onClose} />
          <FilledButton
            label={isConnecting ? "登录中" : "登录"}
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
