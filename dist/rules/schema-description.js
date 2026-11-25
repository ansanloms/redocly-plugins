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
export const SchemaDescription = () => {
    const reported = new Set();
    return {
        Root: {
            enter: () => {
                reported.clear();
            },
        },
        NamedSchemas: {
            // `components.schemas` の key は "schemas"。`$defs`・`definitions` は対象外。
            skip: (_node, key) => key !== "schemas",
            Schema: {
                enter: (target, ctx) => {
                    // description は解決前の `{ $ref }` のまま渡される (型定義上は string)。
                    const description = target?.description;
                    if (typeof description === "object" && description !== null) {
                        return;
                    }
                    if (typeof description === "string" && description.trim() !== "") {
                        return;
                    }
                    const id = ctx.location.source.absoluteRef + ctx.location.pointer;
                    if (reported.has(id)) {
                        return;
                    }
                    reported.add(id);
                    ctx.report({
                        message: "components.schemas に登録した schema のルートに description がありません。",
                        location: ctx.location,
                    });
                },
            },
        },
    };
};
