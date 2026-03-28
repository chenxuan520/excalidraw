import React from "react";
import {
  loginIcon,
  ExportIcon,
  LibraryIcon,
} from "../../packages/excalidraw/components/icons";
import type { Theme } from "../../packages/excalidraw/element/types";
import { MainMenu } from "../../packages/excalidraw/index";
import { LanguageList } from "../app-language/LanguageList";

export const AppMainMenu: React.FC<{
  loggedIn: boolean;
  remoteDirty: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  onOpenLogin: () => void;
  onOpenManager: () => void;
  onSave: () => void;
  onLogout: () => void;
}> = React.memo((props) => {
  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {!props.loggedIn ? (
        <MainMenu.Item icon={loginIcon} onSelect={props.onOpenLogin}>
          在线模式
        </MainMenu.Item>
      ) : (
        <>
          <MainMenu.Item icon={ExportIcon} onSelect={props.onSave}>
            {props.remoteDirty ? "保存到云端 *" : "保存到云端"}
          </MainMenu.Item>
          <MainMenu.Item icon={LibraryIcon} onSelect={props.onOpenManager}>
            管理文件
          </MainMenu.Item>
          <MainMenu.Item icon={loginIcon} onSelect={props.onLogout}>
            退出登陆
          </MainMenu.Item>
        </>
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Socials />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme
        allowSystemTheme
        theme={props.theme}
        onSelect={props.setTheme}
      />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
