import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { bundle, createConfig, lint } from "@redocly/openapi-core";

import plugin, { createPlugin, expectedOperationId, preprocessors } from "./index.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "test/fixtures");
const inlineFixtures = join(fixtures, "inline-examples");

type Report = { message: string; location: unknown };

const visitor = preprocessors["inline-examples"]({});

/** 偽の ctx で Example.leave を呼び、node.value と報告を返す。 */
const run = (value: unknown, file = "example.yaml", v = visitor) => {
  const reports: Report[] = [];
  const node = value === undefined ? {} : { value };
  const ctx = {
    location: {
      source: { absoluteRef: resolve(inlineFixtures, file) },
      child: (pointer: string[]) => ({ pointer }),
    },
    report: (r: Report) => reports.push(r),
  };
  (v.Example as { leave: (...args: unknown[]) => void }).leave(node, ctx);
  return { node: node as { value?: unknown }, reports };
};

test("plugin は id と inline-examples preprocessor を持つ", () => {
  const p = plugin();
  assert.equal(p.id, "ansanloms");
  assert.equal(typeof p.preprocessors.oas3["inline-examples"], "function");
});

test("value の中の $ref を参照先で置き換え、参照先の $ref も参照先のディレクトリを基準に展開する", () => {
  const { node, reports } = run({ $ref: "./obj.yaml" });
  assert.deepEqual(node.value, { id: 1, nested: { name: "child", deep: { leaf: true } } });
  assert.deepEqual(reports, []);
});

test("配列の要素の $ref を展開する", () => {
  const { node } = run([{ $ref: "./sub/leaf.yaml" }, 1, { k: { $ref: "./sub/leaf.yaml" } }]);
  assert.deepEqual(node.value, [{ leaf: true }, 1, { k: { leaf: true } }]);
});

test("参照先が配列・スカラーならそのまま入る", () => {
  assert.deepEqual(run({ list: { $ref: "./list.yaml" } }).node.value, { list: [1, "two"] });
  assert.deepEqual(run({ s: { $ref: "./scalar.yaml" } }).node.value, { s: "hello" });
  assert.deepEqual(run({ $ref: "./scalar.yaml" }).node.value, "hello");
});

test(".yml を展開する", () => {
  assert.deepEqual(run({ x: { $ref: "./ext.yml" } }).node.value, { x: { ext: "yml" } });
});

test("兄弟のキーが勝ち、$ref の前後どちらに書いても同じ値になる。キーは $ref の位置に入る", () => {
  const before = run({ b: "sibling", $ref: "./base.yaml", d: "sibling" }).node.value;
  const after = run({ $ref: "./base.yaml", b: "sibling", d: "sibling" }).node.value;
  assert.deepEqual(before, { b: "sibling", a: "from-ref", c: "from-ref", d: "sibling" });
  assert.deepEqual(after, { a: "from-ref", c: "from-ref", b: "sibling", d: "sibling" });
  assert.deepEqual(before, after);
  assert.deepEqual(Object.keys(before as object), ["b", "a", "c", "d"]);
  assert.deepEqual(Object.keys(after as object), ["a", "c", "b", "d"]);
});

test("兄弟のキーとの合成でも、参照先の中の実在する非 YAML の相対パスの $ref は落とし、兄弟のキーが勝つ。報告はしない", () => {
  const { node, reports } = run({ b: "sibling", $ref: "./drop-in-base.yaml" });
  assert.deepEqual(node.value, {
    b: "sibling",
    a: "from-ref",
    doc: {},
    nested: { list: [{ keep: 1 }] },
  });
  assert.deepEqual(reports, []);
});

test("兄弟のキーがあり参照先がオブジェクトでなければ、報告して $ref を残す", () => {
  const { node, reports } = run({ $ref: "./scalar.yaml", other: { $ref: "./sub/leaf.yaml" } });
  assert.equal(reports.length, 1);
  assert.match(reports[0]!.message, /\.\/scalar\.yaml/);
  assert.deepEqual(reports[0]!.location, { pointer: ["value"] });
  assert.deepEqual(node.value, { $ref: "./scalar.yaml", other: { leaf: true } });
});

test("兄弟のキーがあり参照先がオブジェクトでなければ、参照先の中身は展開せず報告は 1 件だけ", () => {
  const { node, reports } = run({ $ref: "./list-broken.yaml", other: 1 });
  assert.equal(reports.length, 1);
  assert.match(reports[0]!.message, /オブジェクトではありません/);
  assert.deepEqual(node.value, { $ref: "./list-broken.yaml", other: 1 });
});

