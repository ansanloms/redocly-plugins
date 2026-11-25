import { parse } from "node:path";
import { createTopLevelPathTracker } from "./top-level-path.js";
// `./descriptions/<x>.md` 形の $ref。<x> はサブディレクトリを含まないファイル名 (拡張子なし)。
const DESCRIPTION_REF = /^\.\/descriptions\/([^/]+)\.md$/;
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
 * - schema が別ファイルのルートに在れば、その定義ファイル名 (拡張子なし) と比べる。root に直書きの schema と
 *   フラグメント付きの参照先は、`components.schemas` のキー名と比べる。
 * - `$defs`・`definitions` は検査しない。
 */
export const DescriptionFileNaming = () => {
    const tracker = createTopLevelPathTracker();
    const checked = new Set();
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
                    const description = target?.description;
                    const ref = typeof description === "object" && description !== null
                        ? description.$ref
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
                    const actual = matched[1];
                    const isDefinitionFile = ctx.location.pointer === "#/";
                    const expected = isDefinitionFile
                        ? parse(ctx.location.source.absoluteRef).name
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
        PathItem: {
            enter: (_target, ctx) => {
                tracker.enter(ctx.key);
            },
            leave: () => {
                tracker.leave();
            },
        },
        Operation: {
            enter: (target, ctx) => {
                // paths 直下の PathItem のみ対象とする。
                if (tracker.current() === undefined) {
                    return;
                }
                // description は解決前の `{ $ref }` のまま渡される (型定義上は string)。
                const description = target?.description;
                const ref = typeof description === "object" && description !== null
                    ? description.$ref
                    : undefined;
                if (typeof ref !== "string" || typeof target?.operationId !== "string") {
                    return;
                }
                const matched = DESCRIPTION_REF.exec(ref);
                if (!matched) {
                    return;
                }
                const actual = matched[1];
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
