import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { fixtureDir, lintRule } from "../test/lint.ts";
import { DescriptionFileNaming } from "./description-file-naming.ts";

// Redocly の visitor を模した最小の文脈でルールを駆動し、報告された内容を返す。
type Step =
  | { kind: "enter"; key: string }
  | { kind: "leave" }
  | { kind: "operation"; operationId?: unknown; description?: unknown };

interface Reported {
  message: string;
  location: string[];
}

// ルールが返す visitor のうち、テストで呼ぶ部分だけを表す。
interface TestVisitor {
  PathItem: {
    enter: (target: unknown, ctx: { key: string }) => void;
    leave: () => void;
  };
  Operation: {
    enter: (
      target: { operationId?: unknown; description?: unknown },
      ctx: {
        key: string;
        location: { child: (path: string[]) => string[] };
        report: (problem: { message: string; location: string[] }) => void;
      },
    ) => void;
  };
}

const runRule = (steps: Step[]): Reported[] => {
  const reported: Reported[] = [];
  const visitor = (DescriptionFileNaming as unknown as (options: unknown) => TestVisitor)({});
  for (const step of steps) {
    if (step.kind === "enter") {
      visitor.PathItem.enter({}, { key: step.key });
    } else if (step.kind === "leave") {
      visitor.PathItem.leave();
    } else {
      visitor.Operation.enter(
        { operationId: step.operationId, description: step.description },
        {
          key: "post",
          location: { child: (path) => path },
          report: (problem) => reported.push(problem),
        },
      );
    }
  }
  return reported;
};

const ref = (name: string) => ({ $ref: `./descriptions/${name}.md` });

test("ファイル名と operationId が一致していれば報告しない", () => {
  assert.deepEqual(
    runRule([
      { kind: "enter", key: "/carts" },
      { kind: "operation", operationId: "postCarts", description: ref("postCarts") },
      { kind: "leave" },
    ]),
    [],
  );
});

test("ファイル名と operationId が不一致なら description.$ref の位置に報告する", () => {
  const reported = runRule([
    { kind: "enter", key: "/carts" },
    { kind: "operation", operationId: "postCarts", description: ref("PostCarts") },
    { kind: "leave" },
  ]);
  assert.equal(reported.length, 1);
  assert.deepEqual(reported[0]!.location, ["description", "$ref"]);
  assert.match(reported[0]!.message, /actual: PostCarts/);
  assert.match(reported[0]!.message, /expected: postCarts/);
});

test("callback 内の operation は検査せず、後続の operation は検査する", () => {
  const reported = runRule([
    { kind: "enter", key: "/carts" },
    { kind: "enter", key: "{$request.body#/url}" },
    { kind: "operation", operationId: "callbackOp", description: ref("other") },
    { kind: "leave" },
    { kind: "operation", operationId: "postCarts", description: ref("wrong") },
    { kind: "leave" },
  ]);
  assert.equal(reported.length, 1);
  assert.match(reported[0]!.message, /actual: wrong/);
});

test("インラインの description は検査しない", () => {
  assert.deepEqual(
    runRule([
      { kind: "enter", key: "/carts" },
      { kind: "operation", operationId: "postCarts", description: "inline text" },
      { kind: "operation", operationId: "getCarts" },
      { kind: "leave" },
    ]),
    [],
  );
});

test("./descriptions/<x>.md 形でない $ref は検査しない", () => {
  assert.deepEqual(
    runRule([
      { kind: "enter", key: "/carts" },
      { kind: "operation", operationId: "postCarts", description: { $ref: "../other/foo.md" } },
      {
        kind: "operation",
        operationId: "getCarts",
        description: { $ref: "./descriptions/sub/foo.md" },
      },
      {
        kind: "operation",
        operationId: "putCarts",
        description: { $ref: "./descriptions/foo.txt" },
      },
      { kind: "leave" },
    ]),
    [],
  );
});

test("operationId が無い operation は検査しない", () => {
  assert.deepEqual(
    runRule([
      { kind: "enter", key: "/carts" },
      { kind: "operation", description: ref("anything") },
      { kind: "leave" },
    ]),
    [],
  );
});

