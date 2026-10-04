import { z } from "zod";
import semver from "semver";

export const limits = {
  keys: 10_000,
  values: 50_000,
  bytes: 100 * 1024 * 1024,
  catalog: 1024 * 1024,
} as const;
export const channelSchema = z.enum(["preview", "production"]);
export type Channel = z.infer<typeof channelSchema>;
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const localeSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9-]+$/);
export const appVersionSchema = z
  .string()
  .max(256)
  .refine(
    (v) => /^[0-9]/.test(v) && v.trim() === v && semver.valid(v) !== null,
    "Use a strict semantic version.",
  );
export const compatibilitySchema = z
  .object({
    min: appVersionSchema.nullable(),
    max: appVersionSchema.nullable(),
  })
  .strict()
  .refine(
    (v) => !v.min || !v.max || semver.lte(v.min, v.max),
    "The minimum version must not exceed the maximum.",
  );
export type Compatibility = z.infer<typeof compatibilitySchema>;
export const parameterSchema = z
  .object({
    name: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .max(100),
    type: z.enum(["text", "number"]),
  })
  .strict();
export const runtimeEntrySchema = z
  .object({
    key: z.string().min(1).max(200),
    format: z.enum(["plain", "icu"]),
    parameters: z.array(parameterSchema).max(32),
    value: z
      .string()
      .refine(
        (value) => new TextEncoder().encode(value).byteLength <= 16 * 1024,
        "Value exceeds 16 KiB UTF-8.",
      )
      .nullable(),
  })
  .strict();
export const localeFileSchema = z
  .object({
    protocol: z.literal(1),
    releaseId: z.uuid(),
    locale: localeSchema,
    entries: z.array(runtimeEntrySchema).max(limits.keys),
  })
  .strict()
  .refine(
    (file) =>
      new Set(file.entries.map((entry) => entry.key)).size ===
      file.entries.length,
    "Duplicate translation key.",
  );
export type LocaleFile = z.infer<typeof localeFileSchema>;
export const fileSchema = z
  .object({
    locale: localeSchema,
    digest: digestSchema,
    bytes: z.number().int().positive().max(limits.bytes),
  })
  .strict();
export const releaseManifestSchema = z
  .object({
    protocol: z.literal(1),
    kind: z.literal("release"),
    projectId: z.uuid(),
    releaseId: z.uuid(),
    compatibility: compatibilitySchema,
    requestedLocales: z.array(localeSchema).min(1),
    languages: z
      .array(
        z
          .object({ locale: localeSchema, fallback: localeSchema.nullable() })
          .strict(),
      )
      .min(1),
    files: z.array(fileSchema).min(1),
    keyCount: z.number().int().positive().max(limits.keys),
  })
  .strict()
  .superRefine((manifest, context) => {
    const languages = new Map(
      manifest.languages.map((language) => [
        language.locale,
        language.fallback,
      ]),
    );
    const files = new Set(manifest.files.map((file) => file.locale));
    const invalid =
      languages.size !== manifest.languages.length ||
      files.size !== manifest.files.length ||
      files.size !== languages.size ||
      new Set(manifest.requestedLocales).size !==
        manifest.requestedLocales.length ||
      manifest.requestedLocales.some((locale) => !languages.has(locale)) ||
      [...languages.keys()].some((locale) => !files.has(locale)) ||
      manifest.keyCount * languages.size > limits.values;
    if (invalid)
      context.addIssue({
        code: "custom",
        message: "Inconsistent release language inventory.",
      });
    const roots = new Set<string>();
    for (const locale of languages.keys()) {
      const seen = new Set<string>();
      let cursor: string | null = locale;
      while (cursor !== null) {
        if (seen.has(cursor) || !languages.has(cursor)) {
          context.addIssue({
            code: "custom",
            message: "Invalid release fallback graph.",
          });
          break;
        }
        seen.add(cursor);
        const next: string | null = languages.get(cursor) ?? null;
        if (next === null) roots.add(cursor);
        cursor = next;
      }
    }
    if (roots.size !== 1)
      context.addIssue({
        code: "custom",
        message: "Fallbacks must end in one source language.",
      });
  });
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
export const publicationSchema = z
  .object({
    id: z.uuid(),
    releaseId: z.uuid(),
    manifestDigest: digestSchema,
    sequence: z.number().int().positive().safe(),
    compatibility: compatibilitySchema,
  })
  .strict();
export type Publication = z.infer<typeof publicationSchema>;
export const catalogSchema = z
  .object({
    protocol: z.literal(1),
    kind: z.literal("catalog"),
    projectId: z.uuid(),
    distributionId: z.uuid(),
    channel: channelSchema,
    revision: z.number().int().nonnegative().safe(),
    publications: z.array(publicationSchema),
  })
  .strict()
  .refine(
    (catalog) =>
      new Set(catalog.publications.map((p) => p.id)).size ===
        catalog.publications.length &&
      new Set(catalog.publications.map((p) => p.sequence)).size ===
        catalog.publications.length &&
      catalog.publications.every((p) => p.sequence <= catalog.revision),
    "Invalid publication ordering.",
  );
