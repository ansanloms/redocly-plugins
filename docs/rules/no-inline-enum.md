# no-inline-enum

`enum` をインラインに書くことを禁止する。

`enum` は `Enum*` の schema に切り出して `$ref` で参照する。同じ値の集合を複数の場所に書き散らさないようにする。

## 詳細

`enum` を持つ schema のうち、`components.schemas` 直下に登録されたもの以外を報告する。

- `properties`・`items`・`allOf` 等の要素・`additionalProperties`・parameter・requestBody・response・header のインライン schema と、OAS 3.1 の `$defs` 配下が当たる。
- `components.schemas` に登録していないファイルを `$ref` で参照し、そのルートに `enum` がある場合も報告する。規約上は登録すべきものとして扱う。
- 報告の位置は `enum` キー。
- `const` は対象外。
- OAS 3.1 で `$ref` の隣に書いた `enum` は見ない。`$ref` の参照先だけを見る。

報告メッセージは次のとおり。

```text
enum はインラインに書かず、Enum* の schema に切り出して $ref で参照してください。
```

この rule に**違反する**例は次のとおり。

```yaml
components:
  schemas:
    User:
      type: object
      description: ユーザ。
      properties:
        status:
          type: string
          enum: [active, inactive]
```

この rule に**適合する**例は次のとおり。

```yaml
components:
  schemas:
    User:
      type: object
      description: ユーザ。
      properties:
        status:
          $ref: "#/components/schemas/EnumStatus"
    EnumStatus:
      type: string
      enum: [active, inactive]
```

## オプション

オプションは無い。

## 使わない場合

`enum` をインラインで書く運用では、この rule を有効にしない。

## 関連する rule

- [enum-schema-naming](./enum-schema-naming.md)
- [request-response-schema-naming](./request-response-schema-naming.md)

## リソース

- [rule の実装](../../rules/no-inline-enum.ts)
- [テスト](../../rules/no-inline-enum.test.ts)
