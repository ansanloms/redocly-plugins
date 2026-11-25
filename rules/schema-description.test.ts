import assert from "node:assert/strict";
import { test } from "node:test";

import { SchemaDescription } from "./schema-description.ts";

interface Reported {
  message: string;
  location: unknown;
}

// ルールが返す visitor のうち、テストで呼ぶ部分だけを表す。
interface TestVisitor {
  Root: { enter: () => void };
  NamedSchemas: {
    skip: (node: unknown, key: string) => boolean;
    Schema: {
      enter: (
        target: { description?: unknown },
        ctx: {
          location: { pointer: string; source: { absoluteRef: string } };
          report: (problem: Reported) => void;
        },
      ) => void;
    };
  };
}

const setup = () => {
  const reported: Reported[] = [];
  const visitor = (SchemaDescription as unknown as (options: unknown) => TestVisitor)({});
  const enter = (description: unknown, absoluteRef = "/root/User.yaml", pointer = "#/") => {
    const location = { pointer, source: { absoluteRef } };
    visitor.NamedSchemas.Schema.enter(description === undefined ? {} : { description }, {
      location,
      report: (problem) => reported.push(problem),
    });
    return location;
  };
  return { reported, visitor, enter };
};

test("description が無い・null・空白だけなら報告する", () => {
  const { reported, enter } = setup();
  enter(undefined, "/root/A.yaml");
  enter(null, "/root/B.yaml");
  enter("  \n\t", "/root/C.yaml");
  assert.equal(reported.length, 3);
  assert.match(reported[0]!.message, /description がありません/);
});

test("文字列・{ $ref } の description は報告しない", () => {
  const { reported, enter } = setup();
  enter("text", "/root/A.yaml");
  enter({ $ref: "./descriptions/B.md" }, "/root/B.yaml");
  assert.deepEqual(reported, []);
});

test("報告の位置は ctx.location をそのまま使う", () => {
  const { reported, enter } = setup();
  const location = enter(undefined);
  assert.equal(reported[0]!.location, location);
});

test("skip は schemas で false、$defs・definitions で true を返す", () => {
  const { visitor } = setup();
  assert.equal(visitor.NamedSchemas.skip({}, "schemas"), false);
  assert.equal(visitor.NamedSchemas.skip({}, "$defs"), true);
  assert.equal(visitor.NamedSchemas.skip({}, "definitions"), true);
});

test("同じ location の 2 回目は報告せず、Root.enter の後は再び報告する", () => {
  const { reported, visitor, enter } = setup();
  enter(undefined);
  enter(undefined);
  assert.equal(reported.length, 1);

  enter(undefined, "/root/Other.yaml");
  assert.equal(reported.length, 2);

  visitor.Root.enter();
  enter(undefined);
  assert.equal(reported.length, 3);
});
