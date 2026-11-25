import { createTopLevelPathTracker } from "./top-level-path.js";
/**
 * `$ref` 文字列から schema の名前を取り出す。
 *
 * - `#` より後ろが空でなければ、JSON Pointer の最後のセグメント (`~1`・`~0` を戻す)。
 * - それ以外は、パスの最後の要素から最後の拡張子を除いたもの。
 */
export const schemaNameFromRef = (ref) => {
    const hash = ref.indexOf("#");
    const fragment = hash === -1 ? "" : ref.slice(hash + 1);
    if (fragment !== "") {
        const last = fragment.split("/").pop() ?? "";
        return last.replaceAll("~1", "/").replaceAll("~0", "~");
    }
    const path = hash === -1 ? ref : ref.slice(0, hash);
    const base = path.split("/").pop() ?? "";
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(0, dot) : base;
};
const isRecord = (value) => typeof value === "object" && value !== null;
const PREFIXES = {
    requestBody: { label: "requestBody", prefix: "Request", pattern: /^Request[A-Z]/ },
    response: { label: "response", prefix: "Response", pattern: /^Response[A-Z]/ },
};
/**
 * エンドポイントの requestBody は `Request*`、response は `Response*` の schema だけを参照させる。
 *
 * - 対象は paths 直下の operation の requestBody と response の `content.<media type>` の `schema` と `itemSchema`。
 * - schema の名前は `$ref` 文字列の末尾から決める。`Request` / `Response` + 大文字で始まらなければ報告する。
 * - インラインの schema (`$ref` を持たないもの) は報告する。
 * - `headers.<name>.content`・callbacks 内・webhooks・components 直下は検査しない。
 * - 同じ箇所は何度訪問されても 1 回だけ報告する。
 */
export const RequestResponseSchemaNaming = () => {
    const tracker = createTopLevelPathTracker();
    const reported = new Set();
    const check = (kind, target, ctx) => {
        if (tracker.current() === undefined || !isRecord(target) || !isRecord(target.content)) {
            return;
        }
        const { label, prefix, pattern } = PREFIXES[kind];
        const emit = (path, message) => {
            const location = ctx.location.child(path);
            const key = `${location.source.absoluteRef}#${location.pointer}|${message}`;
            if (reported.has(key)) {
                return;
            }
            reported.add(key);
            ctx.report({ message, location });
        };
        for (const [mediaType, rawMedia] of Object.entries(target.content)) {
            let media = rawMedia;
            let viaRef = false;
            if (isRecord(media) && typeof media.$ref === "string") {
                media = ctx.resolve({ $ref: media.$ref }).node;
                viaRef = true;
            }
            if (!isRecord(media)) {
                continue;
            }
            // media type 自体が $ref の場合、$ref 先の位置は参照元の文書から辿れないので media type の位置に報告する。
            const at = (...rest) => viaRef ? ["content", mediaType] : ["content", mediaType, ...rest];
            for (const prop of ["schema", "itemSchema"]) {
                if (!(prop in media)) {
                    continue;
                }
                const schema = media[prop];
                const ref = isRecord(schema) ? schema.$ref : undefined;
                if (typeof ref === "string") {
                    const actual = schemaNameFromRef(ref);
                    if (!pattern.test(actual)) {
                        emit(at(prop, "$ref"), `${label} が参照する schema の名前が ${prefix} + 大文字で始まっていません (actual: ${actual})。`);
                    }
                }
                else {
                    emit(at(prop), `${label} の schema がインラインで定義されています。${prefix} で始まる schema を $ref で参照してください。`);
                }
            }
        }
    };
    return {
        PathItem: {
            enter: (_target, ctx) => {
                tracker.enter(ctx.key);
            },
            leave: () => {
                tracker.leave();
            },
        },
        Operation: {
            RequestBody: {
                enter: (target, ctx) => {
                    check("requestBody", target, ctx);
                },
            },
            Response: {
                enter: (target, ctx) => {
                    check("response", target, ctx);
                },
            },
        },
    };
};
