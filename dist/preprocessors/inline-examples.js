import { readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { parseYaml } from "@redocly/openapi-core";
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isUrl = (ref) => /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ref);
/** `#` を含まない、URL でない、絶対パスでない相対パスの参照か。 */
const isRelativeFileRef = (ref) => !ref.includes("#") && !isUrl(ref) && !isAbsolute(ref);
const isYamlExt = (ref) => [".yaml", ".yml"].includes(extname(ref));
/** 展開対象の参照か。`#` を含まない、URL でない、絶対パスでない、拡張子が `.yaml`・`.yml` のもの。 */
const isExpandableRef = (ref) => isRelativeFileRef(ref) && isYamlExt(ref);
/** 落とす参照か。`#` を含まない、URL でない、絶対パスでない、拡張子が `.yaml`・`.yml` でないもの。 */
const isDroppableRef = (ref) => isRelativeFileRef(ref) && !isYamlExt(ref);
/** 通常ファイルとして存在するか。stat の失敗は存在しない扱い。 */
const isFile = (file) => {
    try {
        return statSync(file).isFile();
    }
    catch {
        return false;
    }
};
const errorMessage = (e) => (e instanceof Error ? e.message : String(e)).split("\n")[0];
/**
 * Example オブジェクトの `value`・`dataValue` の中にあるファイル参照 (`$ref: ./x.yaml`) を、bundle 時にインライン展開する。
 *
 * - 展開するのは `value`・`dataValue` の中の `$ref` で、`#` を含まない・URL でない・絶対パスでない
 *   `.yaml`・`.yml` への相対パスだけ。参照先は参照元のファイルのディレクトリを基準に解決し、
 *   参照先の中の `$ref` も参照先のファイルのディレクトリを基準に再帰的に展開する。
 * - `#` を含まない・URL でない・絶対パスでない相対パスで、拡張子が `.yaml`・`.yml` でない `$ref` (`.pdf`・`.json` 等) は、
 *   Redocly は `value`・`dataValue` の中の `$ref` を解決しないので、YAML として展開できないファイル参照を bundle 後の文書に残さないため、
 *   参照先が通常ファイルとして在れば `$ref` キーを除く。兄弟のキーとその順序は残し、
 *   `$ref` だけのオブジェクトは `{}` になる。報告はしない。参照先のファイルの中に書かれた参照も同じ。
 *   参照先が無ければ (ディレクトリ・stat の失敗を含む) 対象の欄の位置に報告し、`$ref` を残す。
 * - それ以外の `$ref` (URL・絶対パス・`#` を含む参照) は展開せず、そのまま残す。
 * - `$ref` だけのオブジェクトは参照先の値 (配列・スカラーを含む) で置き換える。
 *   兄弟のキーがあるときは参照先 (オブジェクトのみ) と合成し、同名のキーは兄弟のキーが勝つ。
 * - 循環参照・読み込み失敗・非 YAML の参照先が無い場合・兄弟のキーがあるのに参照先がオブジェクトでない場合は、
 *   対象の欄の位置に報告し、その `$ref` は展開しない。報告には `$ref` の文字列・参照元と参照先のファイルを含め、
 *   パスは Example のファイルのディレクトリからの相対パスで示す。
 * - 参照先のファイルの中に展開せず残る相対パスの `$ref` は、Example のファイルのディレクトリを基準にしたパスへ書き直す
 *   (bundle の中では Example のファイルが基準になるため)。URL・絶対パス・`#` で始まる参照は書き直さない。
 * - Example オブジェクトそのものが `$ref` の場合は Redocly が解決するため対象外。
 *   スキーマの `examples` は Example オブジェクトではないため対象外。
 * - `serializedValue`・`externalValue` には触れない。
 * - `dataValue` は OAS 3.2 の欄。3.0/3.1 の文書でも `dataValue` があれば展開する
 *   (3.0/3.1 では仕様外の欄で、Redocly の struct rule が報告する)。
 */