export type Catalog = z.infer<typeof catalogSchema>;
export const policySchema = z
  .object({
    protocol: z.literal(1),
    kind: z.literal("policy"),
    distributionId: z.uuid(),
    revision: z.number().int().positive().safe(),
    origins: z.array(z.url()).max(100),
    keys: z
      .array(
        z
          .object({ id: z.uuid(), hash: digestSchema, channel: channelSchema })
          .strict(),
      )
      .max(1000),
  })
  .strict();
export type Policy = z.infer<typeof policySchema>;
export const signedDocumentSchema = z
  .object({
    jws: z
      .string()
      .min(1)
      .max(Math.ceil(limits.bytes * 1.4)),
  })
  .strict();
export function compatible(version: string, bounds: Compatibility) {
  appVersionSchema.parse(version);
  return (
    (!bounds.min || semver.gte(version, bounds.min)) &&
    (!bounds.max || semver.lte(version, bounds.max))
  );
}
export function selectPublication(catalog: Catalog, version: string) {
  return (
    catalog.publications
      .filter((p) => compatible(version, p.compatibility))
      .sort((a, b) => b.sequence - a.sequence)[0] ?? null
  );
}
/** Inclusive ranges cover every affected version, including prereleases. */
export function rollbackCovered(publications: Publication[], id: string) {
  const target = publications.find((p) => p.id === id);
  if (!target) return false;
  const low = target.compatibility.min ?? "0.0.0-0";
  const intervals = publications
    .filter((p) => p.id !== id)
    .map((p) => p.compatibility)
    .sort((a, b) => semver.compare(a.min ?? "0.0.0-0", b.min ?? "0.0.0-0"));
  let covered: string | null | undefined;
  for (const interval of intervals) {
    const start = interval.min ?? "0.0.0-0";
    if (interval.max && semver.lt(interval.max, low)) continue;
    if (covered === undefined) {
      if (semver.gt(start, low)) return false;
    } else if (covered === null) return true;
    else if (semver.gt(start, covered)) {
      const successor = versionSuccessor(covered);
      if (!successor || !semver.eq(start, successor)) return false;
    }
    if (interval.max === null) return true;
    if (covered === undefined || semver.gt(interval.max, covered))
      covered = interval.max;
    if (
      target.compatibility.max &&
      semver.gte(covered, target.compatibility.max)
    )
      return true;
  }
  return false;
}
export function validateOrigins(origins: string[]) {
  return [
    ...new Set(
      origins.map((value) => {
        const url = new URL(value);
        if (
          url.origin !== value ||
          url.username ||
          url.password ||
          (url.protocol !== "https:" &&
            !(
              url.protocol === "http:" &&
              ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
            ))
        )
          throw new Error(
            "Use HTTPS origins, or loopback HTTP origins for development.",
          );
        return value;
      }),
    ),
  ];
}

/** Exact affected intervals; endpoints are explicit so prerelease boundaries stay visible. */
export function rollbackImpact(publications: Publication[], id: string) {
  const points = [
    ...new Set([
      "0.0.0-0",
      ...publications
        .flatMap((p) => [p.compatibility.min, p.compatibility.max])
        .filter((v): v is string => v !== null),
    ]),
  ].sort(semver.compare);
  const result: {
    min: string;
    max: string | null;
    includeMin: boolean;
    includeMax: boolean;
    replacementId: string | null;
    releaseId: string | null;
  }[] = [];
  const winner = (version: string, removed: boolean) =>
    publications
      .filter(
        (p) =>
          (!removed || p.id !== id) && compatible(version, p.compatibility),
      )
      .sort((a, b) => b.sequence - a.sequence)[0];
  const add = (
    representative: string,
    min: string,
    max: string | null,
    includeMin: boolean,
    includeMax: boolean,
  ) => {
    if (winner(representative, false)?.id !== id) return;
    const replacement = winner(representative, true);
    result.push({
      min,
      max,
      includeMin,
      includeMax,
      replacementId: replacement?.id ?? null,
      releaseId: replacement?.releaseId ?? null,
    });
  };
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;
    add(point, point, point, true, true);
    const next = points[i + 1] ?? null;
    const after = versionSuccessor(point);
    if (after && (!next || semver.lt(after, next)))
      add(after, point, next, false, false);
  }
  return result;
}
function versionSuccessor(value: string): string | null {
  const v = new semver.SemVer(value);
  if (v.prerelease.length) return v.version + ".0";
  if (v.patch < Number.MAX_SAFE_INTEGER)
    return `${v.major}.${v.minor}.${v.patch + 1}-0`;
  if (v.minor < Number.MAX_SAFE_INTEGER) return `${v.major}.${v.minor + 1}.0-0`;
  if (v.major < Number.MAX_SAFE_INTEGER) return `${v.major + 1}.0.0-0`;
  return null;
}