test("報告のメッセージに $ref・参照元・参照先を Example のディレクトリからの相対パスで含める", () => {
  const nested = run({ $ref: "./sub/broken-ref.yaml" });
  assert.equal(nested.reports.length, 1);
  assert.equal(
    nested.reports[0]!.message.split("原因:")[0],
    "参照先を読み込めません ($ref: ./no-such.yaml、参照元: sub/broken-ref.yaml、参照先: sub/no-such.yaml)。",
  );
  assert.deepEqual(nested.node.value, { x: { $ref: "./sub/no-such.yaml" } });

  const cycle = run({ $ref: "./cycle-a.yaml" });
  assert.equal(
    cycle.reports[0]!.message,
    "参照が循環しています ($ref: ./cycle-a.yaml、参照元: cycle-b.yaml、参照先: cycle-a.yaml)。ファイルの連鎖: example.yaml -> cycle-a.yaml -> cycle-b.yaml -> cycle-a.yaml。",
  );

  const sibling = run({ $ref: "./sub/scalar.yaml", other: 1 });
  assert.equal(
    sibling.reports[0]!.message,
    "$ref と同じ階層に他のキーがありますが、参照先がオブジェクトではありません ($ref: ./sub/scalar.yaml、参照元: example.yaml、参照先: sub/scalar.yaml)。",
  );
});

test("参照先のファイルの中の実在する非 YAML の相対パスの $ref は落とし、不在で残る $ref は Example のディレクトリ基準に書き直して報告する (# 始まり・URL は変えない)", () => {
  const { node, reports } = run({ $ref: "./sub/rewrite.yaml" });
  assert.deepEqual(node.value, {
    json: { $ref: "./sub/data.json" },
    hash: { $ref: "./sub/leaf.yaml#/leaf" },
    parent: {},
    hidden: { $ref: "./sub/.hidden/x.json" },
    cycle: { $ref: "./sub/rewrite.yaml" },
    local: { $ref: "#/foo" },
    url: { $ref: "https://example.com/a.yaml" },
  });
  assert.equal(reports.length, 3);
  assert.equal(reports.filter((r) => /循環/.test(r.message)).length, 1);
  assert.equal(reports.filter((r) => /参照先のファイルがありません/.test(r.message)).length, 2);
});

test("参照先のファイルから Example のファイルへ戻る参照は、最初の 1 回で循環として報告する", () => {
  const { node, reports } = run({ $ref: "./back-ref.yaml" }, "example-self.yaml");
  assert.equal(reports.length, 1);
  assert.match(reports[0]!.message, /循環/);
  assert.match(
    reports[0]!.message,
    /ファイルの連鎖: example-self\.yaml -> back-ref\.yaml -> example-self\.yaml。/,
  );
  assert.deepEqual(node.value, { back: { $ref: "./example-self.yaml" } });
});

test("同じ壊れた参照を複数箇所から参照しても報告は 1 件にまとめ、異なる文面はそれぞれ報告する", () => {
  const same = run([{ $ref: "./no-such.yaml" }, { k: { $ref: "./no-such.yaml" } }]);
  assert.equal(same.reports.length, 1);
  assert.deepEqual(same.reports[0]!.location, { pointer: ["value"] });

  const diff = run([{ $ref: "./no-such-1.yaml" }, { $ref: "./no-such-2.yaml" }]);
  assert.equal(diff.reports.length, 2);
  assert.match(diff.reports[0]!.message, /no-such-1/);
  assert.match(diff.reports[1]!.message, /no-such-2/);
});

test("循環参照は報告して展開せず、例外にも無限再帰にもならない", () => {
  const { node, reports } = run({ $ref: "./cycle-a.yaml" });
  assert.equal(reports.length, 1);
  assert.match(reports[0]!.message, /cycle-a\.yaml.*cycle-b\.yaml.*cycle-a\.yaml/);
  assert.deepEqual(node.value, { next: { next: { $ref: "./cycle-a.yaml" } } });
});

