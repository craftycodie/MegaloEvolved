import type { VariantLimitItem } from "@megacrow/megalo";
import type { IdeMessageKey, Translate } from "../localization";
import { formatVariantBytes } from "./variantCapacity";

const VARIABLE_SCOPE_ORDER = [
  "Global",
  "Player",
  "Team",
  "Object",
  "Temporary",
] as const;

const SCOPE_LABEL_KEYS: Record<
  (typeof VARIABLE_SCOPE_ORDER)[number] | "Other",
  IdeMessageKey
> = {
  Global: "variant_scope_global",
  Player: "variant_scope_player",
  Team: "variant_scope_team",
  Object: "variant_scope_object",
  Temporary: "variant_scope_temporary",
  Other: "variant_scope_other",
};

export type VariantLimitSection =
  | {
      id: string;
      items: VariantLimitItem[];
      kind: "meters";
      title: string;
    }
  | {
      id: string;
      items: VariantLimitItem[];
      kind: "variables";
      title: string;
    };

/** "used / max", with byte sizes or counts formatted for `locale`. */
export function formatLimitValue(
  item: VariantLimitItem,
  locale: string
): string {
  if (item.format === "bytes") {
    return `${formatVariantBytes(item.used)} / ${formatVariantBytes(item.max)}`;
  }
  return `${item.used.toLocaleString(locale)} / ${item.max.toLocaleString(locale)}`;
}

function splitVariableLabel(label: string): { scope: string; type: string } {
  const match = /^(\S+)\s+(.+)$/.exec(label);
  return {
    scope: match?.[1] ?? "Other",
    type: match?.[2] ?? label,
  };
}

function localizeScope(scope: string, t: Translate): string {
  const key = SCOPE_LABEL_KEYS[scope as keyof typeof SCOPE_LABEL_KEYS];
  return key ? t(key) : scope;
}

/**
 * Group a variant's limit usage into the capacity popover's sections:
 * storage, script, strings, variables per scope, then declarations.
 */
export function buildVariantLimitSections(
  items: VariantLimitItem[],
  t: Translate
): VariantLimitSection[] {
  const bySection = {
    storage: items.filter((item) => item.section === "storage"),
    script: items.filter((item) => item.section === "script"),
    strings: items.filter((item) => item.section === "strings"),
    variables: items.filter((item) => item.section === "variables"),
    declarations: items.filter((item) => item.section === "declarations"),
  };

  const sections: VariantLimitSection[] = [];

  if (bySection.storage.length > 0) {
    sections.push({
      id: "storage",
      kind: "meters",
      title: t("variant_section_storage"),
      items: bySection.storage,
    });
  }
  if (bySection.script.length > 0) {
    sections.push({
      id: "script",
      kind: "meters",
      title: t("variant_section_script"),
      items: bySection.script,
    });
  }
  if (bySection.strings.length > 0) {
    sections.push({
      id: "strings",
      kind: "meters",
      title: t("variant_section_strings"),
      items: bySection.strings,
    });
  }

  const varsByScope = new Map<string, VariantLimitItem[]>();
  for (const item of bySection.variables) {
    const { scope, type } = splitVariableLabel(item.label);
    const scoped: VariantLimitItem = { ...item, label: type };
    const list = varsByScope.get(scope);
    if (list) {
      list.push(scoped);
    } else {
      varsByScope.set(scope, [scoped]);
    }
  }
  for (const scope of VARIABLE_SCOPE_ORDER) {
    const scopeItems = varsByScope.get(scope);
    if (!scopeItems) {
      continue;
    }
    sections.push({
      id: `variables-${scope}`,
      kind: "variables",
      title: t("variant_section_variables", {
        scope: localizeScope(scope, t),
      }),
      items: scopeItems,
    });
    varsByScope.delete(scope);
  }
  for (const [scope, scopeItems] of varsByScope) {
    sections.push({
      id: `variables-${scope}`,
      kind: "variables",
      title: t("variant_section_variables", {
        scope: localizeScope(scope, t),
      }),
      items: scopeItems,
    });
  }

  if (bySection.declarations.length > 0) {
    sections.push({
      id: "declarations",
      kind: "meters",
      title: t("variant_section_declarations"),
      items: bySection.declarations,
    });
  }

  return sections;
}