export const InlineExamples = () => {
    /** 絶対パス -> パース結果。同じファイルを 1 度だけ読む。 */
    const cache = new Map();
    const load = (file) => {
        let loaded = cache.get(file);
        if (!loaded) {
            try {
                loaded = { ok: true, value: parseYaml(readFileSync(file, "utf8")) ?? null };
            }
            catch (e) {
                loaded = { ok: false, error: errorMessage(e) };
            }
            cache.set(file, loaded);
        }
        return loaded;
    };
    /**
     * 展開せずに残す `$ref` を、Example のディレクトリ基準のパスへ書き直す。
     * `from` は参照を書いているファイル。Example 自身のファイルの中の参照は書き直さない。
     */
    const rewriteRef = (ref, from, exampleDir) => {
        const dir = dirname(from);
        if (dir === exampleDir || isUrl(ref) || isAbsolute(ref) || ref.startsWith("#")) {
            return ref;
        }
        const hashAt = ref.indexOf("#");
        const target = hashAt < 0 ? ref : ref.slice(0, hashAt);
        const hash = hashAt < 0 ? "" : ref.slice(hashAt);
        const rel = relative(exampleDir, resolve(dir, target)).split(sep).join("/");
        return `${rel === ".." || rel.startsWith("../") ? "" : "./"}${rel}${hash}`;
    };
    /**
     * 常に新しい配列・オブジェクトを組み立てて返す (キャッシュした値を共有しない)。
     * `from` は対象の欄が書かれているファイル、`exampleDir` は Example のファイルのディレクトリ。
     */
    const expand = (value, from, exampleDir, chain, problems) => {
        if (Array.isArray(value)) {
            return value.map((v) => expand(v, from, exampleDir, chain, problems));
        }
        if (!isObject(value)) {
            return value;
        }
        /** 報告に使うパス。Example のディレクトリからの相対パス。 */
        const show = (file) => relative(exampleDir, file).split(sep).join("/");
        /** `$ref` を残す (`drop` が true なら除く)。兄弟のキーは展開して残す。 */
        const plain = (drop = false) => Object.fromEntries(Object.entries(value)
            .filter(([k]) => !(drop && k === "$ref"))
            .map(([k, v]) => [
            k,
            k === "$ref" && typeof v === "string"
                ? rewriteRef(v, from, exampleDir)
                : expand(v, from, exampleDir, chain, problems),
        ]));
        const ref = value.$ref;
        if (typeof ref !== "string") {
            return plain();
        }
        const file = resolve(dirname(from), ref);
        const where = `$ref: ${ref}、参照元: ${show(from)}、参照先: ${show(file)}`;
        if (isDroppableRef(ref)) {
            if (isFile(file)) {
                return plain(true);
            }
            problems.push(`参照先のファイルがありません (${where})。`);
            return plain();
        }
        if (!isExpandableRef(ref)) {
            return plain();
        }
        if (chain.includes(file)) {
            problems.push(`参照が循環しています (${where})。ファイルの連鎖: ${[...chain, file].map(show).join(" -> ")}。`);
            return plain();
        }
        const loaded = load(file);
        if (!loaded.ok) {
            problems.push(`参照先を読み込めません (${where})。原因: ${loaded.error}`);
            return plain();
        }
        const siblings = Object.keys(value).filter((k) => k !== "$ref");
        if (siblings.length === 0) {
            return expand(loaded.value, file, exampleDir, [...chain, file], problems);
        }
        if (!isObject(loaded.value)) {
            problems.push(`$ref と同じ階層に他のキーがありますが、参照先がオブジェクトではありません (${where})。`);
            return plain();
        }
        const expanded = expand(loaded.value, file, exampleDir, [...chain, file], problems);
        const entries = [];
        for (const [k, v] of Object.entries(value)) {
            if (k === "$ref") {
                entries.push(...Object.entries(expanded).filter(([ek]) => !siblings.includes(ek)));
            }
            else {
                entries.push([k, expand(v, from, exampleDir, chain, problems)]);
            }
        }
        return Object.fromEntries(entries);
    };
    return {
        Root: {
            enter() {
                cache.clear();
            },
        },
        Example: {
            leave(node, ctx) {
                for (const field of ["value", "dataValue"]) {
                    const value = node[field];
                    if (typeof value !== "object" || value === null) {
                        continue;
                    }
                    const problems = [];
                    const from = ctx.location.source.absoluteRef;
                    const expanded = expand(value, from, dirname(from), [from], problems);
                    for (const message of new Set(problems)) {
                        ctx.report({ message, location: ctx.location.child([field]) });
                    }
                    node[field] = expanded;
                }
            },
        },
    };
};
