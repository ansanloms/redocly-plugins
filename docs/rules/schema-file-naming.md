# schema-file-naming

`components.schemas` の登録を、キー名と対応するファイルへの `$ref` だけにすることを要求する。

schema は 1 ファイルに 1 つ書き、`$ref` で登録する規約のもと、キー名とファイル名のずれを検出する。

## 詳細

root ファイルの `components.schemas` の各エントリを、次の 3 点で検査する。

- キー名が PascalCase (`/^[A-Z][a-zA-Z0-9]+$/`)。1 文字の名前は違反。
- 値が `$ref` だけのオブジェクト。インラインの schema は違反。
- `$ref` がキー名と対応していること。許可する `$ref` は `./components/schemas/<キー名>.yaml` または `.yml` のみ。ディレクトリ違い・拡張子違い・キー名とのずれは違反。

報告位置は、キー名の違反がキー、値の違反がエントリの値、`$ref` の違反が `$ref` の値。キー名の違反と、値・`$ref` の違反は独立に報告する。

検査しないものは次のとおり。

- root ファイル以外に置かれた `components.schemas`
- `$ref` 先のファイルの実在
- `components.schemas` 自体を `$ref` で別ファイルに出した場合 (`schemas: { $ref: ./schemas.yaml }`)

報告メッセージは次のとおり。

```text
components.schemas のキー名が PascalCase ではありません (user)。
components.schemas の値は $ref のみにしてください (User)。
$ref が components.schemas のキー名と対応していません (actual: ./schemas/Account.yaml, expected: ./components/schemas/User.yaml)。
```

この rule に**違反する**例は次のとおり。

```yaml
components:
  schemas:
    user:
      $ref: ./components/schemas/user.yaml
    Item:
      type: object
    User:
      $ref: ./schemas/Account.yaml
```

この rule に**適合する**例は次のとおり。

```yaml
components:
  schemas:
    User:
      $ref: ./components/schemas/User.yaml
```

## オプション

オプションは無い。

## 使わない場合

schema を `components.schemas` にインラインで書く運用や、ファイルの置き場が別の規約に従う運用では、この rule を有効にしない。

## 関連する rule

- [description-file-naming](./description-file-naming.md)
- [request-response-schema-naming](./request-response-schema-naming.md)

## リソース

- [rule の実装](../../rules/schema-file-naming.ts)
- [テスト](../../rules/schema-file-naming.test.ts)
