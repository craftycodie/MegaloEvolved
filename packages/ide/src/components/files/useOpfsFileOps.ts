import type { MegaloVersionId } from "@megacrow/megalo";
import {
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { MegaloIncludeRoot } from "../../compile";
import { writeClipboardText } from "../../desktop";
import {
  createOpfsGametype,
  deleteOpfsGametype,
  duplicateOpfsGametype,
  type FileClipboardPayload,
  formatLocalDiskPath,
  type LocalDiskNode,
  opfsGametypeLogicalPath,
  pathKey,
  readOpfsGametypeSource,
  readTextFileBlob,
  renameOpfsGametype,
} from "../../files";
import { isObjectListsPath } from "../../gametype";
import { translateDiskError, useT } from "../../localization";
import {
  defaultObjectListText,
  findLocalDiskNode,
  withObjectListsFolder,
} from "../../workspace";
import type { FilesContextMenuState } from "./useFilesPanelContextMenu";
import { useOpfsFiles } from "./useOpfsFiles";

interface Options {
  megaloVersion: MegaloVersionId;
  objectListNames: readonly string[];
  onFileDeleted: (name: string) => void;
  onFileRenamed: (
    oldName: string,
    newName: string,
    absoluteFilePath: string
  ) => void;
  onOpenSource: (
    source: string,
    name: string,
    includeRoot?: MegaloIncludeRoot
  ) => void;
  opfsRevision: number;
  setEnsureExpandedKeys: Dispatch<SetStateAction<string[]>>;
  setRenamingPathKey: (key: string | null) => void;
  tauriAvailable: boolean;
}

export function useOpfsFileOps({
  opfsRevision,
  objectListNames,
  megaloVersion,
  onOpenSource,
  onFileDeleted,
  onFileRenamed,
  tauriAvailable,
  setEnsureExpandedKeys,
  setRenamingPathKey,
}: Options) {
  const t = useT();
  const { opfsAvailable, opfsError, opfsFiles, refreshOpfs, setOpfsError } =
    useOpfsFiles(opfsRevision);
  const [dragActive, setDragActive] = useState(false);

  const browserTree = useMemo(() => {
    if (!opfsAvailable) {
      return [];
    }
    const opfsNodes: LocalDiskNode[] = opfsFiles.map((entry) => ({
      type: "file" as const,
      name: entry.name,
      path: [entry.name],
    }));
    if (objectListNames.length === 0) {
      return opfsNodes;
    }
    return withObjectListsFolder(opfsNodes, objectListNames).nodes;
  }, [objectListNames, opfsAvailable, opfsFiles]);

  useEffect(() => {
    if (!(opfsAvailable && objectListNames.length > 0)) {
      return;
    }
    setEnsureExpandedKeys((keys) =>
      keys.includes("object_lists") ? keys : [...keys, "object_lists"]
    );
  }, [objectListNames.length, opfsAvailable, setEnsureExpandedKeys]);

  const rejectBrowserMegaloSource = useCallback(
    (name: string): boolean => {
      if (tauriAvailable || !name.toLowerCase().endsWith(".txt")) {
        return false;
      }
      setOpfsError(t("files_browser_txt_desktop_only"));
      return true;
    },
    [t, tauriAvailable, setOpfsError]
  );

  const openOpfsFile = useCallback(
    async (name: string) => {
      try {
        setOpfsError(null);
        const source = (await readOpfsGametypeSource(name)) ?? "";
        onOpenSource(source, name);
      } catch (error) {
        setOpfsError(translateDiskError(error));
      }
    },
    [onOpenSource, setOpfsError]
  );

  const openBrowserTreeFile = useCallback(
    (path: string[]) => {
      const node = findLocalDiskNode(browserTree, path);
      if (!(node && node.type === "file")) {
        return;
      }
      if (node.virtual || isObjectListsPath(path)) {
        const text = defaultObjectListText(node.name, megaloVersion);
        onOpenSource(text, formatLocalDiskPath(path));
        return;
      }
      void openOpfsFile(node.name);
    },
    [browserTree, megaloVersion, onOpenSource, openOpfsFile]
  );

  const openDroppedFile = useCallback(
    async (file: File) => {
      if (rejectBrowserMegaloSource(file.name)) {
        return;
      }
      try {
        setOpfsError(null);
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".bin") || lower.endsWith(".blf")) {
          setOpfsError(t("files_compiled_open_unsupported"));
          return;
        }
        if (lower.endsWith(".txt")) {
          const text = await readTextFileBlob(file);
          onOpenSource(text, file.name);
          return;
        }
        setOpfsError(t("files_unsupported_file_type", { name: file.name }));
      } catch (error) {
        setOpfsError(translateDiskError(error));
      }
    },
    [onOpenSource, rejectBrowserMegaloSource, setOpfsError, t]
  );

  const handleDroppedFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) {
        return;
      }
      void openDroppedFile(file);
    },
    [openDroppedFile]
  );

  const createOpfsFile = useCallback(async () => {
    try {
      setOpfsError(null);
      const name = await createOpfsGametype();
      await refreshOpfs();
      setRenamingPathKey(pathKey([name]));
      const source = (await readOpfsGametypeSource(name)) ?? "";
      onOpenSource(source, name);
    } catch (error) {
      setOpfsError(translateDiskError(error));
    }
  }, [onOpenSource, refreshOpfs, setOpfsError, setRenamingPathKey]);

  const commitOpfsRename = useCallback(
    async (fromName: string, newName: string) => {
      try {
        setOpfsError(null);
        const toName = await renameOpfsGametype(fromName, newName);
        setRenamingPathKey(null);
        await refreshOpfs();
        if (
          fromName.localeCompare(toName, undefined, {
            sensitivity: "accent",
          }) !== 0
        ) {
          onFileRenamed(fromName, toName, opfsGametypeLogicalPath(toName));
        }
      } catch (error) {
        setOpfsError(translateDiskError(error));
        setRenamingPathKey(null);
      }
    },
    [onFileRenamed, refreshOpfs, setOpfsError, setRenamingPathKey]
  );

  const deleteOpfsFile = useCallback(
    async (name: string) => {
      try {
        setOpfsError(null);
        await deleteOpfsGametype(name);
        setRenamingPathKey(null);
        await refreshOpfs();
        onFileDeleted(name);
      } catch (error) {
        setOpfsError(translateDiskError(error));
      }
    },
    [onFileDeleted, refreshOpfs, setOpfsError, setRenamingPathKey]
  );

  const copyOpfsPath = useCallback(
    async (name: string) => {
      try {
        setOpfsError(null);
        await writeClipboardText(opfsGametypeLogicalPath(name));
      } catch (error) {
        setOpfsError(translateDiskError(error));
      }
    },
    [setOpfsError]
  );

  const pasteOpfsFile = useCallback(
    async (payload: FileClipboardPayload) => {
      if (payload.source !== "opfs") {
        return;
      }
      try {
        setOpfsError(null);
        const name = await duplicateOpfsGametype(payload.name);
        await refreshOpfs();
        await openOpfsFile(name);
      } catch (error) {
        setOpfsError(translateDiskError(error));
      }
    },
    [openOpfsFile, refreshOpfs, setOpfsError]
  );

  const onOpfsContextMenu = useCallback(
    (event: MouseEvent, name: string): FilesContextMenuState => {
      event.preventDefault();
      return {
        x: event.clientX,
        y: event.clientY,
        source: "opfs",
        target: { type: "file", path: [name] },
      };
    },
    []
  );

  return {
    browserTree,
    commitOpfsRename,
    copyOpfsPath,
    deleteOpfsFile,
    createOpfsFile,
    dragActive,
    handleDroppedFiles,
    onOpfsContextMenu,
    openBrowserTreeFile,
    opfsAvailable,
    opfsError,
    opfsFiles,
    pasteOpfsFile,
    setDragActive,
    setOpfsError,
  };
}