test("webhooks と components.pathItems (key が / 始まりでない) は検査しない", () => {
  assert.deepEqual(
    runRule([
      { kind: "enter", key: "newOrder" },
      { kind: "operation", operationId: "postNewOrder", description: ref("wrong") },
      { kind: "leave" },
    ]),
    [],
  );
});

// schema の検査。偽の ctx で NamedSchemas.Schema.enter を直接呼ぶ。
interface SchemaVisitor {
  Root: { enter: () => void };
  NamedSchemas: {
    skip: (node: unknown, key: string) => boolean;
    Schema: {
      enter: (
        target: { description?: unknown },
        ctx: {
          key: string;
          parentLocations?: Record<string, unknown>;
          location: {
            pointer: string;
            source: { absoluteRef: string };
            child: (path: string[]) => string[];
          };
          report: (problem: { message: string; location: string[] }) => void;
        },
      ) => void;
    };
  };
}

const runSchema = (
  cases: { description?: unknown; key?: string; pointer?: string; absoluteRef?: string }[],
) => {
  const reported: Reported[] = [];
  const visitor = (DescriptionFileNaming as unknown as (options: unknown) => SchemaVisitor)({});
  for (const c of cases) {
    visitor.NamedSchemas.Schema.enter(
      { description: c.description },
      {
        key: c.key ?? "User",
        location: {
          pointer: c.pointer ?? "#/",
          source: { absoluteRef: c.absoluteRef ?? "/root/components/User.yaml" },
          child: (path) => path,
        },
        report: (problem) => reported.push(problem),
      },
    );
  }
  return { reported, visitor };
};

test("schema: pointer が #/ で定義ファイル名と一致していれば報告しない", () => {
  assert.deepEqual(runSchema([{ description: ref("User") }]).reported, []);
});

test("schema: pointer が #/ で定義ファイル名と不一致なら description.$ref の位置に報告する", () => {
  const { reported } = runSchema([
    { description: ref("Other"), key: "Alias", absoluteRef: "/root/components/User.yaml" },
  ]);
  assert.equal(reported.length, 1);
  assert.deepEqual(reported[0]!.location, ["description", "$ref"]);
  assert.match(reported[0]!.message, /actual: Other/);
  assert.match(reported[0]!.message, /expected: User\b/);
  assert.match(reported[0]!.message, /定義ファイル名/);
});

test("schema: parentLocations が無く pointer が #/ 以外のときは ctx.key と比べる", () => {
  assert.deepEqual(
    runSchema([{ description: ref("User"), key: "User", pointer: "#/components/schemas/User" }])
      .reported,
    [],
  );
  const { reported } = runSchema([
    { description: ref("Other"), key: "User", pointer: "#/components/schemas/User" },
  ]);
  assert.equal(reported.length, 1);
  assert.match(reported[0]!.message, /expected: User\b/);
  assert.match(reported[0]!.message, /スキーマ名/);
});

test("schema: インライン文字列・description 無し・形の違う $ref は検査しない", () => {
  assert.deepEqual(
    runSchema([
      { description: "inline", key: "A", pointer: "#/a" },
      { key: "B", pointer: "#/b" },
      { description: { $ref: "../other/foo.md" }, key: "C", pointer: "#/c" },
      { description: { $ref: "./descriptions/sub/foo.md" }, key: "D", pointer: "#/d" },
    ]).reported,
    [],
  );
});

test("schema: 同じ location の 2 回目は報告せず、Root.enter の後は再び報告する", () => {
  const wrong = { description: ref("Other") };
  const { reported, visitor } = runSchema([wrong, wrong]);
  assert.equal(reported.length, 1);

  visitor.Root.enter();
  visitor.NamedSchemas.Schema.enter(
    { description: ref("Other") },
    {
      key: "User",
      location: {
        pointer: "#/",
        source: { absoluteRef: "/root/components/User.yaml" },
        child: (path) => path,
      },
      report: (problem) => reported.push(problem),
    },
  );
  assert.equal(reported.length, 2);
});

