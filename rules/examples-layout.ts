import fs from "node:fs";
import path from "node:path";

import type { Oas3Rule } from "@redocly/openapi-core";

import { isYaml, listFiles } from "./files.ts";

const EXAMPLES_DIR = "examples";

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
export const findExampleLayoutViolations = (
  entries: readonly string[],
  schemaNames: ReadonlySet<string>,
): ExampleLayoutViolation[] => {
  const violations: ExampleLayoutViolation[] = [];

  for (const entry of entries) {
    if (!isYaml(entry)) {
      continue;
    }

    const rel = `${EXAMPLES_DIR}/${entry}`;
    const segments = entry.split("/");
    if (segments.length === 1) {
      violations.push({
        entry: rel,
        message: `examples 直下に example を置けません (${rel})。examples/<スキーマ名>/<ファイル名>.yaml の形で配置してください。`,
      });
      continue;
    }

    if (!schemaNames.has(segments[0]!)) {
      violations.push({
        entry: rel,
        message: `examples 配下のディレクトリ名が登録済みのスキーマ名ではありません (${rel})。ディレクトリ名はスキーマ名に一致させてください。`,
      });
    }
    if (segments.length >= 3) {
      violations.push({
        entry: rel,
        message: `examples/<スキーマ名>/ の下にサブディレクトリを作れません (${rel})。examples/<スキーマ名>/<ファイル名>.yaml の形で配置してください。`,
      });
    }
  }

  return violations;
};

export const ExamplesLayout: Oas3Rule = () => {
  const schemaNames = new Set<string>();

  return {
    NamedSchemas: {
      // $defs / definitions も NamedSchemas 型になるため、components.schemas のものだけを拾う。
      skip: (_target, key) => key !== "schemas",
      Schema: {
        enter: (_target, ctx) => {
          schemaNames.add(String(ctx.key));
        },
      },
    },
    Root: {
      leave: (_target, ctx) => {
        const dir = path.join(path.dirname(ctx.location.source.absoluteRef), EXAMPLES_DIR);
        if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
          return;
        }

        for (const { entry, message } of findExampleLayoutViolations(listFiles(dir), schemaNames)) {
          ctx.report({ message, location: ctx.location.child([entry]) });
        }
      },
    },
  };
};
