# redocly-plugins

Redocly CLI (`@redocly/openapi-core`) の preprocessor と rule をまとめた plugin (`@ansanloms/redocly-plugins`)。

npm には publish せず、GitHub のタグを git 依存で参照する。

## 構成

plugin id は `ansanloms`。`redocly.yaml` では `ansanloms/<名前>` で参照する。
preprocessor も rule も、`redocly.yaml` で有効化したものだけが動く。

| 種別         | 名前                      |
| ------------ | ------------------------- |
| preprocessor | `inline-examples`         |
| rule         | `operation-id-naming`     |
| rule         | `description-file-naming` |
| rule         | `examples-layout`         |
| rule         | `no-unreferenced-files`   |
| rule         | `key-order`               |

## 利用

インストール:

```sh
npm install -D github:ansanloms/redocly-plugins#0.2.0
```

`redocly.yaml` の `plugins:` にパッケージ名を書いて参照する。Redocly CLI の plugin ローダは、設定ファイルからの相対パスにファイルが無ければパッケージ名として node_modules から解決する。

`redocly.yaml`:

```yaml
plugins:
  - "@ansanloms/redocly-plugins"
preprocessors:
  ansanloms/inline-examples: on
rules:
  ansanloms/operation-id-naming: error
  ansanloms/description-file-naming: error
  ansanloms/examples-layout: error
  ansanloms/no-unreferenced-files:
    severity: error
    dirs: [paths, components]
  ansanloms/key-order: error
```

## preprocessor

### `inline-examples`

Example オブジェクトの `value` の中にあるファイル参照を、bundle 時にインライン展開する oas3 preprocessor。

oas3 の `Example` を訪問し、`value` の中を再帰的に歩いて `$ref` を展開する。インラインの MediaType・Parameter の examples、`$ref` で取り込んだ response / requestBody の examples、`components.examples` のいずれでも動く。`$ref` 先の YAML は `node:fs` で読み込み、`@redocly/openapi-core` の `parseYaml` でパースする。

- 展開するのは、`#` を含まない・URL でない・絶対パスでない、拡張子が `.yaml` または `.yml` (小文字) の `$ref` だけ。参照先は参照元のファイルのディレクトリからの相対パスで解決し、参照先の中の `$ref` も参照先のファイルのディレクトリを基準に再帰的に展開する。
- 展開しないもの: URL・絶対パス・`#` を含む参照の `$ref` は、そのまま残す。スキーマの `properties.examples` や JSON Schema の `examples` は Example オブジェクトではないので対象外。
- `#` を含まない・URL でない・絶対パスでない相対パスで、拡張子が `.yaml` / `.yml` 以外 (`.pdf`・`.json` 等) の `$ref` は、参照先のファイルが在れば `$ref` キーを除く。兄弟のキーは残り、`$ref` だけのオブジェクトは `{}` になる。報告はしない。参照先が無ければ (ディレクトリ・stat の失敗を含む) `value` の位置に報告し、`$ref` を残す。Redocly は `value` の中の `$ref` を解決しないので、YAML として展開できないファイル参照を bundle 後の文書に残さないため。参照先のファイルの中に書かれたものも同じ。
- `{ $ref: ./x.yaml }` だけのオブジェクトは、参照先の値 (配列・スカラー・null を含む) でそのまま置き換える。空のファイルは `null` になる。
- `$ref` と同じ階層に他のキーがある場合は、参照先がオブジェクトのときだけ合成する。キーの並びは元のオブジェクトの順で、`$ref` の位置に参照先のキーが入る。同名のキーは、`$ref` の前後どちらに書いても兄弟のキーが勝つ。参照先がオブジェクトでなければ報告し、展開しない。
- 循環参照、ファイルの読み込み失敗 (ファイルが無い・ディレクトリ・YAML の文法エラー・複数ドキュメント)、参照先が無い非 YAML の相対パスは、`value` の位置に報告し、その `$ref` を展開せずに残す。報告には `$ref` の文字列・参照元と参照先のファイルを含め、パスは Example のファイルのディレクトリからの相対パスで示す。`redocly.yaml` で `error` (または `on`) にすれば lint と bundle が失敗する。
- 取り込んだファイルの中に展開されずに残る相対パスの `$ref` (`#` 付きの参照、循環・読み込み失敗・参照先が無い非 YAML で残したもの) は、bundle 後も正しいファイルを指すよう、Example のファイルのディレクトリを基準にしたパスへ書き直す。URL・絶対パス・`#` で始まる参照と、Example の `value` に直接書いた参照は書き直さない。
- Example オブジェクトそのものが `$ref` の場合 (`examples: { a: { $ref: ./a.yaml } }`) は Redocly が解決するため、本 preprocessor の対象外。

