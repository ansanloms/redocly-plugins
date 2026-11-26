# inline-datavalue

OpenAPI 3.2 の Example オブジェクトの `dataValue` の中にあるファイル参照を、bundle 時にインライン展開する。

Example を別ファイルに切り出して書きつつ、bundle 後の文書には値を埋め込む。Redocly は 3.2 の `dataValue` の中の `$ref` を解決しないので、この preprocessor で補う。`value` を展開する [inline-examples](./inline-examples.md) とは独立で、片方だけ有効にしてもよい。

## 詳細

oas3 の `Example` を訪問し、`dataValue` の中を再帰的に歩いて `$ref` を展開する。インラインの MediaType・Parameter の examples、`$ref` で取り込んだ response/requestBody の examples、`components.examples` のいずれでも動く。`$ref` 先の YAML は `node:fs` で読み込み、`@redocly/openapi-core` の `parseYaml` でパースする。

`serializedValue` には触れない。`value` にも触れない。

### 対応する OpenAPI のバージョン

oas3 の preprocessor として登録されるので、OAS 3.0/3.1 の文書でも Example に `dataValue` があれば展開する。3.0/3.1 では `dataValue` は仕様外の欄なので、Redocly の struct rule が報告する。展開の挙動は 3.2 と変わらない。

### 必要な `@redocly/openapi-core`

OAS 3.2 の文書を扱える `@redocly/openapi-core` が必要。2.79.0 で動作を確認している。

### 展開するもの

- 展開するのは、`#` を含まない・URL でない・絶対パスでない、拡張子が `.yaml` または `.yml` (小文字) の `$ref` だけ。
- 参照先は参照元のファイルのディレクトリからの相対パスで解決し、参照先の中の `$ref` も参照先のファイルのディレクトリを基準に再帰的に展開する。
- `{ $ref: ./x.yaml }` だけのオブジェクトは参照先の値 (配列・スカラー・null を含む) でそのまま置き換える。空のファイルは `null` になる。
- `$ref` と同じ階層に他のキーがある場合は、参照先がオブジェクトのときだけ合成する。キーの並びは元のオブジェクトの順で、`$ref` の位置に参照先のキーが入る。同名のキーは、`$ref` の前後どちらに書いても兄弟のキーを優先する。

### 触れないもの

- `serializedValue` と `value` は展開しない。`value` を展開するときは [inline-examples](./inline-examples.md) を有効にする。

### 展開しないもの

- URL・絶対パス・`#` を含む参照の `$ref` は、そのまま残す。
- スキーマの `properties.examples` や JSON Schema の `examples` は Example オブジェクトではないので対象外。
- Example オブジェクトそのものが `$ref` の場合 (`examples: { a: { $ref: ./a.yaml } }`) は Redocly が解決するため対象外。

### YAML でないファイルの参照

- `#` を含まない・URL でない・絶対パスでない相対パスで、拡張子が `.yaml`/`.yml` 以外 (`.pdf`・`.json` 等) の `$ref` は、参照先のファイルが在れば `$ref` キーを除く。兄弟のキーは残り、`$ref` だけのオブジェクトは `{}` になる。報告はしない。
- 参照先が無ければ (ディレクトリ・stat の失敗を含む) `dataValue` の位置に報告し、`$ref` を残す。
- 参照先のファイルの中に書かれたものも同じ。YAML として展開できないファイル参照を、bundle 後の文書に残さないための扱い。

### 報告

- 循環参照、ファイルの読み込み失敗 (ファイルが無い・ディレクトリ・YAML の文法エラー・複数ドキュメント)、参照先が無い非 YAML の相対パス、兄弟のキーがあるのに参照先がオブジェクトでないものは、`dataValue` の位置に報告し、その `$ref` を展開せずに残す。
- 報告には `$ref` の文字列・参照元と参照先のファイルを含め、パスは Example のファイルのディレクトリからの相対パスで示す。
- `redocly.yaml` で `error` (または `on`) にすれば lint と bundle が失敗する。

### `$ref` の書き直し

- 取り込んだファイルの中に展開されずに残る相対パスの `$ref` (`#` 付きの参照、循環・読み込み失敗・参照先が無い非 YAML で残したもの) は、bundle 後も正しいファイルを指すよう、Example のファイルのディレクトリを基準にしたパスへ書き直す。
- URL・絶対パス・`#` で始まる参照と、Example の `dataValue` に直接書いた参照は書き直さない。

報告メッセージは次のとおり。

```text
参照先のファイルがありません ($ref: ./examples/none.pdf、参照元: openapi.yaml、参照先: examples/none.pdf)。
参照先を読み込めません ($ref: ./examples/none.yaml、参照元: openapi.yaml、参照先: examples/none.yaml)。原因: <読み込みの失敗の理由>
参照が循環しています ($ref: ./a.yaml、参照元: examples/b.yaml、参照先: examples/a.yaml)。ファイルの連鎖: openapi.yaml -> examples/a.yaml -> examples/b.yaml -> examples/a.yaml。
$ref と同じ階層に他のキーがありますが、参照先がオブジェクトではありません ($ref: ./examples/a.yaml、参照元: openapi.yaml、参照先: examples/a.yaml)。
```

この preprocessor で展開される例は次のとおり。

```yaml
# openapi.yaml
components:
  examples:
    UserExample:
      dataValue:
        $ref: ./examples/a.yaml
```

```yaml
# examples/a.yaml
name: foo
tags: [a]
```

bundle すると、`dataValue` は次のようになる。

```yaml
components:
  examples:
    UserExample:
      dataValue:
        name: foo
        tags: [a]
```

兄弟のキーを書くと、参照先と合成する。同名のキーは兄弟のキーを優先する。

```yaml
# openapi.yaml
dataValue:
  $ref: ./examples/a.yaml
  name: bar
```

```yaml
# examples/a.yaml
name: foo
age: 3
```

bundle すると、`dataValue` は `{ age: 3, name: bar }` になる。

展開されずに報告される例 (参照先のファイルが無い) は次のとおり。

```yaml
components:
  examples:
    UserExample:
      dataValue:
        $ref: ./examples/none.yaml
```

## オプション

オプションは無い。有効にするには、`redocly.yaml` の `preprocessors:` に書く。

```yaml
preprocessors:
  ansanloms/inline-datavalue: on
```

## 使わない場合

Example の `dataValue` にファイル参照を書かない場合は、この preprocessor を有効にしない。

## 関連する rule

- [examples-layout](../rules/examples-layout.md)
- [no-unreferenced-files](../rules/no-unreferenced-files.md)

## リソース

- [preprocessor の実装](../../preprocessors/inline-datavalue.ts)
- [テスト](../../index.test.ts)
