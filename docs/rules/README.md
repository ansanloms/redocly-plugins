# rule 一覧

`redocly.yaml` で `ansanloms/<rule 名>` として有効化する。plugin の導入と設定は [README](../../README.md) を参照。

## 命名

| rule                                                                  | 説明                                                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [operation-id-naming](./operation-id-naming.md)                       | operationId を、HTTP メソッドとパスから導いた名前に揃えることを要求する                     |
| [description-file-naming](./description-file-naming.md)               | 外部 md に切り出した description のファイル名を、定義の名前に揃えることを要求する           |
| [schema-file-naming](./schema-file-naming.md)                         | `components.schemas` の登録を、キー名と対応するファイルへの `$ref` だけにすることを要求する |
| [request-response-schema-naming](./request-response-schema-naming.md) | requestBody と response が `Request*`・`Response*` の schema だけを参照することを要求する   |
| [enum-schema-naming](./enum-schema-naming.md)                         | `enum` を持つ schema と `Enum*` という名前の対応を要求する                                  |

## 構造

| rule                                          | 説明                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| [schema-description](./schema-description.md) | `components.schemas` に登録した schema のルートに description があることを要求する |
| [no-inline-enum](./no-inline-enum.md)         | `enum` をインラインに書くことを禁止する                                            |
| [key-order](./key-order.md)                   | node type ごとに決めた順でキーを書くことを要求する                                 |

## ファイル配置

| rule                                                | 説明                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [examples-layout](./examples-layout.md)             | `examples/` 配下のファイルを `<スキーマ名>/<ファイル名>.yaml` に置くことを要求する |
| [no-unreferenced-files](./no-unreferenced-files.md) | どこからも `$ref` されていないファイルを置くことを禁止する                         |

preprocessor は [inline-examples](../preprocessors/inline-examples.md) と [inline-datavalue](../preprocessors/inline-datavalue.md) を参照。
