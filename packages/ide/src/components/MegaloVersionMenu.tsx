import {
  getGameName,
  getShortDescription,
  MEGALO_VERSIONS,
  type MegaloVersionId,
} from "@megacrow/megalo";
import { createPortal } from "react-dom";
import { gameIconSrc } from "../gametype/gametypeIcons";
import { useT } from "../localization";
import { ChevronDownIcon } from "../ui/icons";
import { usePopover } from "../ui/usePopover";

const PANEL_WIDTH = 340;

/** All engine profiles from `@megacrow/megalo` (newest first). */
export const BROWSER_MEGALO_VERSIONS: readonly MegaloVersionId[] = Object.keys(
  MEGALO_VERSIONS
) as MegaloVersionId[];

interface Props {
  megaloVersion: MegaloVersionId;
  onSelectVersion: (version: MegaloVersionId) => void;
  versions?: readonly MegaloVersionId[];
}

function VersionSummary({
  id,
  layout,
}: {
  id: MegaloVersionId;
  layout: "trigger" | "item";
}) {
  const info = MEGALO_VERSIONS[id];
  const gameName = getGameName(info);
  const short = getShortDescription(info);
  if (layout === "trigger") {
    return (
      <span className="workspace-menu-label megalo-version-summary">
        <span className="megalo-version-code">{id}</span>
        <span className="megalo-version-meta">
          <img
            alt=""
            className="workspace-menu-game-icon"
            src={gameIconSrc(id)}
            title={`${gameName} — ${short}`}
          />
          <span className="megalo-version-game">{gameName}</span>
          <span className="megalo-version-short">{short}</span>
        </span>
      </span>
    );
  }
  return (
    <span className="workspace-menu-item-title megalo-version-item">
      <span className="megalo-version-code">{id}</span>
      <span className="megalo-version-meta">
        <img
          alt=""
          className="workspace-menu-game-icon"
          src={gameIconSrc(id)}
        />
        <span className="megalo-version-game">{gameName}</span>
        <span className="megalo-version-short">{short}</span>
      </span>
    </span>
  );
}

export function MegaloVersionMenu({
  megaloVersion,
  onSelectVersion,
  versions = BROWSER_MEGALO_VERSIONS,
}: Props) {
  const t = useT();
  const popover = usePopover({ kind: "menu", panelWidth: PANEL_WIDTH });
  const { open, panelPos, panelRef, rootRef, triggerRef } = popover;

  return (
    <div className="workspace-menu" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="workspace-menu-trigger"
        onClick={popover.toggle}
        ref={triggerRef}
        title={t("megalo_version_select_title")}
        type="button"
      >
        <VersionSummary id={megaloVersion} layout="trigger" />
        <ChevronDownIcon className="workspace-menu-chevron" />
      </button>

      {open
        ? createPortal(
            <div
              aria-label={t("megalo_version_aria_label")}
              className="workspace-menu-panel"
              onKeyDown={popover.onPanelKeyDown}
              ref={panelRef}
              role="menu"
              style={{
                top: panelPos.top,
                left: panelPos.left,
                width: PANEL_WIDTH,
              }}
            >
              <div className="workspace-menu-table">
                <div className="workspace-menu-columns">
                  <span className="workspace-menu-columns-label">
                    <span>{t("megalo_version_title")}</span>
                  </span>
                </div>
                <ul className="workspace-menu-list" role="none">
                  {versions.map((id) => {
                    const selected = megaloVersion === id;
                    return (
                      <li
                        className={`workspace-menu-row${selected ? " workspace-menu-row--active" : ""}`}
                        key={id}
                        role="none"
                      >
                        <button
                          aria-checked={selected}
                          className={`workspace-menu-item${selected ? " workspace-menu-item--active" : ""}`}
                          onClick={() => {
                            onSelectVersion(id);
                            popover.close();
                          }}
                          role="menuitemradio"
                          type="button"
                        >
                          {selected ? (
                            <span className="workspace-menu-item-active-label">
                              {t("workspace_active")}
                            </span>
                          ) : null}
                          <VersionSummary id={id} layout="item" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