test("存在しないファイル・パースできないファイルは報告して $ref を残す", () => {
  const missing = run({ $ref: "./no-such.yaml" });
  assert.equal(missing.reports.length, 1);
  assert.match(missing.reports[0]!.message, /\.\/no-such\.yaml/);
  assert.deepEqual(missing.node.value, { $ref: "./no-such.yaml" });

  const dir = fs.mkdtempSync(join(os.tmpdir(), "inline-examples-"));
  try {
    fs.writeFileSync(join(dir, "broken.yaml"), "a: [\n");
    fs.writeFileSync(join(dir, "multi.yaml"), "a: 1\n---\nb: 2\n");
    for (const name of ["broken.yaml", "multi.yaml"]) {
      const { node, reports } = run({ $ref: `./${name}` }, join(dir, "example.yaml"));
      assert.equal(reports.length, 1);
      assert.deepEqual(node.value, { $ref: `./${name}` });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("URL・絶対パス・# を含む参照は報告せずそのまま残す", () => {
  const value = {
    url: { $ref: "https://example.com/a.yaml" },
    abs: { $ref: "/etc/a.yaml" },
    hash: { $ref: "./base.yaml#/a" },
  };
  const { node, reports } = run(structuredClone(value));
  assert.deepEqual(node.value, value);
  assert.deepEqual(reports, []);
});

test("実在する展開できない相対ファイル参照は $ref キーだけを除き、兄弟のキーと順序は保つ。報告はしない", () => {
  for (const input of [
    { $ref: "./manual.pdf", type: "string", format: "binary" },
    { type: "string", $ref: "./manual.pdf", format: "binary" },
    { type: "string", format: "binary", $ref: "./manual.pdf" },
  ]) {
    const { node, reports } = run(input);
    assert.deepEqual(node.value, { type: "string", format: "binary" });
    assert.deepEqual(Object.keys(node.value as object), ["type", "format"]);
    assert.deepEqual(reports, []);
  }
});

test("$ref だけの実在する非 YAML の相対パスは {} になる", () => {
  const { node, reports } = run({ $ref: "./data.json" });
  assert.deepEqual(node.value, {});
  assert.deepEqual(reports, []);
});

test("配列の要素とネストしたオブジェクトの中の実在する非 YAML の相対パスの $ref も落とす", () => {
  const { node, reports } = run({
    list: [{ $ref: "./data.json" }, { keep: 1, $ref: "./manual.pdf" }],
    nested: { deep: { $ref: "./data.json", name: "x" } },
  });
  assert.deepEqual(node.value, {
    list: [{}, { keep: 1 }],
    nested: { deep: { name: "x" } },
  });
  assert.deepEqual(reports, []);
});

test("存在しない非 YAML の相対参照は報告して $ref を残す。報告に $ref・参照元・参照先を含める", () => {
  const { node, reports } = run({ $ref: "./no-such.pdf" });
  assert.deepEqual(node.value, { $ref: "./no-such.pdf" });
  assert.equal(reports.length, 1);
  assert.deepEqual(reports[0]!.location, { pointer: ["value"] });
  assert.equal(
    reports[0]!.message,
    "参照先のファイルがありません ($ref: ./no-such.pdf、参照元: example.yaml、参照先: no-such.pdf)。",
  );

  const nested = run({ $ref: "./sub/rewrite.yaml" });
  assert.ok(
    nested.reports.some(
      (r) =>
        r.message ===
        "参照先のファイルがありません ($ref: ./data.json、参照元: sub/rewrite.yaml、参照先: sub/data.json)。",
    ),
  );
});

test("ディレクトリを指す参照は報告して残す", () => {
  const { node, reports } = run({ $ref: "./sub" });
  assert.deepEqual(node.value, { $ref: "./sub" });
  assert.equal(reports.length, 1);
  assert.match(reports[0]!.message, /参照先のファイルがありません/);
});

test("同じ不在の参照を複数箇所に書いても報告は 1 件にまとまる", () => {
  const { node, reports } = run([
    { $ref: "./no-such.pdf" },
    { k: { $ref: "./no-such.pdf", a: 1 } },
  ]);
  assert.equal(reports.length, 1);
  assert.deepEqual(node.value, [{ $ref: "./no-such.pdf" }, { k: { $ref: "./no-such.pdf", a: 1 } }]);
});

test("# を含む非 YAML の参照は存在確認せず報告なしで残す", () => {
  const { node, reports } = run({ $ref: "./a.json#/x" });
  assert.deepEqual(node.value, { $ref: "./a.json#/x" });
  assert.deepEqual(reports, []);
});

test("拡張子の無い相対パスと大文字の拡張子 (./A.YAML) は展開対象ではなく、不在なので報告して残す", () => {
  const { node, reports } = run({
    noExt: { $ref: "./data" },
    upper: { $ref: "./A.YAML" },
  });
  assert.deepEqual(node.value, { noExt: { $ref: "./data" }, upper: { $ref: "./A.YAML" } });
  assert.equal(reports.length, 2);
});

test("value が無い・スカラーの Example では何も起きない", () => {
  const none = run(undefined);
  assert.deepEqual(none.node, {});
  assert.deepEqual(none.reports, []);
  const scalar = run("text");
  assert.equal(scalar.node.value, "text");
  assert.deepEqual(scalar.reports, []);
});

test("同じファイルを 2 つの Example から参照しても結果は別のオブジェクトになる", () => {
  const a = run({ $ref: "./sub/leaf.yaml" }).node.value as { leaf: boolean };
  const b = run({ $ref: "./sub/leaf.yaml" }).node.value as { leaf: boolean };
  assert.notEqual(a, b);
  a.leaf = false;
  assert.deepEqual(b, { leaf: true });
});

test("Root.enter でキャッシュを空にし、ファイルの変更を読み直す", () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), "inline-examples-"));
  try {
    const file = join(dir, "x.yaml");
    const v = preprocessors["inline-examples"]({});
    fs.writeFileSync(file, "v: 1\n");
    const call = () => {
      const node = { value: { $ref: "./x.yaml" } as unknown };
      const ctx = {
        location: { source: { absoluteRef: join(dir, "e.yaml") }, child: () => ({}) },
        report: () => {},
      };
      (v.Example as { leave: (...args: unknown[]) => void }).leave(node, ctx);
      return node.value;
    };
    assert.deepEqual(call(), { v: 1 });
    fs.writeFileSync(file, "v: 2\n");
    assert.deepEqual(call(), { v: 1 });
    (v.Root as { enter: () => void }).enter();
    assert.deepEqual(call(), { v: 2 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("bundle で Example の value の $ref を展開し、スキーマの properties.examples は展開しない", async () => {
  // `createConfig` の `plugins` オプションに渡したオブジェクトは rule 名に plugin id の接頭辞が付かないため、
  // `redocly.yaml` と同じく `plugins:` にファイルのパスを書いて読み込ませる。
  const config = await createConfig({
    plugins: [join(dirname(fileURLToPath(import.meta.url)), "index.ts")],
    preprocessors: { "ansanloms/inline-examples": "on" },
  });
  const { bundle: result, problems } = await bundle({
    ref: join(fixtures, "integration/openapi.yaml"),
    config,
  });
  assert.deepEqual(problems, []);

  const doc = result.parsed as any;
  const item = { id: 1, part: { name: "part" } };
  const get = doc.paths["/items/{id}"].get;
  assert.deepEqual(get.parameters[0].examples.fromParameter.value, { name: "part" });
  assert.deepEqual(get.responses["200"].content["application/json"].examples.inline.value, item);
  assert.deepEqual(
    doc.components.responses.ok.content["application/json"].examples.fromResponse.value,
    item,
  );

  const node = Object.values(doc.components.schemas)[0] as any;
  assert.equal(typeof node.properties.examples.properties.self.$ref, "string");
});

test("lint で順の違う parameter だけを path item・operation・components の 3 箇所で報告する", async () => {
  // plugin はパスで読み込ませる理由が上の bundle のテストと同じ。
  const config = await createConfig({
    plugins: [join(dirname(fileURLToPath(import.meta.url)), "index.ts")],
    rules: { "ansanloms/key-order": "error" },
  });
  const problems = await lint({ ref: join(fixtures, "key-order/openapi.yaml"), config });

  const found = problems.map((p) => ({
    ruleId: p.ruleId,
    pointer: p.location[0].pointer,
    reportOnKey: p.location[0].reportOnKey,
  }));
  assert.deepEqual(
    found.sort((a, b) => String(a.pointer).localeCompare(String(b.pointer))),
    [
      "#/components/parameters/Ng/name",
      "#/paths/~1items/get/parameters/1/name",
      "#/paths/~1items/parameters/1/name",
    ].map((pointer) => ({ ruleId: "ansanloms/key-order", pointer, reportOnKey: true })),
  );
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

test("createPlugin は既定の規約で operation-id-naming・description-file-naming・schema-description・examples-layout・no-unreferenced-files・key-order・request-response-schema-naming・enum-schema-naming・no-inline-enum を持つ", () => {
  const p = createPlugin()();
  assert.equal(p.id, "ansanloms");
  assert.deepEqual(Object.keys(p.rules.oas3).sort(), [
    "description-file-naming",
    "enum-schema-naming",
    "examples-layout",
    "key-order",
    "no-inline-enum",
    "no-unreferenced-files",
    "operation-id-naming",
    "request-response-schema-naming",
    "schema-description",
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

test("lint で schema-description と description-file-naming が components.schemas 直下だけを検査する", async () => {
  const config = await createConfig({
    plugins: [join(dirname(fileURLToPath(import.meta.url)), "index.ts")],
    rules: {
      "ansanloms/schema-description": "error",
      "ansanloms/description-file-naming": "error",
    },
  });
  const ref = join(fixtures, "schema-description/openapi.yaml");
  const expected = [
    {
      ruleId: "ansanloms/description-file-naming",
      file: "Wrong.yaml",
      pointer: "#/description/$ref",
    },
    { ruleId: "ansanloms/schema-description", file: "NoDescription.yaml", pointer: "#/" },
  ];
  // 同じ config で 2 回 lint しても、重複排除の Set が Root.enter でリセットされ同じ結果になる。
  for (let i = 0; i < 2; i++) {
    const problems = await lint({ ref, config });
    const found = problems
      .map((p) => ({
        ruleId: p.ruleId,
        file: basename(p.location[0]!.source.absoluteRef),
        pointer: p.location[0]!.pointer,
      }))
      .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
    assert.deepEqual(found, expected, `lint ${i + 1} 回目`);
  }
});
