/**
 * `dir` 配下のファイルを再帰的に列挙し、`dir` からの相対パス (区切りは `/`) で返す。
 * パスのいずれかのセグメントが `.` で始まるもの (ドットファイル、ドットディレクトリの配下) は除く。
 */
export declare const listFiles: (dir: string) => string[];
/** `.yaml`・`.yml` のファイルか。 */
export declare const isYaml: (file: string) => boolean;
