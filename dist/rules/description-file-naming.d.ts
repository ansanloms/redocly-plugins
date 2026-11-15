import type { Oas3Rule } from "@redocly/openapi-core";
/**
 * operation の description を外部 md ファイルに切り出している場合、そのファイル名 (拡張子なし) を
 * operationId と一致させる。
 *
 * - 対象は paths 直下の operation の `description: { $ref: ./descriptions/<x>.md }` のみ。
 * - `<x>` が operationId と一致しなければ `description.$ref` の位置に報告する。
 * - `./descriptions/<x>.md` 形でない $ref、インラインの description、operationId の無い operation は検査しない。
 * - callbacks 内・webhooks・components.pathItems の operation は検査しない。
 */
export declare const DescriptionFileNaming: Oas3Rule;
