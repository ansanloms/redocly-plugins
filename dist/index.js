import { InlineExamples } from "./preprocessors/inline-examples.js";
import { DescriptionFileNaming } from "./rules/description-file-naming.js";
import { EnumSchemaNaming } from "./rules/enum-schema-naming.js";
import { ExamplesLayout } from "./rules/examples-layout.js";
import { KeyOrder } from "./rules/key-order.js";
import { NoInlineEnum } from "./rules/no-inline-enum.js";
import { NoUnreferencedFiles } from "./rules/no-unreferenced-files.js";
import { createOperationIdNaming } from "./rules/operation-id-naming.js";
import { RequestResponseSchemaNaming } from "./rules/request-response-schema-naming.js";
import { SchemaDescription } from "./rules/schema-description.js";
export const preprocessors = {
    "inline-examples": InlineExamples,
};
const toPascalCase = (segment) => segment
    .split(/[^A-Za-z0-9]/)
    .filter((v) => v.length > 0)
    .map((v) => v.charAt(0).toUpperCase() + v.slice(1))
    .join("");
/**
 * パスと HTTP メソッドから期待される operationId を算出する。
 *
 * - メソッド(小文字) + 各セグメントの PascalCase 連結。
 * - 各セグメントは英数字以外の文字 (`-`・`_`・`.` 等) で単語に分割し、各単語の
 *   先頭を大文字にして連結する (例: `/sitemap.xml` -> `SitemapXml`)。
 * - `{param}` は波括弧を除去して同様に変換し、常に含める (例: `/code/{code}` -> `CodeCode`)。
 */
export const expectedOperationId = (method, path) => {
    const parts = path
        .split("/")
        .filter((v) => v.length > 0)
        .map((segment) => toPascalCase(/^\{(.+)\}$/.exec(segment)?.[1] ?? segment));
    return method.toLowerCase() + parts.join("");
};
export const createPlugin = (options = {}) => () => ({
    id: options.id ?? "ansanloms",
    preprocessors: {
        oas3: preprocessors,
    },
    rules: {
        oas3: {
            "operation-id-naming": createOperationIdNaming(options.operationId ?? expectedOperationId),
            "description-file-naming": DescriptionFileNaming,
            "schema-description": SchemaDescription,
            "examples-layout": ExamplesLayout,
            "no-unreferenced-files": NoUnreferencedFiles,
            "key-order": KeyOrder,
            "request-response-schema-naming": RequestResponseSchemaNaming,
            "enum-schema-naming": EnumSchemaNaming,
            "no-inline-enum": NoInlineEnum,
        },
    },
});
// `redocly.yaml` からパッケージ名で参照すると、既定の規約の plugin が使われる。
// 規約を差し替える場合は `createPlugin` を呼ぶ。
export default createPlugin();
