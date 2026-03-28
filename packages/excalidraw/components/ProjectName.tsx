import "./TextInput.scss";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { focusNearestParent } from "../utils";

import "./ProjectName.scss";
import { useExcalidrawContainer } from "./App";
import { KEYS } from "../keys";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  ignoreFocus?: boolean;
  className?: string;
  inputClassName?: string;
};

export const ProjectName = (props: Props) => {
  const { id } = useExcalidrawContainer();
  const [fileName, setFileName] = useState<string>(props.value);

  useEffect(() => {
    setFileName(props.value);
  }, [props.value]);

  const handleBlur = (event: any) => {
    if (!props.ignoreFocus) {
      focusNearestParent(event.target);
    }
    const value = event.target.value;
    if (value !== props.value) {
      props.onChange(value);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === KEYS.ENTER) {
      event.preventDefault();
      if (event.nativeEvent.isComposing || event.keyCode === 229) {
        return;
      }
      event.currentTarget.blur();
    }
  };

  return (
    <div className={clsx("ProjectName", props.className)}>
      <label className="ProjectName-label" htmlFor="filename">
        {`${props.label}:`}
      </label>
      <input
        type="text"
        className={clsx("TextInput", props.inputClassName)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        id={`${id}-filename`}
        value={fileName}
        onChange={(event) => setFileName(event.target.value)}
      />
    </div>
  );
};