## rule

### `operation-id-naming`

operationId が命名規則に従っているかを検査する。既定の規約は、HTTP メソッド (小文字) と、パスの各セグメントを PascalCase にして連結したもの。

- 各セグメントは英数字以外の文字 (`-`・`_`・`.` 等) で単語に分割し、各単語の先頭を大文字にして連結する (例: `/sitemap.xml` は `SitemapXml`)。
- path param は波括弧を除去して同様に変換し、常に含める (例: `GET /code/{code}` は `getCodeCode`)。
- 検査するのは `paths` 直下の operation だけ。callbacks 内・webhooks・`components.pathItems` の operation と、operationId の無い operation は検査しない。

規約の差し替えは「operationId の規約を差し替える」を参照。

### `description-file-naming`

operation の description を外部 md ファイルに切り出している場合、そのファイル名 (拡張子なし) を operationId と一致させる。

- 対象は `paths` 直下の operation の `description: { $ref: ./descriptions/<x>.md }` のみ。
- `<x>` が operationId と一致しなければ、`description.$ref` の位置に報告する。
- `./descriptions/<x>.md` 形でない `$ref`、インラインの description、operationId の無い operation は検査しない。

### `examples-layout`

root ファイルと同じディレクトリの `examples/` 配下のファイル配置を検査する。`examples/` が無ければ何もしない。

- 対象は `.yaml`・`.yml` のみ。それ以外は無視する。
- 許可する配置は `examples/<スキーマ名>/<ファイル名>.yaml` (深さ 2) のみ。`<スキーマ名>` は `components.schemas` に登録済みの名前。
- 名前が `.` で始まるファイルとディレクトリ (配下を含む) は検査しない。
- `examples` 直下への配置、登録済みスキーマ名でないディレクトリ名、`<スキーマ名>/` の下のサブディレクトリを報告する。

### `no-unreferenced-files`

どこからも `$ref` されていないファイルを検出する。組み込みの `no-unused-components` は `components.schemas` に登録されたものしか検査しないため、登録されていない (参照も無い) ファイルは検出できない。本 rule は `dirs` 配下の全ファイルを列挙し、参照されていないものを報告する。

- オプション `dirs` は root ファイルのあるディレクトリからの相対パス。未指定なら何も検査しない。指定したディレクトリが存在しない (またはディレクトリでない) 場合は、その旨を報告する。
- 名前が `.` で始まるファイルとディレクトリ (`.gitkeep`・`.DS_Store`・`.foo/` 配下等) は検査対象にしない。
- 別名ファイル (`$ref: ./Other.yaml` だけを持つファイル) の連鎖は終点まで辿り、経路上のファイルも参照済みとして扱う。
- 報告の位置は root 直下の相対パスで、ファイル単位で lint-ignore できる。

> [!WARNING]
> `examples` を `dirs` に入れてはいけない。example の `value` 内の `$ref` は参照として辿られないため、誤検出になる。
> `externalValue` や `discriminator.mapping` だけで使われるファイルも参照として辿られず、未参照と報告される。

