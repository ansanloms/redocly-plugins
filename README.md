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

## 利用

インストール:

```sh
npm install -D github:ansanloms/redocly-plugins#0.1.0
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
```

## preprocessor

### `inline-examples`

OpenAPI の `examples` 配下にある `$ref: *.yaml` を、bundle 時にインライン展開する oas3 preprocessor。

oas3 の `Operation` の `requestBody` / `responses` を走査し、`examples` の値に含まれる
`$ref: *.yaml` を再帰的に解決して内容をインライン展開する。`$ref` 先の YAML は
`node:fs` で読み込む。

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
> Redocly CLI 2.75.0 で動作を確認している。Redocly CLI 2.x は Node 20.19 以上または 22.12 以上が必要。

本パッケージは `@redocly/openapi-core` を optional な peerDependency として宣言している。TypeScript から型を参照する場合は `@redocly/openapi-core` を devDependencies に入れる。

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
