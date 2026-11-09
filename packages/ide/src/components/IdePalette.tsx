import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getMonacoCommandPaletteEntries,
  getSourceFileQuickOpenEntries,
  type IdePaletteCommand,
  type IdePaletteMode,
  type SourceFileQuickOpenEntry,
} from "../editor";
import { useT } from "../localization";
import { Dialog } from "../ui/Dialog";

interface Props {
  mode: IdePaletteMode;
  onClose: () => void;
  open: boolean;
}

type PaletteItem =
  | { kind: "file"; entry: SourceFileQuickOpenEntry }
  | { kind: "command"; entry: IdePaletteCommand };

function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return items;
  }
  return items.filter((item) => {
    const label = item.entry.label.toLowerCase();
    const description = item.entry.description?.toLowerCase() ?? "";
    return label.includes(q) || description.includes(q);
  });
}

export function IdePalette({ open, mode, onClose }: Props) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [commands, setCommands] = useState<IdePaletteCommand[]>([]);
  const [commandsLoading, setCommandsLoading] = useState(false);
  /** Quick-open file list, read when the palette opens. */
  const [fileEntries, setFileEntries] = useState(() =>
    getSourceFileQuickOpenEntries()
  );

  const isCommands = query.startsWith(">");
  const filterQuery = isCommands ? query.slice(1) : query;

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery(mode === "commands" ? ">" : "");
    setActiveIndex(0);
    setFileEntries(getSourceFileQuickOpenEntries());
  }, [open, mode]);

  useEffect(() => {
    if (!(open && isCommands)) {
      return;
    }
    let cancelled = false;
    setCommandsLoading(true);
    void getMonacoCommandPaletteEntries().then((next) => {
      if (cancelled) {
        return;
      }
      setCommands(next);
      setCommandsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, isCommands]);

  const items = useMemo((): PaletteItem[] => {
    if (isCommands) {
      return commands.map((entry) => ({ kind: "command" as const, entry }));
    }
    return fileEntries.map((entry) => ({
      kind: "file" as const,
      entry,
    }));
  }, [isCommands, commands, fileEntries]);

  const filtered = useMemo(
    () => filterItems(items, filterQuery),
    [items, filterQuery]
  );

  // Keep the highlighted row visible while arrowing through a long list.
  useEffect(() => {
    document
      .getElementById(`${listId}-option-${activeIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, listId]);

  const accept = useCallback(
    async (item: PaletteItem | undefined) => {
      if (!item) {
        return;
      }
      onClose();
      if (item.kind === "command") {
        await item.entry.run();
        return;
      }
      await item.entry.open();
    },
    [onClose]
  );

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) =>
        filtered.length === 0 ? 0 : Math.min(i + 1, filtered.length - 1)
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void accept(filtered[activeIndex]);
    }
  };

  const placeholder = isCommands
    ? commandsLoading
      ? t("palette_placeholder_loading")
      : commands.length === 0
        ? t("palette_placeholder_no_editor")
        : t("palette_placeholder_commands")
    : t("palette_placeholder_files");

  const emptyLabel = isCommands
    ? commandsLoading
      ? t("palette_empty_loading")
      : commands.length === 0
        ? t("palette_empty_no_editor")
        : t("palette_empty_no_commands")
    : t("palette_empty_no_files");

  return (
    <Dialog
      aria-label={
        isCommands ? t("palette_command_aria") : t("palette_goto_file_aria")
      }
      className="ide-palette-dialog"
      initialFocusRef={inputRef}
      onClose={onClose}
      open={open}
    >
      <input
        aria-activedescendant={
          filtered[activeIndex] ? `${listId}-option-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded="true"
        className="ide-palette-input"
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={onInputKeyDown}
        placeholder={placeholder}
        ref={inputRef}
        role="combobox"
        spellCheck={false}
        value={query}
      />
      <div className="ide-palette-list" id={listId} role="listbox">
        {filtered.length === 0 ? (
          <div className="ide-palette-empty" role="presentation">
            {emptyLabel}
          </div>
        ) : (
          filtered.map((item, index) => (
            <div
              aria-selected={index === activeIndex}
              className={
                index === activeIndex
                  ? "ide-palette-item ide-palette-item--active"
                  : "ide-palette-item"
              }
              id={`${listId}-option-${index}`}
              key={`${item.kind}:${item.entry.id}:${index}`}
              onMouseDown={(event) => {
                event.preventDefault();
                void accept(item);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              // Focus stays in the input (aria-activedescendant); -1 only
              // makes options focusable for assistive tech.
              tabIndex={-1}
            >
              <span className="ide-palette-item-label">{item.entry.label}</span>
              {item.entry.description ? (
                <span className="ide-palette-item-description">
                  {item.entry.description}
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}
