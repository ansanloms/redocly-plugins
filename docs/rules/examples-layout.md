# examples-layout

`examples/` 配下のファイルを `<スキーマ名>/<ファイル名>.yaml` に置くことを要求する。

example をスキーマごとのディレクトリに集め、どの schema の example かをパスから読めるようにする。

## 詳細

root ファイルと同じディレクトリの `examples/` 配下を検査する。`examples/` が無ければ何もしない。

- 対象は `.yaml`・`.yml` のみ。それ以外は無視する。
- 許可する配置は `examples/<スキーマ名>/<ファイル名>.yaml` (深さ 2) のみ。`<スキーマ名>` は登録済みのスキーマ名で、`components.schemas` のキーが当たる。OAS 3.1 の `$defs`・`definitions` のキーは登録済みとして扱わない。
- 名前が `.` で始まるファイルとディレクトリ (配下を含む) は検査しない。
- 次を報告する。
  - `examples` 直下への配置
  - 登録済みスキーマ名でないディレクトリ名
  - `<スキーマ名>/` の下のサブディレクトリ

報告はファイル単位で、位置は root ファイルの中の、root ファイルのあるディレクトリからの相対パスを 1 つのキーとみなした位置 (例: `#/examples~1User~1sub~1a.yaml`)。ファイル単位で lint-ignore できる。1 ファイルに複数の問題があれば、問題ごとに 1 件報告する。

報告メッセージは次のとおり。

```text
examples 直下に example を置けません (examples/a.yaml)。examples/<スキーマ名>/<ファイル名>.yaml の形で配置してください。
examples 配下のディレクトリ名が登録済みのスキーマ名ではありません (examples/Unknown/a.yaml)。ディレクトリ名はスキーマ名に一致させてください。
examples/<スキーマ名>/ の下にサブディレクトリを作れません (examples/User/sub/a.yaml)。examples/<スキーマ名>/<ファイル名>.yaml の形で配置してください。
```

`components.schemas` に `User` だけを登録している場合に、この rule に**違反する**例は次のとおり。

```text
examples/
├── a.yaml            # examples 直下
├── Unknown/
│   └── a.yaml        # 登録済みのスキーマ名でない
└── User/
    └── sub/
        └── a.yaml    # サブディレクトリ
```

同じ場合に、この rule に**適合する**例は次のとおり。

```text
examples/
├── memo.pdf          # YAML 以外は無視する
└── User/
    ├── .gitkeep      # `.` で始まる名前は無視する
    ├── a.yaml
    └── b.yml
```

## オプション

オプションは無い。

## 使わない場合

example を `examples/` に置かない運用や、置き方が別の規約に従う運用では、この rule を有効にしない。

## 関連する rule

- [no-unreferenced-files](./no-unreferenced-files.md)

## リソース

- [rule の実装](../../rules/examples-layout.ts)
- [テスト](../../rules/examples-layout.test.ts)