test("schema: skip は components.schemas 以外 ($defs・definitions) で true を返す", () => {
  const { visitor } = runSchema([]);
  assert.equal(visitor.NamedSchemas.skip({}, "schemas"), false);
  assert.equal(visitor.NamedSchemas.skip({}, "$defs"), true);
  assert.equal(visitor.NamedSchemas.skip({}, "definitions"), true);
});

const lintSchemas = (schemas: string) =>
  lintRule(
    "description-file-naming",
    `openapi: 3.0.3
info: { title: t, version: "1" }
paths: {}
components:
  schemas:
${schemas}
`,
    fixtureDir("description-file-naming"),
  );

test("別のキーを指す $ref があっても、参照先が先に在れば報告しない", async () => {
  const r = await lintSchemas(`    A: { $ref: "#/components/schemas/User" }
    User: { type: object, description: { $ref: ./descriptions/User.md } }`);
  assert.deepEqual(r, []);
});

test("別のキーを指す $ref があっても、キーの順を入れ替えて報告しない", async () => {
  const r =
    await lintSchemas(`    User: { type: object, description: { $ref: ./descriptions/User.md } }
    A: { $ref: "#/components/schemas/User" }`);
  assert.deepEqual(r, []);
});

test("別のキーを指す $ref があっても、参照先の名前と食い違えば定義側のキーで報告する", async () => {
  const r = await lintSchemas(`    A: { $ref: "#/components/schemas/User" }
    User: { type: object, description: { $ref: ./descriptions/Other.md } }`);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.pointer, "#/components/schemas/User/description/$ref");
  assert.match(r[0]!.message, /actual: Other, expected: User/);
});

test("~ を含むキーは JSON Pointer のエスケープを戻して比べる", async () => {
  const r = await lintSchemas(
    `    "a~b": { type: object, description: { $ref: ./descriptions/a~b.md } }`,
  );
  assert.deepEqual(r, []);
});

test("/ を含むキーは JSON Pointer のエスケープを戻したキーで報告する", async () => {
  const r = await lintSchemas(
    `    "a/b": { type: object, description: { $ref: ./descriptions/x.md } }`,
  );
  assert.equal(r.length, 1);
  assert.match(r[0]!.message, /actual: x, expected: a\/b\)/);
  assert.doesNotMatch(r[0]!.message, /a~1b/);
});

// 一時ディレクトリに `files` (相対パス -> 内容) を書き出し、`source` を root.yaml として lint する。
const lintTree = async (source: string, files: Record<string, string>) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "description-file-naming-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      const file = path.join(base, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    return await lintRule("description-file-naming", source, base);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
};

const splitRoot = `openapi: 3.0.3
info: { title: t, version: "1" }
paths: {}
components:
  $ref: ./components.yaml
`;

test("別ファイルに分けた components で、別のキーを指す $ref が先に在っても報告しない", async () => {
  const r = await lintTree(splitRoot, {
    "components.yaml": `schemas:
  A: { $ref: "#/schemas/User" }
  User: { type: object, description: { $ref: ./descriptions/User.md } }
`,
  });
  assert.deepEqual(r, []);
});

test("別ファイルに分けた components で、キーの順を入れ替えても報告しない", async () => {
  const r = await lintTree(splitRoot, {
    "components.yaml": `schemas:
  User: { type: object, description: { $ref: ./descriptions/User.md } }
  A: { $ref: "#/schemas/User" }
`,
  });
  assert.deepEqual(r, []);
});

test("別ファイルに分けた components で、名前が食い違えば定義側のキーで報告する", async () => {
  const r = await lintTree(splitRoot, {
    "components.yaml": `schemas:
  A: { $ref: "#/schemas/User" }
  User: { type: object, description: { $ref: ./descriptions/Other.md } }
`,
  });
  assert.equal(r.length, 1);
  assert.equal(r[0]!.file, "components.yaml");
  assert.equal(r[0]!.pointer, "#/schemas/User/description/$ref");
  assert.match(r[0]!.message, /actual: Other, expected: User/);
});

const fragmentRoot = (key: string) => `openapi: 3.0.3
info: { title: t, version: "1" }
paths: {}
components:
  schemas:
    ${key}: { $ref: "./common.yaml#/User" }
`;
const commonFile = {
  "common.yaml": `User: { type: object, description: { $ref: ./descriptions/User.md } }
`,
};

