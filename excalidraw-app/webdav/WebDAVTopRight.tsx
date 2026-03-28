import { ToolButton } from "../../packages/excalidraw/components/ToolButton";
import { Tooltip } from "../../packages/excalidraw/components/Tooltip";
import {
  LibraryIcon,
  loginIcon,
  publishIcon,
} from "../../packages/excalidraw/components/icons";

type WebDAVTopRightProps = {
  loggedIn: boolean;
  remoteDirty: boolean;
  isSaving: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onOpenManager: () => void;
  onSave: () => void;
};

export const WebDAVTopRight = ({
  loggedIn,
  remoteDirty,
  isSaving,
  onLogin,
  onLogout,
  onOpenManager,
  onSave,
}: WebDAVTopRightProps) => {
  const saveLabel = isSaving
    ? "保存中"
    : remoteDirty
    ? "保存到云端 *"
    : "保存到云端";

  return (
    <div className="top-right-ui top-right-ui--webdav">
      {!loggedIn ? (
        <Tooltip label="在线模式">
          <ToolButton
            type="icon"
            icon={loginIcon}
            aria-label="在线模式"
            onClick={onLogin}
          />
        </Tooltip>
      ) : (
        <>
          <Tooltip label={saveLabel}>
            <ToolButton
              type="icon"
              icon={publishIcon}
              aria-label={saveLabel}
              isLoading={isSaving}
              onClick={onSave}
            />
          </Tooltip>
          <Tooltip label="管理文件">
            <ToolButton
              type="icon"
              icon={LibraryIcon}
              aria-label="管理文件"
              onClick={onOpenManager}
            />
          </Tooltip>
          <Tooltip label="退出登陆">
            <ToolButton
              type="icon"
              icon={loginIcon}
              aria-label="退出登陆"
              onClick={onLogout}
            />
          </Tooltip>
        </>
      )}
    </div>
  );
};
