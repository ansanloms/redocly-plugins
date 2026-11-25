import assert from "node:assert/strict";
import { test } from "node:test";

import { fixtureDir, lintRule } from "../test/lint.ts";

const base = fixtureDir("enum-schema-naming");

const doc = (schemas: string, extra = ""): string =>
  `openapi: 3.0.3
info: { title: t, version: "1" }
${extra || "paths: {}"}
components:
  schemas:
${schemas}
`;

const run = (source: string) => lintRule("enum-schema-naming", source, base);

test("Enum + 大文字の名前で enum を持てば報告しない", async () => {
  const r = await run(doc("    EnumStatus: { type: string, enum: [a, b] }"));
  assert.deepEqual(r, []);
});

test("名前が Enum で始まらない enum 持ちは登録キーの位置に報告する", async () => {
  const r = await run(doc("    Status: { type: string, enum: [a, b] }"));
  assert.equal(r.length, 1);
  assert.equal(r[0]!.pointer, "#/components/schemas/Status");
  assert.match(r[0]!.message, /actual: Status/);
});

test("名前が Enum + 大文字で enum を持たなければ報告する", async () => {
  const r = await run(doc("    EnumStatus: { type: string }"));
  assert.equal(r.length, 1);
  assert.equal(r[0]!.pointer, "#/components/schemas/EnumStatus");
  assert.match(r[0]!.message, /ルートに enum/);
});

test("Enum の次が ASCII 大文字でない名前は enum 持ちを報告する", async () => {
  const r = await run(
    doc(
      [
        "    Enumeration: { type: string, enum: [a] }",
        "    Enum1: { type: string, enum: [a] }",
        "    Enumstatus: { type: string, enum: [a] }",
      ].join("\n"),
    ),
  );
  assert.deepEqual(
    r.map((v) => v.pointer),
    [
      "#/components/schemas/Enumeration",
      "#/components/schemas/Enum1",
      "#/components/schemas/Enumstatus",
    ],
  );
});

test("Enumeration は enum が無ければ報告しない", async () => {
  const r = await run(doc("    Enumeration: { type: string }"));
  assert.deepEqual(r, []);
});

test("外部ファイルへの $ref で登録しても登録キーで判定する", async () => {
  const ok = await run(doc("    EnumStatus: { $ref: ./EnumStatus.yaml }"));
  assert.deepEqual(ok, []);

  const ng = await run(doc("    Status: { $ref: ./EnumStatus.yaml }"));
  assert.equal(ng.length, 1);
  assert.equal(ng[0]!.pointer, "#/components/schemas/Status");
});

test("paths から先に $ref で参照された登録 schema も検査する", async () => {
  const r = await run(
    doc(
      "    Status: { type: string, enum: [a, b] }",
      `paths:
  /a:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Status" }`,
    ),
  );
  assert.equal(r.length, 1);
  assert.equal(r[0]!.pointer, "#/components/schemas/Status");
});

test("OAS 3.1 の $defs 直下は対象外", async () => {
  const r = await run(`openapi: 3.1.0
info: { title: t, version: "1" }
paths: {}
components:
  schemas:
    EnumStatus:
      type: string
      enum: [a]
    Holder:
      type: object
      $defs:
        Inner: { type: string, enum: [a] }
`);
  assert.deepEqual(r, []);
});

test("components.schemas を $ref で分けても登録キーで判定する", async () => {
  const r = await run(
    'openapi: 3.0.3\ninfo: { title: t, version: "1" }\npaths: {}\ncomponents:\n  schemas: { $ref: ./SplitSchemas.yaml }\n',
  );
  assert.deepEqual(
    r.map((v) => [v.file, v.pointer]),
    [["SplitSchemas.yaml", "#/Status"]],
  );
});

test("components を $ref で分けても登録キーで判定する", async () => {
  const r = await run(
    'openapi: 3.0.3\ninfo: { title: t, version: "1" }\npaths: {}\ncomponents: { $ref: ./SplitComponents.yaml }\n',
  );
  assert.deepEqual(
    r.map((v) => [v.file, v.pointer]),
    [["SplitComponents.yaml", "#/schemas/Status"]],
  );
});

test("値なしの登録 schema があっても例外にならず、その node は報告しない", async () => {
  const r = await run(
    doc("    Empty:\n    Foo:\n      type: object\n      properties:\n        a:"),
  );
  assert.deepEqual(r, []);
});

test("OAS 3.1 で $ref の隣に書いた enum は見ず、参照先だけを見る", async () => {
  const r = await run(`openapi: 3.1.0
info: { title: t, version: "1" }
paths: {}
components:
  schemas:
    Base: { type: string }
    EnumFoo: { $ref: "#/components/schemas/Base", enum: [a] }
`);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.pointer, "#/components/schemas/EnumFoo");
  assert.match(r[0]!.message, /ルートに enum/);
});
