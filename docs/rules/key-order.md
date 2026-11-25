# key-order

node type ごとに決めた順でキーを書くことを要求する。

Redocly CLI の configurable rule には、任意の指定順を検査する assertion が無い。この rule で補う。検査だけを行い、並べ替えはしない。

## 詳細

期待する順は `orders` に載っていてノードに在るキーを `orders` の順に並べ、その後ろに載っていないキーを実際の順のまま並べたもの。載っていないキー同士の順は問わない。

実際の順と食い違う最初のキーを、1 ノードにつき 1 件、そのキーの位置に報告する。メッセージにはノードに在るキー全部の実際の順 (actual) と期待する順 (expected) を書く。

```text
キーの順が規約と一致していません (actual: [name, in, schema], expected: [in, name, schema])。
```

制限は次のとおり。

- 整数に見えるキー (`"200"` 等) は JavaScript が昇順で先頭に並べるため、そうしたキーを持つ型 (`Responses` 等) では記述順を検査できない。
- 並べ替えはしない。報告に従って手で直す。

既定の設定で、この rule に**違反する**例は次のとおり。

```yaml
parameters:
  - name: id
    in: query
    schema:
      type: string
```

同じ設定で、この rule に**適合する**例は次のとおり。

```yaml
parameters:
  - in: query
    name: id
    required: true
    description: 利用者の ID。
    schema:
      type: string
```

## オプション

### `orders`

- 型: node type 名をキー、キーの順を値にしたオブジェクト
- 既定値: `{ Parameter: [in, name, required, description, schema] }`

`orders` は node type 名の単位で既定値に上書きする。`Operation` だけを足しても Parameter の既定は残る。ある node type の検査を外すには、その型に空配列を渡す。

node type 名は `redocly inspect-node-types` で調べられる。

```yaml
rules:
  ansanloms/key-order:
    severity: error
    orders:
      Operation: [operationId, summary, description]
      Parameter: []
```

## 使わない場合

キーの順を揃える必要が無い場合や、フォーマッタでキーの順を揃える場合は、この rule を有効にしない。

## 関連する rule

なし。

## リソース

- [rule の実装](../../rules/key-order.ts)
- [テスト](../../rules/key-order.test.ts)