test("フラグメント付きの参照先は、登録キーと一致していれば報告しない", async () => {
  assert.deepEqual(await lintTree(fragmentRoot("User"), commonFile), []);
});

test("フラグメント付きの参照先は、登録キーと食い違えば登録キーで報告する", async () => {
  const r = await lintTree(fragmentRoot("Account"), commonFile);
  assert.equal(r.length, 1);
  assert.match(r[0]!.message, /actual: User, expected: Account/);
});

const accountRoot = (target: string) => `openapi: 3.0.3
info: { title: t, version: "1" }
paths: {}
components:
  schemas:
    Account: { $ref: "${target}" }
`;
const userDef = `{ type: object, description: { $ref: ./descriptions/User.md } }`;

test("別ファイルの schemas/User を指す参照先は、登録キーで報告する", async () => {
  const r = await lintTree(accountRoot("./common.yaml#/schemas/User"), {
    "common.yaml": `schemas: { User: ${userDef} }\n`,
  });
  assert.equal(r.length, 1);
  assert.match(r[0]!.message, /actual: User, expected: Account/);
});

test("別ファイルの components/schemas/User を指す参照先は、登録キーで報告する", async () => {
  const r = await lintTree(accountRoot("./lib.yaml#/components/schemas/User"), {
    "lib.yaml": `components: { schemas: { User: ${userDef} } }\n`,
  });
  assert.equal(r.length, 1);
  assert.match(r[0]!.message, /actual: User, expected: Account/);
});

const splitSchemasRoot = `openapi: 3.0.3
info: { title: t, version: "1" }
paths: {}
components:
  schemas: { $ref: ./schemas.yaml }
`;

test("schemas だけを別ファイルに分け、参照元が先に在っても報告しない", async () => {
  const r = await lintTree(splitSchemasRoot, {
    "schemas.yaml": `A: { $ref: "#/User" }\nUser: ${userDef}\n`,
  });
  assert.deepEqual(r, []);
});

test("schemas だけを別ファイルに分け、参照先が先に在っても報告しない", async () => {
  const r = await lintTree(splitSchemasRoot, {
    "schemas.yaml": `User: ${userDef}\nA: { $ref: "#/User" }\n`,
  });
  assert.deepEqual(r, []);
});

test("schemas だけを別ファイルに分け、名前が食い違えば定義側のキーで報告する", async () => {
  const r = await lintTree(splitSchemasRoot, {
    "schemas.yaml": `A: { $ref: "#/User" }\nUser: { type: object, description: { $ref: ./descriptions/Other.md } }\n`,
  });
  assert.equal(r.length, 1);
  assert.equal(r[0]!.file, "schemas.yaml");
  assert.equal(r[0]!.pointer, "#/User/description/$ref");
  assert.match(r[0]!.message, /actual: Other, expected: User/);
});

test("別ファイルに分けた components で、~ を含むキーのエスケープを戻して比べる", async () => {
  const r = await lintTree(splitRoot, {
    "components.yaml": `schemas:
  "a~b": { type: object, description: { $ref: ./descriptions/a~b.md } }
`,
  });
  assert.deepEqual(r, []);
});

const responseRoot = (schemaRef: string, components: string) => `openapi: 3.0.3
info: { title: t, version: "1" }
paths:
  /users:
    get:
      operationId: getUsers
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema: { $ref: ${schemaRef} }
${components}`;

test("schemas だけを別ファイルに分け、response から先に参照されても報告しない", async () => {
  const r = await lintTree(
    responseRoot("./schemas.yaml#/User", "components:\n  schemas: { $ref: ./schemas.yaml }\n"),
    { "schemas.yaml": `User: ${userDef}\n` },
  );
  assert.deepEqual(r, []);
});

test("components を別ファイルに分け、response から先に参照されても報告しない", async () => {
  const r = await lintTree(
    responseRoot("./components.yaml#/schemas/User", "components: { $ref: ./components.yaml }\n"),
    { "components.yaml": `schemas:\n  User: ${userDef}\n` },
  );
  assert.deepEqual(r, []);
});
