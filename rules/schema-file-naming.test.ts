import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { createConfig, lint } from "@redocly/openapi-core";

import { fixtureDir, lintRule } from "../test/lint.ts";
import { findSchemaRegistrationViolations, SchemaFileNaming } from "./schema-file-naming.ts";

const find = findSchemaRegistrationViolations;
const ref = (name: string) => ({ $ref: `./components/schemas/${name}` });

test(".yaml と .yml の正常な登録は報告しない", () => {
  assert.deepEqual(find({ User: ref("User.yaml"), Cart: ref("Cart.yml") }), []);
});

test("空のマップは報告しない", () => {
  assert.deepEqual(find({}), []);
});

test("キー名とファイル名の不一致は ref を報告する", () => {
  const v = find({ User: ref("Account.yaml") });
  assert.equal(v.length, 1);
  assert.equal(v[0]!.target, "ref");
  assert.match(v[0]!.message, /actual: \.\/components\/schemas\/Account\.yaml/);
  assert.match(v[0]!.message, /expected: \.\/components\/schemas\/User\.yaml/);
});

test("ディレクトリ違い・拡張子違いは ref を報告する", () => {
  assert.deepEqual(
    find({ User: { $ref: "./other/User.yaml" } }).map((v) => v.target),
    ["ref"],
  );
  assert.deepEqual(
    find({ User: ref("User.json") }).map((v) => v.target),
    ["ref"],
  );
});

test("インラインの schema は value を報告し、ref は検査しない", () => {
  const v = find({ User: { type: "object" } });
  assert.deepEqual(
    v.map((x) => x.target),
    ["value"],
  );
});

test("$ref と他のキーの同居、文字列でない $ref は value を報告する", () => {
  assert.deepEqual(
    find({ User: { ...ref("User.yaml"), description: "x" } }).map((v) => v.target),
    ["value"],
  );
  assert.deepEqual(
    find({ User: { $ref: 1 } }).map((v) => v.target),
    ["value"],
  );
});

test("PascalCase でないキーは key を報告する", () => {
  for (const key of ["user", "user_name", "A"]) {
    const v = find({ [key]: ref(`${key}.yaml`) });
    assert.deepEqual(
      v.map((x) => x.target),
      ["key"],
      key,
    );
  }
});

test("PascalCase 違反と $ref 違反は同時に報告する", () => {
  assert.deepEqual(
    find({ user: ref("User.yaml") }).map((v) => v.target),
    ["key", "ref"],
  );
});

// Redocly の visitor を模した最小の文脈でルールを駆動する。
interface TestVisitor {
  Root: {
    enter: (target: unknown, ctx: { location: { source: { absoluteRef: string } } }) => void;
  };
  NamedSchemas: { enter: (schemas: unknown, ctx: FakeCtx) => void };
}
interface FakeCtx {
  location: {
    source: { absoluteRef: string };
    child: (path: string[]) => { path: string[]; key: () => { path: string[]; kind: "key" } };
  };
  report: (problem: { message: string; location: unknown }) => void;
}

const drive = (schemas: unknown, enterRef: string) => {
  const reported: { message: string; location: unknown }[] = [];
  const visitor = (SchemaFileNaming as unknown as (options: unknown) => TestVisitor)({});
  visitor.Root.enter({}, { location: { source: { absoluteRef: "/root.yaml" } } });
  visitor.NamedSchemas.enter(schemas, {
    location: {
      source: { absoluteRef: enterRef },
      child: (path) => ({ path, key: () => ({ path, kind: "key" }) }),
    },
    report: (problem) => reported.push(problem),
  });
  // key() を通った位置は kind: "key"、通っていない位置は kind: "child" に正規化する。
  return reported.map((r) => {
    const loc = r.location as { path: string[]; kind?: string };
    return { message: r.message, location: { path: loc.path, kind: loc.kind ?? "child" } };
  });
};

test("報告位置は key・value・$ref で異なる", () => {
  const reported = drive({ bad: { type: "object" }, User: ref("Account.yaml") }, "/root.yaml");
  assert.deepEqual(
    reported.map((r) => r.location),
    [
      { path: ["bad"], kind: "key" },
      { path: ["bad"], kind: "child" },
      { path: ["User", "$ref"], kind: "child" },
    ],
  );
});

test("root 以外のファイルの components.schemas は報告しない", () => {
  assert.deepEqual(drive({ bad: { type: "object" } }, "/other.yaml"), []);
});

test("Redocly で未解決の $ref が NamedSchemas に渡り、違反を報告する", async () => {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const config = await createConfig({
    plugins: [join(root, "index.ts")],
    rules: { "ansanloms/schema-file-naming": "error" },
  });
  const problems = await lint({
    ref: join(root, "test/fixtures/schema-file-naming/openapi.yaml"),
    config,
  });
  const mine = problems.filter((p) => p.ruleId === "ansanloms/schema-file-naming");
  assert.equal(mine.length, 3);
  const at = (pointer: string) => {
    const found = mine.filter((p) => p.location[0]?.pointer === pointer);
    assert.equal(found.length, 1, pointer);
    return found[0]!;
  };
  const key = at("#/components/schemas/lowerCase");
  assert.equal(
    key.message,
    "components.schemas のキー名が PascalCase ではありません (lowerCase)。",
  );
  assert.equal(key.location[0]?.reportOnKey, true);
  const mismatch = at("#/components/schemas/Mismatch/$ref");
  assert.equal(
    mismatch.message,
    "$ref が components.schemas のキー名と対応していません (actual: ./components/schemas/Other.yaml, expected: ./components/schemas/Mismatch.yaml)。",
  );
  assert.notEqual(mismatch.location[0]?.reportOnKey, true);
  const inline = at("#/components/schemas/Inline");
  assert.equal(inline.message, "components.schemas の値は $ref のみにしてください (Inline)。");
  assert.notEqual(inline.location[0]?.reportOnKey, true);
});

const inlineDefs = (keyword: string): string => `openapi: 3.1.0
info: { title: t, version: "1" }
paths:
  /a:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                ${keyword}:
                  foo: { type: string }
components:
  schemas:
    User: { $ref: ./components/schemas/User.yaml }
`;

test("インライン schema の $defs は components.schemas として検査しない", async () => {
  const r = await lintRule(
    "schema-file-naming",
    inlineDefs("$defs"),
    fixtureDir("schema-file-naming"),
  );
  assert.deepEqual(r, []);
});

test("インライン schema の definitions は components.schemas として検査しない", async () => {
  const r = await lintRule(
    "schema-file-naming",
    inlineDefs("definitions"),
    fixtureDir("schema-file-naming"),
  );
  assert.deepEqual(r, []);
});
