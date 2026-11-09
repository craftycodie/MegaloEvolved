import {
  ALL_MEGACROW_EXTENSIONS,
  isMegaloVersionId,
  type MegacrowExtensions,
  type MegaloVersionId,
  type ObjectLists,
} from "@megacrow/megalo";
import { z } from "zod";
import type { MegacrowConfig } from "./protocol";

const megacrowExtensionsSchema = z.object(
  Object.fromEntries(
    Object.keys(ALL_MEGACROW_EXTENSIONS).map((key) => [key, z.boolean()])
  )
) as unknown as z.ZodType<MegacrowExtensions>;

/**
 * Validates a whole {@link MegacrowConfig}. The TypeScript types in
 * `@megacrow/megalo` / `protocol.ts` stay the single definition; `satisfies`
 * keeps this schema in step with them.
 */
export const megacrowConfigSchema = z.object({
  compilerSettings: z
    .object({
      creatorGamertag: z.string(),
      strictStringLiterals: z.boolean(),
      temporaryVariablesCanOverflowIntoUnusedGlobalVariables: z.boolean(),
    })
    .partial(),
  locale: z.enum(["en", "ja"]),
  megacrowExtensions: megacrowExtensionsSchema,
  megaloVersion: z
    .string()
    .refine(isMegaloVersionId, "unknown Megalo version") as z.ZodType<
    MegaloVersionId,
    string
  >,
  // Shallow check: object lists come from megalo's own object-list analysis.
  objectLists: (
    z.record(z.string(), z.unknown()) as unknown as z.ZodType<ObjectLists>
  ).nullable(),
  resolveBaseFile: z.boolean(),
}) satisfies z.ZodType<MegacrowConfig>;

export type ParseConfigResult =
  | { ok: true; config: MegacrowConfig }
  | { ok: false; error: string };

export const parseConfig = (raw: unknown): ParseConfigResult => {
  const result = megacrowConfigSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, config: result.data };
  }
  return {
    ok: false,
    error: result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; "),
  };
};

/** Server defaults until the client sends its configuration. */
export const DEFAULT_MEGACROW_CONFIG: MegacrowConfig = {
  compilerSettings: {},
  locale: "en",
  megacrowExtensions: ALL_MEGACROW_EXTENSIONS,
  megaloVersion: "107-mcc",
  objectLists: null,
  resolveBaseFile: true,
};

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    );
  }
  return value;
};

/** Structural equality, independent of key order. */
export const sameConfig = (a: MegacrowConfig, b: MegacrowConfig): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
