import { parse } from "node:path";

import type { Oas3Rule } from "@redocly/openapi-core";

import { createTopLevelPathVisitor } from "./top-level-path.ts";

// `./descriptions/<x>.md` 形の $ref。<x> はサブディレクトリを含まないファイル名 (拡張子なし)。
const DESCRIPTION_REF = /^\.\/descriptions\/([^/]+)\.md$/;

/**
 * 定義位置 `location` が、検査中の `schemas` の map (`mapLocation`) の直下 1 セグメントなら、そのキーを返す。
 * 別ファイルを指す参照先など、それ以外の位置では undefined を返す。
 */
const keyUnderMap = (
  location: { pointer: string; source: { absoluteRef: string } },
  mapLocation: { pointer: string; source: { absoluteRef: string } } | undefined,
): string | undefined => {
  if (!mapLocation || location.source.absoluteRef !== mapLocation.source.absoluteRef) {
    return undefined;
  }
  // map がファイルのルート (`#/`) なら、直下は `#/<1 セグメント>`。
  const prefix = mapLocation.pointer === "#/" ? "#/" : `${mapLocation.pointer}/`;
  if (!location.pointer.startsWith(prefix)) {
    return undefined;
  }
  const rest = location.pointer.slice(prefix.length);
  if (rest === "" || rest.includes("/")) {
    return undefined;
  }
  return rest.replaceAll("~1", "/").replaceAll("~0", "~");
};

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
export const DescriptionFileNaming: Oas3Rule = () => {
  const { tracker, PathItem } = createTopLevelPathVisitor();
  const checked = new Set<string>();

  return {
    Root: {
      enter: () => {
        checked.clear();
      },
    },
    NamedSchemas: {
      // `components.schemas` の key は "schemas"。`$defs`・`definitions` は対象外。
      skip: (_node, key) => key !== "schemas",
      Schema: {
        enter: (target, ctx) => {
          // description は解決前の `{ $ref }` のまま渡される (型定義上は string)。
          const description: unknown = target?.description;
          const ref: unknown =
            typeof description === "object" && description !== null
              ? (description as { $ref?: unknown }).$ref
              : undefined;
          if (typeof ref !== "string") {
            return;
          }

          const matched = DESCRIPTION_REF.exec(ref);
          if (!matched) {
            return;
          }

          const id = ctx.location.source.absoluteRef + ctx.location.pointer;
          if (checked.has(id)) {
            return;
          }
          checked.add(id);

          const actual = matched[1]!;
          const isDefinitionFile = ctx.location.pointer === "#/";
          // 別のキーからの $ref 経由で訪問されることがあるので、ctx.key (参照元) ではなく
          // schema が定義されている位置から期待値を導く。map の直下に無ければ ctx.key に落とす。
          const defined = isDefinitionFile
            ? undefined
            : keyUnderMap(ctx.location, ctx.parentLocations?.NamedSchemas);
          const expected = isDefinitionFile
            ? parse(ctx.location.source.absoluteRef).name
            : defined !== undefined
              ? defined
              : String(ctx.key);
          if (actual !== expected) {
            const target = isDefinitionFile ? "定義ファイル名" : "スキーマ名";
            ctx.report({
              message: `description のファイル名が${target}と一致していません (actual: ${actual}, expected: ${expected})。`,
              location: ctx.location.child(["description", "$ref"]),
            });
          }
        },
      },
    },
    PathItem,
    Operation: {
      enter: (target, ctx) => {
        // paths 直下の PathItem のみ対象とする。
        if (tracker.current() === undefined) {
          return;
        }

        // description は解決前の `{ $ref }` のまま渡される (型定義上は string)。
        const description: unknown = target?.description;
        const ref: unknown =
          typeof description === "object" && description !== null
            ? (description as { $ref?: unknown }).$ref
            : undefined;
        if (typeof ref !== "string" || typeof target?.operationId !== "string") {
          return;
        }

        const matched = DESCRIPTION_REF.exec(ref);
        if (!matched) {
          return;
        }

        const actual = matched[1]!;
        if (actual !== target.operationId) {
          ctx.report({
            message: `description のファイル名が operationId と一致していません (actual: ${actual}, expected: ${target.operationId})。`,
            location: ctx.location.child(["description", "$ref"]),
          });
        }
      },
    },
  };
};
