import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import plugin, { createPlugin, expectedOperationId, preprocessors } from "./index.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "test/fixtures");

const visitor = preprocessors["inline-examples"]({});
const leave = (target: unknown) => {
  const ctx = {
    location: { source: { absoluteRef: join(fixtures, "operation.yaml") } },
  };
  (visitor.Operation as { leave: (...args: unknown[]) => void }).leave(target, ctx);
};

test("plugin は id と inline-examples preprocessor を持つ", () => {
  const p = plugin();
  assert.equal(p.id, "ansanloms");
  assert.equal(typeof p.preprocessors.oas3["inline-examples"], "function");
});

test("examples 配下の yaml $ref のみ再帰的に展開する", () => {
  const target = {
    requestBody: {
      content: {
        "application/json": {
          schema: { $ref: "./schema.yaml" },
          examples: { a: { $ref: "./examples/request.yaml" } },
        },
      },
    },
    responses: {
      "200": {
        content: {
          "application/json": {
            examples: {
              b: { $ref: "./examples/response.yaml" },
              c: { $ref: "./examples/other.json" },
            },
          },
        },
      },
    },
  };
  leave(target);

  const req = target.requestBody.content["application/json"];
  assert.deepEqual(req.examples.a, {
    value: { id: 1, nested: { name: "child" } },
  });
  assert.deepEqual(req.schema, { $ref: "./schema.yaml" });

  const res = target.responses["200"].content["application/json"];
  assert.deepEqual(res.examples.b, { value: { ok: true } });
  assert.deepEqual(res.examples.c, { $ref: "./examples/other.json" });
});

test("requestBody / responses が無くても例外にならない", () => {
  assert.doesNotThrow(() => leave({}));
});

test("リテラルセグメントと同名のパラメータも省略しない", () => {
  assert.equal(expectedOperationId("get", "/products/by/code/{code}"), "getProductsByCodeCode");
  assert.equal(expectedOperationId("get", "/by/code/{code}"), "getByCodeCode");
});

test("同名パラメータの有無で期待値が異なる (/code と /code/{code})", () => {
  assert.equal(expectedOperationId("get", "/code"), "getCode");
  assert.equal(expectedOperationId("get", "/code/{code}"), "getCodeCode");
});

test("パラメータは PascalCase に変換して残す", () => {
  assert.equal(expectedOperationId("get", "/products/{id}"), "getProductsId");
  assert.equal(
    expectedOperationId("delete", "/members/me/addresses/{address-id}"),
    "deleteMembersMeAddressesAddressId",
  );
  assert.equal(
    expectedOperationId("post", "/recommend/content/{measure_account_id}"),
    "postRecommendContentMeasureAccountId",
  );
});

test("英数字以外の文字で単語に分割する", () => {
  assert.equal(expectedOperationId("post", "/aid/receive"), "postAidReceive");
  assert.equal(expectedOperationId("get", "/sitemap.xml"), "getSitemapXml");
  assert.equal(expectedOperationId("get", "/gift-messagecards"), "getGiftMessagecards");
});

test("末尾スラッシュは無視する", () => {
  assert.equal(expectedOperationId("get", "/products/"), "getProducts");
});

test("連続するパラメータも省略しない", () => {
  assert.equal(expectedOperationId("get", "/a/{a}/{b}"), "getAAB");
});

test("ルートパスはメソッド名のみになる", () => {
  assert.equal(expectedOperationId("get", "/"), "get");
});

test("メソッドは小文字化する", () => {
  assert.equal(expectedOperationId("GET", "/carts"), "getCarts");
});

test("createPlugin は既定の規約で operation-id-naming・description-file-naming・examples-layout・no-unreferenced-files を持つ", () => {
  const p = createPlugin()();
  assert.equal(p.id, "ansanloms");
  assert.deepEqual(Object.keys(p.rules.oas3).sort(), [
    "description-file-naming",
    "examples-layout",
    "no-unreferenced-files",
    "operation-id-naming",
  ]);
  assert.deepEqual(Object.keys(p.preprocessors.oas3), ["inline-examples"]);
});

test("createPlugin は id を差し替えられる", () => {
  assert.equal(createPlugin({ id: "x" })().id, "x");
});

test("default export を呼ぶと id が ansanloms の plugin になる", () => {
  assert.equal(typeof plugin, "function");
  assert.equal(plugin().id, "ansanloms");
});
