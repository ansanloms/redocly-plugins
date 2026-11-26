import type { Oas3Preprocessor } from "@redocly/openapi-core";
import { createInlineExampleField } from "./inline-examples.ts";

/**
 * OpenAPI 3.2 の Example オブジェクトの `dataValue` の中にあるファイル参照 (`$ref: ./x.yaml`) を、bundle 時にインライン展開する。
 *
 * - oas3 の preprocessor として登録されるので、OAS 3.0/3.1 の文書でも Example に `dataValue` があれば展開する。3.0/3.1 では `dataValue` は仕様外の欄で、Redocly の struct rule が報告する。
 * - 対象は `dataValue` だけ。`serializedValue` には触れない。`value` とも独立で、`value` の展開は `inline-examples` が担う。
 * - 展開規則・報告文言は `inline-examples` と同じ (報告位置は `dataValue`)。詳細は `createInlineExampleField` を参照。
 */
export const InlineDataValue: Oas3Preprocessor = createInlineExampleField("dataValue");
