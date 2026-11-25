# description-file-naming

外部 md ファイルに切り出した description のファイル名を、定義の名前と一致させることを要求する。

description の md ファイルが、どの operation・schema のものかをファイル名から読めるようにする。

## 詳細

operation と `components.schemas` 直下の schema を検査する。対象は `description: { $ref: ./descriptions/<x>.md }` の形のものだけで、`<x>` はサブディレクトリを含まないファイル名 (拡張子なし)。`./descriptions/<x>.md` の形でない `$ref`、インラインの description は検査しない。

違反は `description.$ref` の位置に報告する。

### operation

- 対象は `paths` 直下の operation。callbacks 内・webhooks・`components.pathItems` の operation は対象外。
- `<x>` を operationId と比べる。operationId の無い operation は検査しない。

### schema

- 対象は `components.schemas` 直下の schema。`$defs`・`definitions` は対象外。
- `<x>` を、schema の定義の名前と比べる。比べる相手は schema の定義の位置で決まる。
  - 別ファイルのルートに在る schema は、そのファイル名 (拡張子なし)。
  - 検査している `schemas` の map の直下に定義が在る schema は、その定義のキー名。root に直書きの場合、`components` を別ファイルに分けた場合、`schemas` だけを別ファイルに分けた場合が当たる。
  - 別のファイルの中を指すフラグメント付きの参照先 (`./x.yaml#/User`、`./x.yaml#/components/schemas/User` 等) は、登録した `components.schemas` のキー名。
- 制限: 同じフラグメント付きの参照先を 2 つ以上のキーが指す場合は、先に訪問されたキーと比べる。結果はキーの並び順で変わりうる。

報告メッセージは次のとおり。

```text
description のファイル名が operationId と一致していません (actual: listUsers, expected: getUsers)。
description のファイル名がスキーマ名と一致していません (actual: Account, expected: User)。
description のファイル名が定義ファイル名と一致していません (actual: Account, expected: User)。
```

この rule に**違反する**例は次のとおり。

```yaml
paths:
  /users:
    get:
      operationId: getUsers
      description:
        $ref: ./descriptions/listUsers.md
components:
  schemas:
    User:
      type: object
      description:
        $ref: ./descriptions/Account.md
```

この rule に**適合する**例は次のとおり。

```yaml
paths:
  /users:
    get:
      operationId: getUsers
      description:
        $ref: ./descriptions/getUsers.md
components:
  schemas:
    User:
      type: object
      description:
        $ref: ./descriptions/User.md
```

schema を別ファイルに置く場合は、そのファイル名と揃える。

```yaml
# components/schemas/User.yaml
type: object
description:
  $ref: ./descriptions/User.md
```

## オプション

オプションは無い。

## 使わない場合

description をインラインで書く運用や、md のファイル名に別の規約を使う運用では、この rule を有効にしない。

## 関連する rule

- [operation-id-naming](./operation-id-naming.md)
- [schema-description](./schema-description.md)
- [schema-file-naming](./schema-file-naming.md)

## リソース

- [rule の実装](../../rules/description-file-naming.ts)
- [テスト](../../rules/description-file-naming.test.ts)
