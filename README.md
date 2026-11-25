# redocly-plugins

Redocly CLI (`@redocly/openapi-core`) の preprocessor と rule をまとめた plugin (`@ansanloms/redocly-plugins`)。

npm には publish せず、GitHub のタグを git 依存で参照する。

## 構成

plugin id は `ansanloms`。`redocly.yaml` では `ansanloms/<名前>` で参照する。
preprocessor も rule も、`redocly.yaml` で有効化したものだけが動く。

| 種別         | 名前                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| preprocessor | [`inline-examples`](./docs/preprocessors/inline-examples.md)                       |
| rule         | [`operation-id-naming`](./docs/rules/operation-id-naming.md)                       |
| rule         | [`description-file-naming`](./docs/rules/description-file-naming.md)               |
| rule         | [`schema-description`](./docs/rules/schema-description.md)                         |
| rule         | [`examples-layout`](./docs/rules/examples-layout.md)                               |
| rule         | [`no-unreferenced-files`](./docs/rules/no-unreferenced-files.md)                   |
| rule         | [`key-order`](./docs/rules/key-order.md)                                           |
| rule         | [`request-response-schema-naming`](./docs/rules/request-response-schema-naming.md) |
| rule         | [`enum-schema-naming`](./docs/rules/enum-schema-naming.md)                         |
| rule         | [`no-inline-enum`](./docs/rules/no-inline-enum.md)                                 |
| rule         | [`schema-file-naming`](./docs/rules/schema-file-naming.md)                         |

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
  ansanloms/schema-description: error
  ansanloms/examples-layout: error
  ansanloms/no-unreferenced-files:
    severity: error
    dirs: [paths, components]
  ansanloms/key-order: error
  ansanloms/request-response-schema-naming: error
  ansanloms/enum-schema-naming: error
  ansanloms/no-inline-enum: error
  ansanloms/schema-file-naming: error
```

## rule と preprocessor

各 rule の検査内容・オプション・違反例と適合例は [rule 一覧](./docs/rules/README.md)にまとめている。preprocessor `inline-examples` は [docs/preprocessors/inline-examples.md](./docs/preprocessors/inline-examples.md) を参照。

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
> `@redocly/openapi-core` 2.79.0 でテストしている。Redocly CLI 2.79.0 の `engines` は `>=22.12.0 || >=20.19.0 <21.0.0` で、Node 20.19 以上 21 未満、または 22.12 以上が必要。

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
