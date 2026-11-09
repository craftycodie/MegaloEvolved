import type { VariantLimitItem, VariantLimitUsage } from "@megacrow/megalo";
import { createPortal } from "react-dom";
import {
  buildVariantLimitSections,
  exceededLimits,
  formatLimitValue,
  formatVariantBytes,
  variantCapacityLevel,
  variantMeterLevel,
} from "../gametype";
import { useIdeLocale, useT, useTPlural } from "../localization";
import { usePopover } from "../ui/usePopover";

const PANEL_WIDTH = 360;
const PANEL_MAX_HEIGHT = 520;

function LimitRow({ item }: { item: VariantLimitItem }) {
  const { locale } = useIdeLocale();
  const level = variantCapacityLevel(item.used, item.max);
  const fillPercent =
    item.max > 0 ? Math.min(100, (item.used / item.max) * 100) : 0;

  return (
    <div className={`variant-limit-row variant-limit-row--${level}`}>
      <div className="variant-limit-row-head">
        <span className="variant-limit-row-label">{item.label}</span>
        <span className="variant-limit-row-value">
          {formatLimitValue(item, locale)}
        </span>
      </div>
      <div aria-hidden className="variant-limit-row-track">
        <div
          className="variant-limit-row-fill"
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </div>
  );
}

interface Props {
  capacityBytes: number;
  limitUsage: VariantLimitUsage | null;
  usedBytes: number | null;
}

export function VariantCapacityMeter({
  usedBytes,
  capacityBytes,
  limitUsage,
}: Props) {
  const t = useT();
  const tPlural = useTPlural();
  const popover = usePopover({
    kind: "panel",
    panelWidth: PANEL_WIDTH,
    direction: "up",
    offsetY: 6,
    alignRight: true,
  });
  const { open, panelPos, panelRef, rootRef, triggerRef } = popover;

  if (usedBytes === null) {
    return null;
  }

  const percent = Math.round((usedBytes / capacityBytes) * 100);
  const fillPercent = Math.min(100, (usedBytes / capacityBytes) * 100);
  const over = usedBytes > capacityBytes;

  const items = (limitUsage?.items ?? [])
    .filter((item: VariantLimitItem) => item.max > 0)
    .map((item: VariantLimitItem) =>
      item.id === "storage"
        ? { ...item, label: t("variant_encoded_size") }
        : item
    );
  const fallbackItems: VariantLimitItem[] =
    items.length > 0
      ? items
      : [
          {
            id: "storage",
            label: t("variant_encoded_size"),
            used: usedBytes,
            max: capacityBytes,
            section: "storage",
            format: "bytes",
          },
        ];

  const sections = buildVariantLimitSections(fallbackItems, t);
  const level = variantMeterLevel(usedBytes, capacityBytes, fallbackItems);
  const exceeded = exceededLimits(fallbackItems).length;
  const exceededText =
    exceeded > 0 ? tPlural("variant_limits_exceeded", exceeded) : null;

  return (
    <div className="variant-capacity-root" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={[t("variant_storage_aria", { percent }), exceededText]
          .filter(Boolean)
          .join(" ")}
        className={`variant-capacity variant-capacity--${level}`}
        onClick={popover.toggle}
        ref={triggerRef}
        title={
          exceededText
            ? `${exceededText}. ${t("variant_show_limits")}`
            : t("variant_show_limits")
        }
        type="button"
      >
        <div aria-hidden className="variant-capacity-track">
          <div
            className="variant-capacity-fill"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <span className="variant-capacity-label">
          {formatVariantBytes(usedBytes)} / {formatVariantBytes(capacityBytes)}
          {over ? " +" : ""}
        </span>
      </button>
      {open
        ? createPortal(
            <div
              aria-label={t("variant_limits_aria")}
              className="variant-limits-popover"
              ref={panelRef}
              role="dialog"
              style={{
                bottom: panelPos.bottom,
                left: panelPos.left,
                width: PANEL_WIDTH,
                maxHeight: PANEL_MAX_HEIGHT,
              }}
            >
              <div className="variant-limits-popover-title">
                {t("variant_limits_title")}
              </div>
              <div className="variant-limits-body">
                {sections.map((section) => (
                  <section
                    className={`variant-limits-section${
                      section.kind === "variables"
                        ? " variant-limits-section--variables"
                        : ""
                    }`}
                    key={section.id}
                  >
                    <h3 className="variant-limits-section-title">
                      {section.title}
                    </h3>
                    <div
                      className={
                        section.kind === "variables"
                          ? "variant-limits-rows variant-limits-rows--compact"
                          : "variant-limits-rows"
                      }
                    >
                      {section.items.map((item) => (
                        <LimitRow item={item} key={item.id} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
