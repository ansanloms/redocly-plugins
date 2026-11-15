import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { isYaml, listFiles } from "./files.ts";

const withDir = (files: string[], fn: (dir: string) => void): void => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "files-"));
  try {
    for (const name of files) {
      const file = path.join(dir, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "");
    }
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test("入れ子のファイルを / 区切りの相対パスで列挙する", () => {
  withDir(["a.yaml", "b/c.yaml", "b/d/e.md"], (dir) => {
    assert.deepEqual(listFiles(dir).sort(), ["a.yaml", "b/c.yaml", "b/d/e.md"]);
  });
});

test("ドットファイルとドットディレクトリの配下は除外する", () => {
  withDir([".gitkeep", "a/.hidden.yaml", ".tmp/x.yaml", "a/.b/c/d.yaml", "a/ok.yaml"], (dir) => {
    assert.deepEqual(listFiles(dir), ["a/ok.yaml"]);
  });
});

test("isYaml は .yaml と .yml だけを真にする", () => {
  assert.equal(isYaml("a.yaml"), true);
  assert.equal(isYaml("dir/a.yml"), true);
  assert.equal(isYaml("a.json"), false);
  assert.equal(isYaml("a.yaml.md"), false);
  assert.equal(isYaml("yaml"), false);
});