### `key-order`

node type ごとにキーの順を検査する。検査だけを行い、並べ替えはしない。Redocly CLI の configurable rule には任意の指定順を検査する assertion が無いため、本 rule で補う。

- オプション `orders` は node type 名をキー、キーの順を値にしたオブジェクト。既定値は `{ Parameter: [in, name, required, description, schema] }`。
- 期待する順は、`orders` に載っていてノードに在るキーを `orders` の順に並べ、その後ろに載っていないキーを実際の順のまま並べたもの。載っていないキー同士の順は問わない。
- 実際の順と食い違う最初のキーを、1 ノードにつき 1 件、そのキーの位置に報告する。メッセージにはノードに在るキー全部の実際の順 (actual) と期待する順 (expected) を書く。
- `orders` は node type 名の単位で既定値に上書きする。`Operation` だけを足しても Parameter の既定は残る。ある node type の検査を外すには、その型に空配列を渡す。
- node type 名は `redocly inspect-node-types` で調べられる。

```yaml
rules:
  ansanloms/key-order:
    severity: error
    orders:
      Operation: [operationId, summary, description]
      Parameter: []
```

制限:

- 整数に見えるキー (`"200"` 等) は JavaScript が昇順で先頭に並べるため、そうしたキーを持つ型 (`Responses` 等) では記述順を検査できない。
- 並べ替えはしない。報告に従って手で直す。

## operationId の規約を差し替える

`redocly.yaml` には関数を書けない。規約を差し替えるには、`createPlugin` を呼ぶファイルを利用側に 1 つ置き、`redocly.yaml` の `plugins:` からそのファイルを相対パスで参照する。

`redocly/plugin.js`:

```js
import { createPlugin } from "@ansanloms/redocly-plugins";

export default createPlugin({
  operationId: (method, path) => `${method}${path.replaceAll("/", "")}`,
});
```

`redocly.yaml`:

```yaml
plugins:
  - ./redocly/plugin.js
```

`createPlugin` の引数 `id` で plugin id も変えられる (省略時は `ansanloms`)。plugin id は重複できないため、パッケージ名での参照 (`"@ansanloms/redocly-plugins"`) とは併用しない。

## 動作環境

> [!NOTE]
> Redocly CLI 2.75.0 で動作を確認している。Redocly CLI 2.75.0 の `engines` は `>=22.12.0 || >=20.19.0 <21.0.0` で、Node 20.19 以上 21 未満、または 22.12 以上が必要。

本パッケージは `@redocly/openapi-core` を必須の peerDependency (`>=2.0.0`) として宣言している。`@redocly/openapi-core` がインストールされていない場合は、利用側の devDependencies に追加する。

## 開発

```sh
npm ci
npm test            # テスト
npm run check       # 型チェック
npm run lint        # oxlint && oxfmt --check
npm run fix         # oxlint --fix && oxfmt
npm run compile     # dist/ を消してから生成
```

`dist/` は tsc の出力でコミットする。CI が鮮度を検査する。git 依存はインストール時に
`build` / `prepare` 等のスクリプトが走るため、それらは置かず、コミット済みの `dist/` を配布する。
Node 26 は開発環境の要件で、配布物は素の ESM。`typescript` の更新で `dist/` が変わった場合は、
PR ブランチで `npm run compile` してコミットする。
依存は正確な版で固定し (`.npmrc` の `save-exact`)、更新は Dependabot の PR で取り込む。
`ignore-scripts` で install 時に依存の lifecycle script を実行しない (`npm run` の本体 script には影響しない)。`min-release-age` で公開から 7 日未満の版を新規に解決しない (lockfile に固定済みの版には効かない)。

### リリース手順

1. `npm version <version> --no-git-tag-version` → `npm run compile` → コミット。
2. 同じ値でタグを打って push。GitHub Release は作らない。

## ライセンス

MIT
