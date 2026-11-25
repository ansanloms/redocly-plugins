import assert from "node:assert/strict";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { createConfig, lint } from "@redocly/openapi-core";

import { schemaNameFromRef } from "./request-response-schema-naming.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = join(root, "test/fixtures/request-response-schema-naming");

test("schemaNameFromRef: ファイル参照は拡張子を除いた名前", () => {
  assert.equal(schemaNameFromRef("../components/schemas/User.yaml"), "User");
  assert.equal(schemaNameFromRef("./RequestFoo.yml"), "RequestFoo");
});

test("schemaNameFromRef: フラグメントは JSON Pointer の最後のセグメント", () => {
  assert.equal(schemaNameFromRef("#/components/schemas/ResponseFoo"), "ResponseFoo");
  assert.equal(schemaNameFromRef("./a.yaml#/components/schemas/RequestBar"), "RequestBar");
});

test("schemaNameFromRef: 拡張子の無いファイル参照はそのまま", () => {
  assert.equal(schemaNameFromRef("./schemas/User"), "User");
});

test("schemaNameFromRef: ~1 と ~0 を戻す", () => {
  assert.equal(schemaNameFromRef("#/components/schemas/Response~1Foo"), "Response/Foo");
  assert.equal(schemaNameFromRef("#/components/schemas/Response~0Foo"), "Response~Foo");
});

const run = async () => {
  const config = await createConfig({
    plugins: [join(root, "index.ts")],
    rules: { "ansanloms/request-response-schema-naming": "error" },
  });
  const results = await lint({ ref: join(fixture, "openapi.yaml"), config });
  return results
    .filter((v) => v.ruleId === "ansanloms/request-response-schema-naming")
    .map((v) => ({
      message: v.message,
      file: relative(fixture, v.location[0]!.source.absoluteRef),
      pointer: v.location[0]!.pointer,
    }))
    .sort((a, b) => `${a.file}${a.pointer}`.localeCompare(`${b.file}${b.pointer}`));
};

test("fixture の違反だけを位置つきで報告する", async () => {
  const actual = await run();
  const request = (name: string) =>
    `requestBody が参照する schema の名前が Request + 大文字で始まっていません (actual: ${name})。`;
  const response = (name: string) =>
    `response が参照する schema の名前が Response + 大文字で始まっていません (actual: ${name})。`;
  const inline = (label: string, prefix: string) =>
    `${label} の schema がインラインで定義されています。${prefix} で始まる schema を $ref で参照してください。`;

  assert.deepEqual(actual, [
    {
      file: "openapi.yaml",
      pointer: "#/paths/~1bad-inline-request/post/requestBody/content/application~1json/schema",
      message: inline("requestBody", "Request"),
    },
    {
      file: "openapi.yaml",
      pointer: "#/paths/~1bad-media-type/get/responses/200/content/application~1json",
      message: response("User"),
    },
    {
      file: "openapi.yaml",
      pointer: "#/paths/~1bad-request/post/requestBody/content/application~1json/schema/$ref",
      message: request("User"),
    },
    {
      file: "openapi.yaml",
      pointer: "#/paths/~1bad-response/get/responses/200/content/application~1json/schema/$ref",
      message: response("User"),
    },
    {
      file: "openapi.yaml",
      pointer: "#/paths/~1bad-response/get/responses/201/content/application~1json/schema",
      message: inline("response", "Response"),
    },
    {
      file: "openapi.yaml",
      pointer: "#/paths/~1bad-response/get/responses/202/content/application~1json/schema",
      message: inline("response", "Response"),
    },
    {
      file: "openapi.yaml",
      pointer:
        "#/paths/~1bad-response/get/responses/203/content/application~1jsonl/itemSchema/$ref",
      message: response("User"),
    },
    {
      file: "requestBodies/Bad.yaml",
      pointer: "#/content/application~1json/schema/$ref",
      message: request("User"),
    },
    {
      file: "responses/Bad.yaml",
      pointer: "#/content/application~1json/schema/$ref",
      message: response("User"),
    },
    {
      file: "responses/BadMedia.yaml",
      pointer: "#/content/application~1json",
      message: response("User"),
    },
  ]);
});
