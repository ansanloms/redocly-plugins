import type { Oas3Preprocessor } from "@redocly/openapi-core";

import { InlineExamples } from "./preprocessors/inline-examples.ts";
import { DescriptionFileNaming } from "./rules/description-file-naming.ts";
import { EnumSchemaNaming } from "./rules/enum-schema-naming.ts";
import { ExamplesLayout } from "./rules/examples-layout.ts";
import { NoInlineEnum } from "./rules/no-inline-enum.ts";
import { NoUnreferencedFiles } from "./rules/no-unreferenced-files.ts";
import { createOperationIdNaming, type ExpectedOperationId } from "./rules/operation-id-naming.ts";

export type { ExpectedOperationId } from "./rules/operation-id-naming.ts";

export const preprocessors: Record<string, Oas3Preprocessor> = {
  "inline-examples": InlineExamples,
};

const toPascalCase = (segment: string): string =>
  segment
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
export const expectedOperationId: ExpectedOperationId = (method, path) => {
  const parts = path
    .split("/")
    .filter((v) => v.length > 0)
    .map((segment) => toPascalCase(/^\{(.+)\}$/.exec(segment)?.[1] ?? segment));

  return method.toLowerCase() + parts.join("");
};

export interface PluginOptions {
  id?: string;
  operationId?: ExpectedOperationId;
}

export const createPlugin =
  (options: PluginOptions = {}) =>
  () => ({
    id: options.id ?? "ansanloms",
    preprocessors: {
      oas3: preprocessors,
    },
    rules: {
      oas3: {
        "operation-id-naming": createOperationIdNaming(options.operationId ?? expectedOperationId),
        "description-file-naming": DescriptionFileNaming,
        "examples-layout": ExamplesLayout,
        "no-unreferenced-files": NoUnreferencedFiles,
        "enum-schema-naming": EnumSchemaNaming,
        "no-inline-enum": NoInlineEnum,
      },
    },
  });

// `redocly.yaml` からパッケージ名で参照すると、既定の規約の plugin が使われる。
// 規約を差し替える場合は `createPlugin` を呼ぶ。
export default createPlugin();
