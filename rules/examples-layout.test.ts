import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { lintRule } from "../test/lint.ts";
import { findExampleLayoutViolations } from "./examples-layout.ts";

const schemas = new Set(["Item", "Content"]);

test("<Schema>/<File>.yaml の配置は違反としない", () => {
  assert.deepEqual(
    findExampleLayoutViolations(["Item/Example.yaml", "Content/A.yaml"], schemas),
    [],
  );
});

test("examples 直下の yaml は違反とする", () => {
  const result = findExampleLayoutViolations(["Item.yaml"], schemas);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.entry, "examples/Item.yaml");
  assert.match(result[0]!.message, /Item\.yaml/);
});

test("深さ 3 以上の yaml は違反とする", () => {
  const result = findExampleLayoutViolations(["Item/sub/Example.yaml"], schemas);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.entry, "examples/Item/sub/Example.yaml");
  assert.match(result[0]!.message, /サブディレクトリ/);
});

test("スキーマ名でないディレクトリの yaml は違反とする", () => {
  const result = findExampleLayoutViolations(["Unknown/Example.yaml"], schemas);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.entry, "examples/Unknown/Example.yaml");
  assert.match(result[0]!.message, /スキーマ名ではありません/);
});

test("深さ 3 以上かつスキーマ名でないディレクトリは両方を報告する", () => {
  const result = findExampleLayoutViolations(["Unknown/sub/Example.yaml"], schemas);
  assert.equal(result.length, 2);
  assert.ok(result.every((v) => v.entry === "examples/Unknown/sub/Example.yaml"));
  assert.ok(result.some((v) => /スキーマ名ではありません/.test(v.message)));
  assert.ok(result.some((v) => /サブディレクトリ/.test(v.message)));
});

test("yaml 以外のファイルは無視する", () => {
  assert.deepEqual(
    findExampleLayoutViolations(["a.pdf", "Unknown/b.pdf", "Item/c/d.pdf"], schemas),
    [],
  );
});

test(".yml も対象とする", () => {
  assert.deepEqual(findExampleLayoutViolations(["Item/Example.yml"], schemas), []);
  assert.equal(findExampleLayoutViolations(["Item.yml", "Unknown/Example.yml"], schemas).length, 2);
});

/** 一時ディレクトリに `files` を作り、root 文書 `source` を lint した報告を返す。 */
const lint = async (source: string, files: string[]) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "examples-layout-"));
  try {
    for (const name of files) {
      const file = path.join(base, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "summary: x\n");
    }
    return await lintRule("examples-layout", source, base);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
};

const root = `openapi: 3.1.0
info: { title: t, version: "1" }
paths: {}
components:
  schemas:
    Item:
      type: object
      $defs:
        Inner: { type: string }
`;

test("components.schemas のキーのディレクトリは報告しない", async () => {
  assert.deepEqual(await lint(root, ["examples/Item/a.yaml"]), []);
});

test("$defs のキー名のディレクトリは登録の無い名前として報告する", async () => {
  const reports = await lint(root, ["examples/Inner/a.yaml"]);
  assert.equal(reports.length, 1);
  assert.match(reports[0]!.message, /スキーマ名ではありません/);
});

test("definitions のキー名のディレクトリは登録の無い名前として報告する", async () => {
  const legacyRoot = `openapi: 3.1.0
info: { title: t, version: "1" }
paths: {}
components:
  schemas:
    Item:
      type: object
      definitions:
        Legacy: { type: string }
`;
  const reports = await lint(legacyRoot, ["examples/Legacy/a.yaml"]);
  assert.equal(reports.length, 1);
  assert.match(reports[0]!.message, /スキーマ名ではありません/);
});

test("報告の pointer とメッセージは root のディレクトリからの相対にする", async () => {
  const reports = await lint(root, ["examples/Unknown/a.yaml"]);
  assert.equal(reports.length, 1);
  assert.equal(reports[0]!.pointer, "#/examples~1Unknown~1a.yaml");
  assert.match(reports[0]!.message, /\(examples\/Unknown\/a\.yaml\)/);
});
