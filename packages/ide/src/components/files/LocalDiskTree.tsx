import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { formatLocalDiskPath, type LocalDiskNode, pathKey } from "../../files";
import {
  isObjectListsDirectoryName,
  isObjectListsPath,
  isRecognizedObjectListName,
} from "../../gametype";
import { useT } from "../../localization";
import { FilesRenameInput } from "./FilesRenameInput";
import { flattenVisibleNodes, parsePathKey, treeKeyAction } from "./treeUtils";
import { useLocalDiskTreeDragDrop } from "./useLocalDiskTreeDragDrop";
import { useLocalDiskTreeSelection } from "./useLocalDiskTreeSelection";

interface Props {
  activeFileName: string | null;
  ensureExpandedKeys?: readonly string[];
  nodes: LocalDiskNode[];
  objectListNames?: readonly string[];
  onBeginRename: (path: string[]) => void;
  onCancelRename: () => void;
  onCommitRename: (path: string[], newName: string) => void;
  onContextMenu: (
    event: ReactMouseEvent,
    target: { type: "file" | "directory"; path: string[]; virtual?: boolean },
    selectedTargets: Array<{
      type: "file" | "directory";
      path: string[];
      virtual?: boolean;
    }>
  ) => void;
  /** Omit to turn off drag-and-drop moves for this tree. */
  onMoveEntries?: (fromPaths: string[][], toParentPath: string[]) => void;
  onOpenFile: (path: string[]) => void;
  onRegenerateObjectLists?: () => void;
  renamingPathKey: string | null;
  /** Accessible name of the tree. */
  treeLabel: string;
}

function FileGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="files-glyph files-glyph--source"
      viewBox="0 0 16 16"
    >
      <path
        d="M3.5 1.5h6l3 3V14.5h-9z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
      <path
        d="M9.5 1.5V4.5H12.5"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
      <path
        d="M5.5 7.5h5M5.5 9.5h5M5.5 11.5h3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.1"
      />
    </svg>
  );
}

function FolderGlyph({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" className="files-glyph" viewBox="0 0 16 16">
      {open ? (
        <path
          d="M1.5 4.5h4l1.2 1.2H14.5v7.3H1.5z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.2"
        />
      ) : (
        <path
          d="M1.5 3.5h4l1.2 1.2H14.5v8.3H1.5z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.2"
        />
      )}
    </svg>
  );
}

function ObjectListsFolderGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="files-glyph files-glyph--object-lists"
      viewBox="0 0 16 16"
    >
      <path
        d="M1.5 3.5h4l1.2 1.2H14.5v8.3H1.5z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
      <path
        d="M4 8h8M4 10.25h8M4 12.5h5.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.1"
      />
    </svg>
  );
}

