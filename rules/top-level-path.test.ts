import assert from "node:assert/strict";
import { test } from "node:test";

import { createTopLevelPathTracker, createTopLevelPathVisitor } from "./top-level-path.ts";

test("paths 直下の PathItem では path を返す", () => {
  const tracker = createTopLevelPathTracker();
  tracker.enter("/pets");
  assert.equal(tracker.current(), "/pets");
});

test("入れ子の PathItem (callbacks 内など) では返さない", () => {
  const tracker = createTopLevelPathTracker();
  tracker.enter("/pets");
  tracker.enter("{$request.body#/url}");
  assert.equal(tracker.current(), undefined);
  tracker.enter("/nested");
  assert.equal(tracker.current(), undefined);
});

test("/ で始まらないキーでは返さない", () => {
  const tracker = createTopLevelPathTracker();
  tracker.enter("newPet");
  assert.equal(tracker.current(), undefined);
});

test("数値のキーは文字列にして扱い、返さない", () => {
  const tracker = createTopLevelPathTracker();
  tracker.enter(0);
  assert.equal(tracker.current(), undefined);
});

test("PathItem の外では返さない", () => {
  const tracker = createTopLevelPathTracker();
  assert.equal(tracker.current(), undefined);
});

test("leave で状態が戻る", () => {
  const tracker = createTopLevelPathTracker();
  tracker.enter("/pets");
  tracker.enter("cb");
  assert.equal(tracker.current(), undefined);
  tracker.leave();
  assert.equal(tracker.current(), "/pets");
  tracker.leave();
  assert.equal(tracker.current(), undefined);
});

test("createTopLevelPathVisitor の PathItem を通しても同じ結果になる", () => {
  const { tracker, PathItem } = createTopLevelPathVisitor();
  assert.equal(tracker.current(), undefined);

  PathItem.enter(undefined, { key: "/pets" });
  assert.equal(tracker.current(), "/pets");

  PathItem.enter(undefined, { key: "cb" });
  assert.equal(tracker.current(), undefined);
  PathItem.leave();
  assert.equal(tracker.current(), "/pets");

  PathItem.leave();
  assert.equal(tracker.current(), undefined);

  PathItem.enter(undefined, { key: "newPet" });
  assert.equal(tracker.current(), undefined);
});
