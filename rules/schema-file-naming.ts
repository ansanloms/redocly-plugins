import type { Oas3Rule } from "@redocly/openapi-core";

export type SchemaRegistrationViolation = {
  key: string;
  /** 報告位置。`key` はキー、`value` はエントリの値、`ref` は `$ref` の値。 */
  target: "key" | "value" | "ref";
  message: string;
};

const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]+$/;
const SCHEMA_REF = /^\.\/components\/schemas\/([^/]+)\.ya?ml$/;

/** `$ref` だけを持ち、その値が文字列のオブジェクトなら、その `$ref` を返す。 */
const refOnly = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const ref = (value as { $ref?: unknown }).$ref;
  if (Object.keys(value).length !== 1 || typeof ref !== "string") {
    return undefined;
  }
  return ref;
};

/**
 * `components.schemas` の登録の違反を返す。
 *
 * - キー名は PascalCase (`/^[A-Z][a-zA-Z0-9]+$/`)。
 * - 値は `$ref` だけのオブジェクト。インラインの schema は違反。
 * - `$ref` は `./components/schemas/<キー名>.yaml` または `.yml`。
 * - キー名の違反と、値・`$ref` の違反は独立に報告する。
 *
 * @param schemas 未解決の `components.schemas` のマップ
 */
export const findSchemaRegistrationViolations = (
  schemas: Record<string, unknown>,
): SchemaRegistrationViolation[] => {
  const violations: SchemaRegistrationViolation[] = [];

  for (const [key, value] of Object.entries(schemas)) {
    if (!PASCAL_CASE.test(key)) {
      violations.push({
        key,
        target: "key",
        message: `components.schemas のキー名が PascalCase ではありません (${key})。`,
      });
    }

    const ref = refOnly(value);
    if (ref === undefined) {
      violations.push({
        key,
        target: "value",
        message: `components.schemas の値は $ref のみにしてください (${key})。`,
      });
      continue;
    }

    if (SCHEMA_REF.exec(ref)?.[1] !== key) {
      violations.push({
        key,
        target: "ref",
        message: `$ref が components.schemas のキー名と対応していません (actual: ${ref}, expected: ./components/schemas/${key}.yaml)。`,
      });
    }
  }

  return violations;
};

export const SchemaFileNaming: Oas3Rule = () => {
  let rootRef: string | undefined;

  return {
    Root: {
      enter: (_target, ctx) => {
        rootRef = ctx.location.source.absoluteRef;
      },
    },
    NamedSchemas: {
      // `$defs` / `definitions` も NamedSchemas 型になるので、`components.schemas` だけを見る。
      skip: (_schemas, key) => key !== "schemas",
      enter: (schemas, ctx) => {
        if (ctx.location.source.absoluteRef !== rootRef) {
          return;
        }
        for (const v of findSchemaRegistrationViolations(schemas as Record<string, unknown>)) {
          const location =
            v.target === "key"
              ? ctx.location.child([v.key]).key()
              : v.target === "value"
                ? ctx.location.child([v.key])
                : ctx.location.child([v.key, "$ref"]);
          ctx.report({ message: v.message, location });
        }
      },
    },
  };
};
