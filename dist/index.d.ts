import type { Oas3Preprocessor } from "@redocly/openapi-core";
import { type ExpectedOperationId } from "./rules/operation-id-naming.ts";
export type { ExpectedOperationId } from "./rules/operation-id-naming.ts";
export declare const preprocessors: Record<string, Oas3Preprocessor>;
/**
 * パスと HTTP メソッドから期待される operationId を算出する。
 *
 * - メソッド(小文字) + 各セグメントの PascalCase 連結。
 * - 各セグメントは英数字以外の文字 (`-`・`_`・`.` 等) で単語に分割し、各単語の
 *   先頭を大文字にして連結する (例: `/sitemap.xml` -> `SitemapXml`)。
 * - `{param}` は波括弧を除去して同様に変換し、常に含める (例: `/code/{code}` -> `CodeCode`)。
 */
export declare const expectedOperationId: ExpectedOperationId;
export interface PluginOptions {
    id?: string;
    operationId?: ExpectedOperationId;
}
export declare const createPlugin: (options?: PluginOptions) => () => {
    id: string;
    preprocessors: {
        oas3: Record<string, Oas3Preprocessor>;
    };
    rules: {
        oas3: {
            "operation-id-naming": import("@redocly/openapi-core").Oas3Rule;
            "description-file-naming": import("@redocly/openapi-core").Oas3Rule;
            "schema-description": import("@redocly/openapi-core").Oas3Rule;
            "examples-layout": import("@redocly/openapi-core").Oas3Rule;
            "no-unreferenced-files": import("@redocly/openapi-core").Oas3Rule;
            "key-order": import("@redocly/openapi-core").Oas3Rule;
            "request-response-schema-naming": import("@redocly/openapi-core").Oas3Rule;
            "enum-schema-naming": import("@redocly/openapi-core").Oas3Rule;
            "no-inline-enum": import("@redocly/openapi-core").Oas3Rule;
            "schema-file-naming": import("@redocly/openapi-core").Oas3Rule;
        };
    };
};
declare const _default: () => {
    id: string;
    preprocessors: {
        oas3: Record<string, Oas3Preprocessor>;
    };
    rules: {
        oas3: {
            "operation-id-naming": import("@redocly/openapi-core").Oas3Rule;
            "description-file-naming": import("@redocly/openapi-core").Oas3Rule;
            "schema-description": import("@redocly/openapi-core").Oas3Rule;
            "examples-layout": import("@redocly/openapi-core").Oas3Rule;
            "no-unreferenced-files": import("@redocly/openapi-core").Oas3Rule;
            "key-order": import("@redocly/openapi-core").Oas3Rule;
            "request-response-schema-naming": import("@redocly/openapi-core").Oas3Rule;
            "enum-schema-naming": import("@redocly/openapi-core").Oas3Rule;
            "no-inline-enum": import("@redocly/openapi-core").Oas3Rule;
            "schema-file-naming": import("@redocly/openapi-core").Oas3Rule;
        };
    };
};
export default _default;
