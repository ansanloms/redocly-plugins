import type { Oas3Rule } from "@redocly/openapi-core";
export type SchemaRegistrationViolation = {
    key: string;
    /** 報告位置。`key` はキー、`value` はエントリの値、`ref` は `$ref` の値。 */
    target: "key" | "value" | "ref";
    message: string;
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
export declare const findSchemaRegistrationViolations: (schemas: Record<string, unknown>) => SchemaRegistrationViolation[];
export declare const SchemaFileNaming: Oas3Rule;
