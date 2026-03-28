import { MIME_TYPES } from "../../packages/excalidraw/constants";
import type { WebDAVConfig, WebDAVFileEntry } from "../webdav/state";

const normalizeBasePath = (basePath: string) => {
  const trimmed = basePath.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  const noLeading = trimmed.replace(/^\/+/, "");
  return `/${noLeading.replace(/\/+$/, "")}`;
};

const normalizeServerUrl = (serverUrl: string) => serverUrl.replace(/\/+$/, "");

const joinRemotePath = (basePath: string, fileName = "") => {
  const normalizedBasePath = normalizeBasePath(basePath);
  const normalizedFileName = fileName.replace(/^\/+/, "");
  if (!normalizedFileName) {
    return normalizedBasePath;
  }
  return normalizedBasePath === "/"
    ? `/${normalizedFileName}`
    : `${normalizedBasePath}/${normalizedFileName}`;
};

const ensureExcalidrawFileName = (fileName: string) => {
  const trimmed = fileName.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("文件名不能为空");
  }
  return trimmed.endsWith(".excalidraw") ? trimmed : `${trimmed}.excalidraw`;
};

const getAuthHeaders = (config: WebDAVConfig) => {
  const token = btoa(`${config.username}:${config.password}`);
  return {
    Authorization: `Basic ${token}`,
  };
};

const getRequestUrl = (config: WebDAVConfig, remotePath = "") => {
  const serverUrl = normalizeServerUrl(config.serverUrl.trim());
  const path = remotePath ? remotePath : normalizeBasePath(config.basePath);
  return `${serverUrl}${path}`;
};

const parseMultiStatus = async (response: Response) => {
  const xml = await response.text();
  return new DOMParser().parseFromString(xml, "application/xml");
};

const getNodeText = (parent: Element, localName: string) => {
  const element = Array.from(parent.children).find(
    (child) => child.localName === localName,
  );
  return element?.textContent?.trim() || null;
};

const getResponseHref = (response: Element) => {
  const href = Array.from(response.children).find(
    (child) => child.localName === "href",
  )?.textContent;
  return href?.trim() || "";
};

const parseFileEntries = (doc: Document, config: WebDAVConfig) => {
  const responses = Array.from(doc.getElementsByTagNameNS("*", "response"));
  const baseDirectoryPath = normalizeBasePath(config.basePath);

  return responses
    .map((response) => {
      const href = getResponseHref(response);
      const prop = response.getElementsByTagNameNS("*", "prop")[0];
      if (!prop) {
        return null;
      }
      const resourceType = prop.getElementsByTagNameNS("*", "resourcetype")[0];
      const isCollection = !!resourceType?.getElementsByTagNameNS(
        "*",
        "collection",
      )[0];
      if (isCollection) {
        return null;
      }
      const decodedPath = decodeURIComponent(
        new URL(href, getRequestUrl(config)).pathname,
      );
      if (decodedPath === baseDirectoryPath) {
        return null;
      }
      const name = decodedPath.split("/").filter(Boolean).pop() || "";
      if (!name.endsWith(".excalidraw")) {
        return null;
      }
      const contentLength = getNodeText(prop, "getcontentlength");
      return {
        path: decodedPath,
        href,
        name,
        etag: getNodeText(prop, "getetag"),
        lastModified: getNodeText(prop, "getlastmodified"),
        size: contentLength ? Number(contentLength) : null,
      };
    })
    .filter((entry): entry is WebDAVFileEntry => !!entry)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
};

const assertOk = async (response: Response, fallbackMessage: string) => {
  if (response.ok) {
    return;
  }
  const body = await response.text().catch(() => "");
  throw new Error(body || fallbackMessage);
};

export const createEmptyExcalidrawContent = (fileName: string) => {
  const title = fileName.replace(/\.excalidraw$/, "");
  return JSON.stringify(
    {
      type: "excalidraw",
      version: 2,
      source: typeof window !== "undefined" ? window.location.origin : "",
      elements: [],
      appState: {
        name: title,
      },
      files: {},
    },
    null,
    2,
  );
};

export const validateWebDAVConfig = async (config: WebDAVConfig) => {
  const response = await fetch(getRequestUrl(config), {
    method: "PROPFIND",
    headers: {
      Depth: "0",
      ...getAuthHeaders(config),
    },
  });
  await assertOk(response, "WebDAV 登录失败");
};

export const listExcalidrawFiles = async (
  config: WebDAVConfig,
): Promise<WebDAVFileEntry[]> => {
  const response = await fetch(getRequestUrl(config), {
    method: "PROPFIND",
    headers: {
      Depth: "1",
      ...getAuthHeaders(config),
    },
  });
  await assertOk(response, "读取 WebDAV 文件列表失败");
  const doc = await parseMultiStatus(response);
  return parseFileEntries(doc, config);
};

export const downloadWebDAVFile = async (
  config: WebDAVConfig,
  remotePath: string,
) => {
  const response = await fetch(getRequestUrl(config, remotePath), {
    method: "GET",
    headers: getAuthHeaders(config),
  });
  await assertOk(response, "下载 WebDAV 文件失败");
  return response.blob();
};

export const uploadWebDAVFile = async (
  config: WebDAVConfig,
  remotePath: string,
  content: string,
) => {
  const response = await fetch(getRequestUrl(config, remotePath), {
    method: "PUT",
    headers: {
      "Content-Type": MIME_TYPES.excalidraw,
      ...getAuthHeaders(config),
    },
    body: content,
  });
  await assertOk(response, "保存 WebDAV 文件失败");
};

export const createWebDAVFile = async (
  config: WebDAVConfig,
  fileName: string,
  content: string,
) => {
  const normalizedFileName = ensureExcalidrawFileName(fileName);
  const remotePath = joinRemotePath(config.basePath, normalizedFileName);
  await uploadWebDAVFile(config, remotePath, content);
  return remotePath;
};

export const renameWebDAVFile = async (
  config: WebDAVConfig,
  remotePath: string,
  nextFileName: string,
) => {
  const normalizedFileName = ensureExcalidrawFileName(nextFileName);
  const destinationPath = joinRemotePath(config.basePath, normalizedFileName);
  const response = await fetch(getRequestUrl(config, remotePath), {
    method: "MOVE",
    headers: {
      Destination: getRequestUrl(config, destinationPath),
      Overwrite: "T",
      ...getAuthHeaders(config),
    },
  });
  await assertOk(response, "重命名 WebDAV 文件失败");
  return destinationPath;
};

export const deleteWebDAVFile = async (
  config: WebDAVConfig,
  remotePath: string,
) => {
  const response = await fetch(getRequestUrl(config, remotePath), {
    method: "DELETE",
    headers: getAuthHeaders(config),
  });
  await assertOk(response, "删除 WebDAV 文件失败");
};

export const fileNameFromRemotePath = (remotePath: string) => {
  return decodeURIComponent(
    remotePath.split("/").filter(Boolean).pop() || remotePath,
  );
};
