import path from "node:path";
import { fileURLToPath } from "node:url";

import { createConfig, lintFromString } from "@redocly/openapi-core";

import { createPlugin } from "../index.ts";

const dir = path.dirname(fileURLToPath(import.meta.url));

/** テスト用 fixture ディレクトリの絶対パスを返す。 */
export const fixtureDir = (name: string): string => path.join(dir, "fixtures", name);

export type Reported = { message: string; pointer: string; file: string };

/**
 * 実物の walker で `source` を lint し、対象 rule の problem だけを返す。
 *
 * @param rule plugin 内の rule 名
 * @param source ルート文書の YAML
 * @param baseDir 外部ファイルへの相対 `$ref` を解決する基準ディレクトリ
 */
export const lintRule = async (
  rule: string,
  source: string,
  baseDir: string,
): Promise<Reported[]> => {
  const plugin = createPlugin({ id: "t" })();
  const config = await createConfig({
    plugins: [plugin],
    rules: { [`t/${rule}`]: "error" },
  });
  const problems = await lintFromString({
    source,
    absoluteRef: path.join(baseDir, "root.yaml"),
    config,
  });

  return problems
    .filter((v) => v.ruleId === `t/${rule}`)
    .map((v) => ({
      message: v.message,
      pointer: v.location[0]!.pointer ?? "",
      file: path.relative(baseDir, v.location[0]!.source.absoluteRef),
    }));
};
