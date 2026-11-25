import type { Oas3Rule } from "@redocly/openapi-core";
export type ExampleLayoutViolation = {
    /** 違反したファイルの root 文書のディレクトリからの相対パス (`examples/<Schema>/<File>.yaml` の形)。 */
    entry: string;
    message: string;
};
/**
 * examples/ 配下のファイル配置の違反を返す。
 *
 * - 対象は `.yaml`・`.yml` のみ。それ以外 (PDF 等) は無視する。
 * - 名前が `.` で始まるファイルとディレクトリ (配下を含む) は、呼び出し側 (`listFiles`) が列挙から除く。
 * - 配置は `<Schema>/<File>.yaml` (深さ 2) のみ許可する。`<Schema>` は登録済みスキーマ名。
 * - 1 ファイルに複数の問題があれば問題ごとに 1 件返す。
 * - 返す `entry` とメッセージ中のパスは root 文書のディレクトリからの相対 (`examples/` を前置する)。
 *
 * @param entries examples/ 配下の全ファイルの相対パス (posix 区切り、再帰)
 * @param schemaNames 登録済みスキーマ名
 */
export declare const findExampleLayoutViolations: (entries: readonly string[], schemaNames: ReadonlySet<string>) => ExampleLayoutViolation[];
export declare const ExamplesLayout: Oas3Rule;
