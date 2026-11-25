# operation-id-naming

operationId が命名規則に従うことを要求する。

operationId をパスと HTTP メソッドから機械的に決められるようにして、名前の揺れをなくす。

## 詳細

既定の規約は HTTP メソッド (小文字) と、パスの各セグメントを PascalCase にして連結したもの。

- 各セグメントは英数字以外の文字 (`-`・`_`・`.` 等) で単語に分割し、各単語の先頭を大文字にして連結する (例: `/sitemap.xml` は `SitemapXml`)。
- path param は波括弧を除去して同様に変換し、常に含める (例: `GET /code/{code}` は `getCodeCode`)。

検査するのは `paths` 直下の operation だけ。callbacks 内・webhooks・`components.pathItems` の operation と、operationId の無い operation は検査しない。

違反は operation の `operationId` の位置に報告する。報告メッセージは次の形になる。

```text
operationId が命名規則に従っていません (actual: getUser, expected: getUsersId)。
```

この rule に**違反する**例は次のとおり。

```yaml
paths:
  /users/{id}:
    get:
      operationId: getUser
```

この rule に**適合する**例は次のとおり。

```yaml
paths:
  /users/{id}:
    get:
      operationId: getUsersId
  /sitemap.xml:
    get:
      operationId: getSitemapXml
```

## オプション

オプションは無い。規約を差し替えるには、`createPlugin` の引数 `operationId` に関数を渡す。手順は [README の「operationId の規約を差し替える」](../../README.md#operationid-の規約を差し替える) を参照。

## 使わない場合

operationId の名前を自由に決めたい場合や、規約が既存の API と合わない場合は、この rule を有効にしない。

## 関連する rule

- [description-file-naming](./description-file-naming.md)

## リソース

- [rule の実装](../../rules/operation-id-naming.ts)
- [テスト](../../rules/operation-id-naming.test.ts)
