# schema-description

`components.schemas` に登録した schema のルートに description があることを要求する。

登録した schema は API の部品として再利用される。ルートの description で、何を表す schema かを読めるようにする。

## 詳細

対象は `components.schemas` 直下の schema だけ。`properties`・`items`・`allOf` 等のネストした schema と、`$defs`・`definitions` は検査しない。

- description の書き方は問わない。インライン文字列でも `./descriptions/<x>.md` への `$ref` でも、在れば通す。参照先ファイルの存在は見ない。
- `$ref` だけのエイリアスは参照先 (終点) の description で判定する。
- description が無い・`null`・空白だけの文字列のとき、その schema のルートに報告する。同じ schema は 1 回だけ報告する。

報告メッセージは次のとおり。

```text
components.schemas に登録した schema のルートに description がありません。
```

この rule に**違反する**例は次のとおり。

```yaml
components:
  schemas:
    User:
      type: object
```

この rule に**適合する**例は次のとおり。

```yaml
components:
  schemas:
    User:
      type: object
      description: ユーザ。
    Account:
      type: object
      description:
        $ref: ./descriptions/Account.md
```

## オプション

オプションは無い。

## 使わない場合

schema の説明を description で持たない運用では、この rule を有効にしない。

## 関連する rule

- [description-file-naming](./description-file-naming.md)

## リソース

- [rule の実装](../../rules/schema-description.ts)
- [テスト](../../rules/schema-description.test.ts)
