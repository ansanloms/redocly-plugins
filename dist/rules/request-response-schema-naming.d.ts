import type { Oas3Rule } from "@redocly/openapi-core";
/**
 * `$ref` 文字列から schema の名前を取り出す。
 *
 * - `#` より後ろが空でなければ、JSON Pointer の最後のセグメント (`~1`・`~0` を戻す)。
 * - それ以外は、パスの最後の要素から最後の拡張子を除いたもの。
 */
export declare const schemaNameFromRef: (ref: string) => string;
/**
 * エンドポイントの requestBody は `Request*`、response は `Response*` の schema だけを参照させる。
 *
 * - 対象は paths 直下の operation の requestBody と response の `content.<media type>` の `schema` と `itemSchema`。
 * - schema の名前は `$ref` 文字列の末尾から決める。`Request` / `Response` + 大文字で始まらなければ報告する。
 * - インラインの schema (`$ref` を持たないもの) は報告する。
 * - `headers.<name>.content`・callbacks 内・webhooks・components 直下は検査しない。
 * - 同じ箇所は何度訪問されても 1 回だけ報告する。
 */
export declare const RequestResponseSchemaNaming: Oas3Rule;
