# enum-schema-naming

`enum` を持つ schema と `Enum*` という名前の対応を要求する。

`enum` は `Enum*` の名前で `components.schemas` に切り出す規約を前提とする。名前を見れば enum かどうかが分かるようにする。

## 詳細

対象は `components.schemas` 直下に登録した schema だけ。判定は登録キーで行い、登録が外部ファイルへの `$ref` でも登録キーで判定する。

- `enum` をルートに持つのに、名前が `Enum` + 大文字 (ASCII) で始まらない場合を報告する。
- 名前が `Enum` + 大文字で始まるのに、ルートに `enum` が無い場合を報告する。
- `Enumeration`・`Enum1`・`Enumstatus` は `Enum` + 大文字ではない。`enum` を持てば報告し、持たなければ報告しない。
- 報告の位置は `components.schemas` の登録キー。
- OAS 3.1 の `$defs`・`definitions` 直下の schema は対象外。
- OAS 3.1 で `$ref` の隣に書いた `enum` は見ない。`$ref` の参照先だけを見る。

報告メッセージは次のとおり。

```text
enum を持つ schema の名前は Enum + 大文字で始めてください (actual: Status)。
名前が Enum + 大文字で始まる schema はルートに enum を持たせてください (actual: EnumKind)。
```

この rule に**違反する**例は次のとおり。

```yaml
components:
  schemas:
    Status:
      type: string
      enum: [active, inactive]
    EnumKind:
      type: string
```

この rule に**適合する**例は次のとおり。

```yaml
components:
  schemas:
    EnumStatus:
      type: string
      enum: [active, inactive]
```

### 本体が enum の response

[request-response-schema-naming](./request-response-schema-naming.md) は response の schema の名前を `Response*` に要求するので、本体が enum の response は `Enum*` を直接参照できない。`enum` を `Response*` の schema に直接書くと、この rule が報告する。

`Response*` の schema から `allOf` で `Enum*` を参照すると、両方の rule が報告しない。

```yaml
paths:
  /status:
    get:
      operationId: getStatus
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ResponseStatus"
components:
  schemas:
    EnumStatus:
      type: string
      enum: [active, inactive]
      description: 状態。
    ResponseStatus:
      description: 状態の取得結果。
      allOf:
        - $ref: "#/components/schemas/EnumStatus"
```

## オプション

オプションは無い。

## 使わない場合

enum の schema を `Enum*` の名前で切り出さない運用では、この rule を有効にしない。

## 関連する rule

- [no-inline-enum](./no-inline-enum.md)
- [request-response-schema-naming](./request-response-schema-naming.md)

## リソース

- [rule の実装](../../rules/enum-schema-naming.ts)
- [テスト](../../rules/enum-schema-naming.test.ts)