function ObjectListFileGlyph({ virtual = false }: { virtual?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`files-glyph files-glyph--object-list-file${virtual ? " files-glyph--virtual" : " files-glyph--filled"}`}
      viewBox="0 0 16 16"
    >
      <path
        className="files-glyph-body"
        d="M3.5 1.5h6l3 3V14.5h-9z"
        fill={virtual ? "none" : "currentColor"}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
      <path
        className="files-glyph-fold"
        d="M9.5 1.5V4.5H12.5"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
      <path
        className="files-glyph-detail"
        d="M5.25 8h5.5M5.25 10.25h5.5M5.25 12.5h3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.1"
      />
    </svg>
  );
}

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`files-chevron${open ? " files-chevron--open" : ""}`}
      height="12"
      viewBox="0 0 16 16"
      width="12"
    >
      <path
        d="M6 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function TreeNode({
  node,
  depth,
  activeFileName,
  dragOverKey,
  draggingKeys,
  expandedPaths,
  objectListNames,
  onRegenerateObjectLists,
  renamingPathKey,
  selectedKeys,
  tabStopKey,
  onPointerDownRow,
  onRowActivate,
  onToggleDirectory,
  onOpenFile,
  onBeginRename,
  onCommitRename,
  onCancelRename,
  onContextMenu,
}: {
  node: LocalDiskNode;
  depth: number;
  activeFileName: string | null;
  dragOverKey: string | null;
  draggingKeys: Set<string>;
  expandedPaths: Set<string>;
  objectListNames: readonly string[];
  onRegenerateObjectLists?: () => void;
  renamingPathKey: string | null;
  selectedKeys: ReadonlySet<string>;
  /** The one row reachable with Tab (roving tab stop). */
  tabStopKey: string | null;
  onPointerDownRow?: (
    event: React.PointerEvent<HTMLDivElement>,
    node: LocalDiskNode
  ) => void;
  onRowActivate: (
    event: ReactMouseEvent<HTMLDivElement>,
    node: LocalDiskNode
  ) => boolean;
  onToggleDirectory: (path: string[]) => void;
  onOpenFile: (path: string[]) => void;
  onBeginRename: (path: string[]) => void;
  onCommitRename: (path: string[], newName: string) => void;
  onCancelRename: () => void;
  onContextMenu: (
    event: ReactMouseEvent,
    target: { type: "file" | "directory"; path: string[]; virtual?: boolean }
  ) => void;
}) {
  const t = useT();
  const displayPath = formatLocalDiskPath(node.path);
  const nodeKey = pathKey(node.path);
  const isExpanded = expandedPaths.has(nodeKey);
  const isRenaming = renamingPathKey === nodeKey;
  const isDragging = draggingKeys.has(nodeKey);
  const isSelected = selectedKeys.has(nodeKey);
  const isDropTarget = dragOverKey === nodeKey && !isDragging;
  const indent = { "--files-depth": String(depth) } as CSSProperties;

  if (node.type === "file") {
    const isActive =
      activeFileName !== null &&
      activeFileName.localeCompare(displayPath, undefined, {
        sensitivity: "accent",
      }) === 0;
    const recognizedObjectList =
      isObjectListsPath(node.path) &&
      isRecognizedObjectListName(node.name, objectListNames);
    const isVirtual = node.virtual === true;

    return (
      <li className="files-tree-node" role="none">
        {isRenaming ? (
          <div
            className={`files-row-btn files-row-btn--renaming${isActive ? " files-row-btn--active" : ""}${isSelected ? " files-row-btn--selected" : ""}${recognizedObjectList ? " files-row-btn--object-list-file" : ""}${isVirtual ? " files-row-btn--virtual" : ""}`}
            style={indent}
          >
            <span aria-hidden="true" className="files-chevron-spacer" />
            {recognizedObjectList ? (
              <ObjectListFileGlyph virtual={isVirtual} />
            ) : (
              <FileGlyph />
            )}
            <FilesRenameInput
              initialName={node.name}
              onCancel={onCancelRename}
              onCommit={(value) => onCommitRename(node.path, value)}
            />
          </div>
        ) : (
          <div
            aria-level={depth + 1}
            aria-selected={isSelected}
            className={`files-row-btn${isActive ? " files-row-btn--active" : ""}${isSelected ? " files-row-btn--selected" : ""}${recognizedObjectList ? " files-row-btn--object-list-file" : ""}${isVirtual ? " files-row-btn--virtual" : ""}${isDragging ? " files-row-btn--dragging" : ""}${isDropTarget ? " files-row-btn--drop-target" : ""}`}
            data-tree-drop="file"
            data-tree-path={nodeKey}
            onClick={(event) => {
              if (onRowActivate(event, node)) {
                onOpenFile(node.path);
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onContextMenu(event, {
                type: "file",
                path: node.path,
                virtual: isVirtual,
              });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenFile(node.path);
              } else if (event.key === "F2" && !isVirtual) {
                event.preventDefault();
                onBeginRename(node.path);
              }
            }}
            onPointerDown={
              isVirtual || !onPointerDownRow
                ? undefined
                : (event) => onPointerDownRow(event, node)
            }
            role="treeitem"
            style={indent}
            tabIndex={nodeKey === tabStopKey ? 0 : -1}
            title={
              isVirtual
                ? t("files_virtual_file_tooltip", { path: displayPath })
                : displayPath
            }
          >
            <span aria-hidden="true" className="files-chevron-spacer" />
            {recognizedObjectList ? (
              <ObjectListFileGlyph virtual={isVirtual} />
            ) : (
              <FileGlyph />
            )}
            <span className="files-row-label">{node.name}</span>
          </div>
        )}
      </li>
    );
  }

  const isObjectLists = isObjectListsDirectoryName(node.name);

  return (
    <li className="files-tree-node files-tree-node--branch" role="none">
      {isRenaming ? (
        <div
          className={`files-row-btn files-row-btn--folder files-row-btn--renaming${isSelected ? " files-row-btn--selected" : ""}${isObjectLists ? " files-row-btn--object-lists" : ""}`}
          style={indent}
        >
          <span aria-hidden="true" className="files-chevron-spacer" />
          {isObjectLists ? (
            <ObjectListsFolderGlyph />
          ) : (
            <FolderGlyph open={isExpanded} />
          )}
          <FilesRenameInput
            initialName={node.name}
            onCancel={onCancelRename}
            onCommit={(value) => onCommitRename(node.path, value)}
          />
        </div>
      ) : (
        <div
          aria-expanded={isExpanded}
          aria-level={depth + 1}
          aria-selected={isSelected}
          className={`files-row-btn files-row-btn--folder${isObjectLists ? " files-row-btn--object-lists" : ""}${isSelected ? " files-row-btn--selected" : ""}${isDragging ? " files-row-btn--dragging" : ""}${isDropTarget ? " files-row-btn--drop-target" : ""}`}
          data-tree-drop="directory"
          data-tree-path={nodeKey}
          onClick={(event) => {
            if (onRowActivate(event, node)) {
              onToggleDirectory(node.path);
            }
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            onContextMenu(event, { type: "directory", path: node.path });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggleDirectory(node.path);
            } else if (event.key === "F2") {
              event.preventDefault();
              onBeginRename(node.path);
            }
          }}
          onPointerDown={
            onPointerDownRow
              ? (event) => onPointerDownRow(event, node)
              : undefined
          }
          role="treeitem"
          style={indent}
          tabIndex={nodeKey === tabStopKey ? 0 : -1}
          title={displayPath}
        >
          <ChevronGlyph open={isExpanded} />
          {isObjectLists ? (
            <ObjectListsFolderGlyph />
          ) : (
            <FolderGlyph open={isExpanded} />
          )}
          <span className="files-row-label">{node.name}</span>
          {isObjectLists && onRegenerateObjectLists ? (
            <button
              aria-label={t("files_regenerate_object_lists")}
              className="files-row-regenerate"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRegenerateObjectLists();
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              title={t("files_regenerate_object_lists_tooltip")}
              type="button"
            >
              {t("files_regenerate_object_lists")}
            </button>
          ) : null}
        </div>
      )}
      {isExpanded && node.children && node.children.length > 0 ? (
        // biome-ignore lint/a11y/useSemanticElements: WAI-ARIA tree pattern: a folder's children are a group.
        <ul
          className={`files-tree${isDropTarget ? " files-tree--drop-target" : ""}`}
          data-tree-drop="directory"
          data-tree-path={nodeKey}
          role="group"
        >
          {node.children.map((child) => (
            <TreeNode
              activeFileName={activeFileName}
              depth={depth + 1}
              draggingKeys={draggingKeys}
              dragOverKey={dragOverKey}
              expandedPaths={expandedPaths}
              key={pathKey(child.path)}
              node={child}
              objectListNames={objectListNames}
              onBeginRename={onBeginRename}
              onCancelRename={onCancelRename}
              onCommitRename={onCommitRename}
              onContextMenu={onContextMenu}
              onOpenFile={onOpenFile}
              onPointerDownRow={onPointerDownRow}
              onRegenerateObjectLists={onRegenerateObjectLists}
              onRowActivate={onRowActivate}
              onToggleDirectory={onToggleDirectory}
              renamingPathKey={renamingPathKey}
              selectedKeys={selectedKeys}
              tabStopKey={tabStopKey}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

const noMove = () => undefined;

export function LocalDiskTree({
  nodes,
  activeFileName,
  objectListNames = [],
  onOpenFile,
  onRegenerateObjectLists,
  renamingPathKey,
  onBeginRename,
  onCommitRename,
  onCancelRename,
  onContextMenu,
  onMoveEntries,
  ensureExpandedKeys = [],
  treeLabel,
}: Props) {
  const suppressClickRef = useRef(false);

  const selection = useLocalDiskTreeSelection({
    activeFileName,
    ensureExpandedKeys,
    nodes,
    onOpenFile,
    suppressClickRef,
  });

  const dragDrop = useLocalDiskTreeDragDrop({
    clearSelection: selection.clearSelection,
    expandedPaths: selection.expandedPaths,
    nodes,
    onMoveEntries: onMoveEntries ?? noMove,
    renamingPathKey,
    selectedKeysRef: selection.selectedKeysRef,
    suppressClickRef,
  });

  const handleContextMenu = useCallback(
    (
      event: ReactMouseEvent,
      target: { type: "file" | "directory"; path: string[]; virtual?: boolean }
    ) => {
      const key = pathKey(target.path);
      let paths = selection.resolveSelectedPaths(key, [target.path]);
      if (
        !selection.selectedKeysRef.current.has(key) ||
        selection.selectedKeysRef.current.size <= 1
      ) {
        selection.selectSingleKey(key);
        paths = [target.path];
      }
      const visible = flattenVisibleNodes(nodes, selection.expandedPaths);
      const byKey = new Map(
        visible.map((entry) => [pathKey(entry.path), entry] as const)
      );
      const selectedTargets = paths.map((path) => {
        const entry = byKey.get(pathKey(path));
        if (entry) {
          return {
            type: entry.type,
            path: entry.path,
            virtual: entry.virtual,
          };
        }
        if (
          path.length === target.path.length &&
          path.every((segment, index) => segment === target.path[index])
        ) {
          return target;
        }
        return { type: "file" as const, path };
      });
      onContextMenu(event, target, selectedTargets);
    },
    [nodes, onContextMenu, selection]
  );

  // Roving tab stop: the last focused row, else the selected one, else the
  // first row. Arrow keys move between rows (see treeKeyAction).
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const visibleKeys = flattenVisibleNodes(nodes, selection.expandedPaths).map(
    (node) => pathKey(node.path)
  );
  const firstSelectedKey = visibleKeys.find((key) =>
    selection.selectedKeys.has(key)
  );
  const tabStopKey =
    focusKey !== null && visibleKeys.includes(focusKey)
      ? focusKey
      : (firstSelectedKey ?? visibleKeys[0] ?? null);

  const handleTreeKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const row = event.target.closest<HTMLElement>('[role="treeitem"]');
    const currentKey = row?.dataset.treePath;
    if (currentKey === undefined) {
      return;
    }
    const action = treeKeyAction(
      event.key,
      currentKey,
      nodes,
      selection.expandedPaths
    );
    if (!action) {
      return;
    }
    event.preventDefault();
    if (action.toggle !== undefined) {
      selection.onToggleDirectory(parsePathKey(action.toggle));
    }
    if (action.focus !== undefined) {
      setFocusKey(action.focus);
      const rows =
        event.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]');
      for (const candidate of rows) {
        if (candidate.dataset.treePath === action.focus) {
          candidate.focus();
          break;
        }
      }
    }
  };

  return (
    <ul
      aria-label={treeLabel}
      aria-multiselectable="true"
      className={`files-tree${dragDrop.dragOverKey === dragDrop.rootDropKey ? " files-tree--drop-target" : ""}${dragDrop.draggingKeys.size > 0 ? " files-tree--dragging" : ""}`}
      data-tree-root=""
      onFocus={(event) => {
        const key =
          event.target instanceof HTMLElement
            ? event.target.dataset.treePath
            : undefined;
        if (
          key !== undefined &&
          event.target.getAttribute("role") === "treeitem"
        ) {
          setFocusKey(key);
        }
      }}
      onKeyDown={handleTreeKeyDown}
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA tree pattern on the <ul> that holds the rows.
      role="tree"
    >
      {nodes.map((node) => (
        <TreeNode
          activeFileName={activeFileName}
          depth={0}
          draggingKeys={dragDrop.draggingKeys}
          dragOverKey={dragDrop.dragOverKey}
          expandedPaths={selection.expandedPaths}
          key={pathKey(node.path)}
          node={node}
          objectListNames={objectListNames}
          onBeginRename={onBeginRename}
          onCancelRename={onCancelRename}
          onCommitRename={onCommitRename}
          onContextMenu={handleContextMenu}
          onOpenFile={selection.onOpenFileGuarded}
          onPointerDownRow={
            onMoveEntries ? dragDrop.onPointerDownRow : undefined
          }
          onRegenerateObjectLists={onRegenerateObjectLists}
          onRowActivate={selection.onRowActivate}
          onToggleDirectory={selection.onToggleDirectory}
          renamingPathKey={renamingPathKey}
          selectedKeys={selection.selectedKeys}
          tabStopKey={tabStopKey}
        />
      ))}
    </ul>
  );
}
