import type { Oas3Rule } from "@redocly/openapi-core";
/**
 * `components.schemas` に登録した schema のルートに description があることを要求する。
 *
 * - 対象は `components.schemas` 直下の schema のみ。`properties`・`items`・`allOf` 等のネストした schema と、
 *   3.1 の `$defs`・`definitions` は検査しない。
 * - `$ref` だけのエイリアスは参照先 (終点) の description で判定する。
 * - description の書き方は縛らない。文字列でも `{ $ref }` でも、在れば通す。
 * - `undefined`・`null`・空白だけの文字列は報告する。
 * - 同じ schema は 1 回だけ報告する。
 */
export declare const SchemaDescription: Oas3Rule;
