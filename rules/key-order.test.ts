import assert from "node:assert/strict";
import { test } from "node:test";

import { KeyOrder } from "./key-order.ts";

type Report = { message: string; location: unknown };

// ルールが返す visitor のうち、テストで呼ぶ部分だけを表す。
interface TestVisitor {
  any: {
    enter: (
      node: unknown,
      ctx: {
        type: { name: string };
        location: { child: (path: string[]) => { key: () => unknown } };
        report: (r: Report) => void;
      },
    ) => void;
  };
}

// Redocly の visitor を模した最小の文脈でルールを駆動し、報告を返す。
const run = (typeName: string, node: unknown, options: Record<string, unknown> = {}): Report[] => {
  const reports: Report[] = [];
  const visitor = (KeyOrder as unknown as (options: unknown) => TestVisitor)(options);
  visitor.any.enter(node, {
    type: { name: typeName },
    location: { child: (path) => ({ key: () => ({ pointer: path, reportOnKey: true }) }) },
    report: (r) => reports.push(r),
  });
  return reports;
};

const parameter = (keys: string[]): Record<string, unknown> =>
  Object.fromEntries(keys.map((key) => [key, key]));

test("既定の順どおりなら報告しない", () => {
  assert.deepEqual(
    run("Parameter", parameter(["in", "name", "required", "description", "schema"])),
    [],
  );
});

test("name が in より前なら 1 件報告し、位置は name を指す", () => {
  const reports = run("Parameter", parameter(["name", "in", "required", "description", "schema"]));
  assert.equal(reports.length, 1);
  assert.deepEqual(reports[0].location, { pointer: ["name"], reportOnKey: true });
  assert.equal(
    reports[0].message,
    "キーの順が規約と一致していません (actual: [name, in, required, description, schema], expected: [in, name, required, description, schema])。",
  );
});

test("順序に載っていないキーは schema より前なら報告し、末尾なら報告しない", () => {
  assert.equal(run("Parameter", parameter(["in", "name", "example", "schema"])).length, 1);
  assert.deepEqual(run("Parameter", parameter(["in", "name", "schema", "example"])), []);
});

test("載っているキーの一部が無くても、残りが順どおりなら報告しない", () => {
  assert.deepEqual(run("Parameter", parameter(["in", "name", "description", "schema"])), []);
});

test("orders に無い node type は対象外", () => {
  assert.deepEqual(run("Operation", parameter(["summary", "operationId"])), []);
});

test("orders に node type を足すと検査し、Parameter の既定も残る", () => {
  const options = { orders: { Operation: ["operationId", "summary"] } };
  assert.equal(run("Operation", parameter(["summary", "operationId"]), options).length, 1);
  assert.equal(run("Parameter", parameter(["name", "in"]), options).length, 1);
});

test("空配列を渡した node type は検査しない", () => {
  assert.deepEqual(run("Parameter", parameter(["name", "in"]), { orders: { Parameter: [] } }), []);
});

test("配列ノードは対象外", () => {
  assert.deepEqual(run("Parameter", [{ name: "a", in: "query" }]), []);
});

test("orders の値が配列でなければ、例外を出さず検査しない", () => {
  assert.deepEqual(
    run("Parameter", parameter(["name", "in"]), { orders: { Parameter: null } }),
    [],
  );
  assert.deepEqual(
    run("Parameter", parameter(["name", "in"]), { orders: { Parameter: "in" } }),
    [],
  );
});

test("orders に同じキーが複数あっても、expected には 1 回だけ出る", () => {
  const reports = run("Parameter", parameter(["name", "in"]), {
    orders: { Parameter: ["in", "name", "in"] },
  });
  assert.equal(reports.length, 1);
  assert.equal(
    reports[0].message,
    "キーの順が規約と一致していません (actual: [name, in], expected: [in, name])。",
  );
});
