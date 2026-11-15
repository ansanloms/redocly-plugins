import fs from "node:fs";
import path from "node:path";

/**
 * `dir` 配下のファイルを再帰的に列挙し、`dir` からの相対パス (区切りは `/`) で返す。
 * パスのいずれかのセグメントが `.` で始まるもの (ドットファイル、ドットディレクトリの配下) は除く。
 */
export const listFiles = (dir: string): string[] =>
  fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((v) => v.isFile())
    .map((v) => path.relative(dir, path.join(v.parentPath, v.name)).split(path.sep).join("/"))
    .filter((v) => !v.split("/").some((s) => s.startsWith(".")));

/** `.yaml`・`.yml` のファイルか。 */
export const isYaml = (file: string): boolean => /\.ya?ml$/.test(file);
