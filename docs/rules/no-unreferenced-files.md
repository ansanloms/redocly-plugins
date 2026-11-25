# no-unreferenced-files

どこからも `$ref` されていないファイルを置くことを禁止する。

組み込みの `no-unused-components` は `components.schemas` に登録されたものしか検査しないため、登録されていない (参照も無い) ファイルは検出できない。この rule は `dirs` 配下の全ファイルを列挙し、参照されていないものを報告する。

## 詳細

`dirs` 配下のファイルのうち、`$ref` で辿れないものを報告する。

- 名前が `.` で始まるファイルとディレクトリ (`.gitkeep`・`.DS_Store`・`.foo/` 配下等) は検査対象にしない。
- root ファイルは検査対象にしない。
- 別名ファイル (`$ref: ./Other.yaml` だけを持つ YAML) の連鎖は終点まで辿り、経路上のファイルも参照済みとして扱う。別名ファイルの判定は YAML (`.yaml`・`.yml`) に限る。
- 指定したディレクトリが存在しない (またはディレクトリでない) 場合は、その旨を報告する。

報告の位置は root ファイルの中の、root ファイルのあるディレクトリからの相対パスを 1 つのキーとみなした位置 (例: `#/paths~1users~1orphan.yaml`)。ファイル単位で lint-ignore できる。

報告メッセージは次のとおり。

```text
どこからも参照されていないファイルです (paths/users/orphan.yaml)。
検査対象のディレクトリがありません (components)。
```

`dirs: [paths]` で、root ファイルが `./paths/users/ok.yaml` だけを参照している場合に、この rule に**違反する**例は次のとおり。

```text
paths/
└── users/
    ├── ok.yaml       # 参照されている
    └── orphan.yaml   # どこからも参照されていない
```

同じ場合に、この rule に**適合する**例は次のとおり。

```text
paths/
├── .gitkeep          # `.` で始まる名前は無視する
└── users/
    └── ok.yaml
```

> [!WARNING]
> Example の `value` から参照するファイルの置き場を `dirs` に入れてはいけない。`examples/` に限らず、`components/examples/` を含む。`value` 内の `$ref` は参照として辿られないため、誤検出になる。
> `externalValue` や `discriminator.mapping` だけで使われるファイルも参照として辿られず、未参照と報告される。

## オプション

### `dirs`

- 型: `string[]`
- 既定値: 未指定 (何も検査しない)

検査するディレクトリ。root ファイルのあるディレクトリからの相対パスで指定する。

```yaml
rules:
  ansanloms/no-unreferenced-files:
    severity: error
    dirs: [paths, components]
```

## 使わない場合

`$ref` で辿れないファイルを意図して置く運用や、検査したいディレクトリが Example の `value` からだけ参照される運用では、この rule を有効にしない。

## 関連する rule

- [examples-layout](./examples-layout.md)

## リソース

- [rule の実装](../../rules/no-unreferenced-files.ts)
- [テスト](../../rules/no-unreferenced-files.test.ts)
