import assert from "node:assert/strict";
import { test } from "node:test";

import { fixtureDir, lintRule } from "../test/lint.ts";

const base = fixtureDir("no-inline-enum");

const doc = (schemas: string, paths = "paths: {}", version = "3.0.3"): string =>
  `openapi: ${version}
info: { title: t, version: "1" }
${paths}
components:
  schemas:
${schemas}
`;

const run = (source: string) => lintRule("no-inline-enum", source, base);

const pointers = (r: { pointer: string }[]): string[] => r.map((v) => v.pointer);

test("登録 schema のルートの enum は報告しない (直書き・外部ファイル)", async () => {
  const r = await run(
    doc(
      [
        "    EnumA: { type: string, enum: [a] }",
        "    EnumStatus: { $ref: ./EnumStatus.yaml }",
      ].join("\n"),
    ),
  );
  assert.deepEqual(r, []);
});

test("properties・items・allOf・additionalProperties のインライン enum を報告する", async () => {
  const r = await run(
    doc(`    Foo:
      type: object
      properties:
        a: { type: string, enum: [x] }
        b:
          type: array
          items: { type: string, enum: [x] }
        c:
          allOf:
            - { type: string, enum: [x] }
        d:
          type: object
          additionalProperties: { type: string, enum: [x] }`),
  );
  assert.deepEqual(pointers(r).sort(), [
    "#/components/schemas/Foo/properties/a/enum",
    "#/components/schemas/Foo/properties/b/items/enum",
    "#/components/schemas/Foo/properties/c/allOf/0/enum",
    "#/components/schemas/Foo/properties/d/additionalProperties/enum",
  ]);
});

test("外部ファイルの schema の中のインライン enum を報告する", async () => {
  const r = await run(doc("    Foo: { $ref: ./HasInline.yaml }"));
  assert.equal(r.length, 1);
  assert.equal(r[0]!.file, "HasInline.yaml");
  assert.equal(r[0]!.pointer, "#/properties/kind/enum");
});

test("parameter・requestBody・response のインライン schema の enum を報告する", async () => {
  const r = await run(
    doc(
      "    EnumA: { type: string, enum: [a] }",
      `paths:
  /a:
    post:
      parameters:
        - name: p
          in: query
          schema: { type: string, enum: [x] }
      requestBody:
        content:
          application/json:
            schema: { type: string, enum: [x] }
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema: { type: string, enum: [x] }`,
    ),
  );
  assert.deepEqual(pointers(r).sort(), [
    "#/paths/~1a/post/parameters/0/schema/enum",
    "#/paths/~1a/post/requestBody/content/application~1json/schema/enum",
    "#/paths/~1a/post/responses/200/content/application~1json/schema/enum",
  ]);
});

test("登録済み Enum* への $ref は複数箇所から参照しても報告しない", async () => {
  const r = await run(
    doc(
      `    EnumA: { type: string, enum: [a] }
    Foo:
      type: object
      properties:
        a: { $ref: "#/components/schemas/EnumA" }
        b: { $ref: "#/components/schemas/EnumA" }`,
      `paths:
  /a:
    get:
      parameters:
        - name: p
          in: query
          schema: { $ref: "#/components/schemas/EnumA" }
      responses:
        "200": { description: ok }`,
    ),
  );
  assert.deepEqual(r, []);
});

test("paths から先に $ref で参照された登録 schema のルートの enum は報告しない", async () => {
  const r = await run(
    doc(
      "    EnumA: { type: string, enum: [a] }",
      `paths:
  /a:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema: { $ref: "#/components/schemas/EnumA" }`,
    ),
  );
  assert.deepEqual(r, []);
});

test("未登録の外部ファイルをルートが enum のまま参照すると報告する", async () => {
  const r = await run(
    doc("    Foo: { type: object, properties: { a: { $ref: ./Unregistered.yaml } } }"),
  );
  assert.equal(r.length, 1);
  assert.equal(r[0]!.file, "Unregistered.yaml");
  assert.equal(r[0]!.pointer, "#/enum");
});

test("const だけのインライン schema は報告しない", async () => {
  const r = await run(
    doc(
      "    Foo: { type: object, properties: { a: { type: string, const: x } } }",
      "paths: {}",
      "3.1.0",
    ),
  );
  assert.deepEqual(r, []);
});

test("OAS 3.1 の $defs 配下の enum を報告する", async () => {
  const r = await run(
    doc(
      `    Holder:
      type: object
      $defs:
        Inner: { type: string, enum: [a] }`,
      "paths: {}",
      "3.1.0",
    ),
  );
  assert.deepEqual(pointers(r), ["#/components/schemas/Holder/$defs/Inner/enum"]);
});

const rawDoc = (components: string): string => `openapi: 3.0.3
info: { title: t, version: "1" }
paths: {}
components:
${components}
`;

test("components.schemas を $ref で分けても登録 schema のルートの enum は報告しない", async () => {
  const r = await run(rawDoc("  schemas: { $ref: ./SplitSchemas.yaml }"));
  assert.deepEqual(
    r.map((v) => [v.file, v.pointer]),
    [["SplitSchemas.yaml", "#/Holder/properties/kind/enum"]],
  );
});

test("components を $ref で分けても登録 schema のルートの enum は報告しない", async () => {
  const r = await run(
    'openapi: 3.0.3\ninfo: { title: t, version: "1" }\npaths: {}\ncomponents: { $ref: ./SplitComponents.yaml }\n',
  );
  assert.deepEqual(
    r.map((v) => [v.file, v.pointer]),
    [["SplitComponents.yaml", "#/schemas/Holder/properties/kind/enum"]],
  );
});

test("値なしの登録 schema・property があっても例外にならず、その node は報告しない", async () => {
  const r = await run(
    doc(`    Empty:
    Foo:
      type: object
      properties:
        a:`),
  );
  assert.deepEqual(r, []);
});

test("OAS 3.1 で $ref の隣に書いた enum は見ず、参照先だけを見る", async () => {
  const r = await run(
    doc(
      `    EnumStatus: { type: string, enum: [a] }
    Foo:
      type: object
      properties:
        a: { $ref: "#/components/schemas/EnumStatus", enum: [a] }`,
      "paths: {}",
      "3.1.0",
    ),
  );
  assert.deepEqual(r, []);
});
