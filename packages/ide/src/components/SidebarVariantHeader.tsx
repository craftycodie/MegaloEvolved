import { useMemo } from "react";
import type { SourceAnalysis } from "../compile";
import { buildVariantIdentity } from "../gametype";
import { useIdeLocale, useT } from "../localization";

interface Props {
  absoluteFilePath?: string | null;
  compiledMetadata?: SourceAnalysis["compiledMetadata"];
  fileName: string | null;
  objectListNames?: readonly string[];
}

export function SidebarVariantHeader({
  fileName,
  absoluteFilePath,
  objectListNames = [],
  compiledMetadata,
}: Props) {
  const t = useT();
  const { locale } = useIdeLocale();
  const variantIdentity = useMemo(
    () =>
      buildVariantIdentity({
        fileName,
        absoluteFilePath,
        objectListNames,
        compiledMetadata,
      }),
    // `locale` re-runs the memo so localized string-table names re-resolve.
    [fileName, absoluteFilePath, objectListNames, compiledMetadata, locale]
  );

  if (!variantIdentity) {
    return (
      <div className="sidebar-variant sidebar-variant--empty">
        <div className="sidebar-variant-text">
          <p className="sidebar-variant-hint">
            {t("sidebar_variant_empty_hint")}
          </p>
        </div>
      </div>
    );
  }

  const iconUrl = variantIdentity.iconUrl;

  return (
    <div className="sidebar-variant">
      <div className="sidebar-variant-icon-slot">
        {iconUrl ? (
          <img alt="" className="sidebar-variant-icon" src={iconUrl} />
        ) : (
          <div
            className="sidebar-variant-icon-placeholder"
            title={t("sidebar_variant_no_icon")}
          >
            <span className="sidebar-variant-icon-placeholder-label">
              {t("sidebar_variant_no_icon")}
            </span>
          </div>
        )}
      </div>
      <div className="sidebar-variant-text">
        <h2 className="sidebar-variant-name">{variantIdentity.name}</h2>
        {variantIdentity.description ? (
          <p className="sidebar-variant-description">
            {variantIdentity.description}
          </p>
        ) : (
          <p className="sidebar-variant-description sidebar-variant-description--empty">
            &nbsp;
          </p>
        )}
      </div>
    </div>
  );
}
