import { atom } from "jotai";
import { jotaiStore } from "../../jotai";
import type React from "react";

export type OverwriteConfirmResult = "confirm" | "cancel" | "save-to-cloud";

export type OverwriteConfirmAction = {
  key: OverwriteConfirmResult;
  title: string;
  description: React.ReactNode;
  actionLabel: string;
};

export type OverwriteConfirmState =
  | {
      active: true;
      title: string;
      description: React.ReactNode;
      actionLabel: string;
      color: "danger" | "warning";
      actions?: readonly OverwriteConfirmAction[];
      onResolve: (result: OverwriteConfirmResult) => void;
    }
  | { active: false };

export const overwriteConfirmStateAtom = atom<OverwriteConfirmState>({
  active: false,
});

export async function openConfirmModal({
  title,
  description,
  actionLabel,
  color,
  actions,
}: {
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  color: "danger" | "warning";
  actions?: readonly OverwriteConfirmAction[];
}) {
  return new Promise<OverwriteConfirmResult>((resolve) => {
    jotaiStore.set(overwriteConfirmStateAtom, {
      active: true,
      onResolve: resolve,
      title,
      description,
      actionLabel,
      color,
      actions,
    });
  });
}
