# request-response-schema-naming

エンドポイントの requestBody は `Request*`、response は `Response*` の schema だけを参照することを要求する。

リクエストとレスポンスの schema を名前で区別し、生成されるコードやドキュメントで取り違えないようにする。

## 詳細

対象は `paths` 直下の operation の requestBody と response の `content.<media type>` の `schema` と `itemSchema`。`$ref` 先のファイルの中も、operation から参照されていれば検査する。

- schema の名前は `$ref` 文字列の末尾から決める。`#` より後ろがあればその最後のセグメント、無ければファイル名 (拡張子なし)。
- requestBody は `Request` + 大文字、response は `Response` + 大文字で始まらなければ、`$ref` の位置に報告する。
- インラインの schema (`$ref` を持たないもの) は報告する。`type: array` + `items: $ref` もインラインとして報告する。
- media type 自体が `$ref` の場合は、報告を media type の位置に出す。
- `schema` も `itemSchema` も無い media type (`example` だけのもの等) は検査しない。
- `headers.<name>.content`、callbacks 内・webhooks・`components.pathItems` の operation、どの operation からも参照されない `components.responses` は検査しない。
- 同じ `$ref` 先のファイルを複数の operation が参照していても、報告は 1 件にまとめる。

報告メッセージは次のとおり。

```text
requestBody が参照する schema の名前が Request + 大文字で始まっていません (actual: User)。
response が参照する schema の名前が Response + 大文字で始まっていません (actual: User)。
requestBody の schema がインラインで定義されています。Request で始まる schema を $ref で参照してください。
response の schema がインラインで定義されています。Response で始まる schema を $ref で参照してください。
```

この rule に**違反する**例は次のとおり。

```yaml
paths:
  /users:
    post:
      operationId: postUsers
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/User"
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
```

この rule に**適合する**例は次のとおり。

```yaml
paths:
  /users:
    post:
      operationId: postUsers
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/RequestUser"
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ResponseUser"
```

### 本体が enum の response

response の本体が enum の場合、`Enum*` の schema を直接参照すると、この rule が報告する。[enum-schema-naming](./enum-schema-naming.md) は `enum` を持つ schema の名前を `Enum*` に要求するので、`Response*` の名前に `enum` を直接書くこともできない。

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

接頭辞は固定で、オプションは無い。

## 使わない場合

schema の名前に接頭辞を付けない運用では、この rule を有効にしない。

## 関連する rule

- [enum-schema-naming](./enum-schema-naming.md)
- [no-inline-enum](./no-inline-enum.md)
- [schema-file-naming](./schema-file-naming.md)

## リソース

- [rule の実装](../../rules/request-response-schema-naming.ts)
- [テスト](../../rules/request-response-schema-naming.test.ts)
