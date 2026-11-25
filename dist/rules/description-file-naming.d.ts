import type { Oas3Rule } from "@redocly/openapi-core";
/**
 * operation の description を外部 md ファイルに切り出している場合、そのファイル名 (拡張子なし) を
 * operationId と一致させる。
 *
 * - 対象は paths 直下の operation の `description: { $ref: ./descriptions/<x>.md }` のみ。
 * - `<x>` が operationId と一致しなければ `description.$ref` の位置に報告する。
 * - `./descriptions/<x>.md` 形でない $ref、インラインの description、operationId の無い operation は検査しない。
 * - callbacks 内・webhooks・components.pathItems の operation は検査しない。
 *
 * `components.schemas` 直下の schema も同様に検査する。
 *
 * - 対象は `description: { $ref: ./descriptions/<x>.md }` のみ。
 * - schema が別ファイルのルートに在れば、その定義ファイル名 (拡張子なし) と比べる。
 * - 定義が検査中の `schemas` の map (同じファイルの中) の直下に在れば、その定義のキー名と比べる。
 *   root に直書き、`components` を別ファイルに分けた場合、`schemas` だけを別ファイルに分けた場合が当たる。
 * - それ以外のフラグメント付きの参照先 (`./x.yaml#/User`) は、登録した `components.schemas` のキー名と比べる。
 *   同じフラグメント付きの参照先を 2 つ以上のキーが指す場合は、先に訪問されたキーと比べる。
 *   結果はキーの並び順で変わりうる。
 * - `$defs`・`definitions` は検査しない。
 */
export declare const DescriptionFileNaming: Oas3Rule;
