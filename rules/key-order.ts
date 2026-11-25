import type { Oas3Rule } from "@redocly/openapi-core";

/** node type 名ごとのキーの順の既定値。 */
const defaultOrders: Record<string, string[]> = {
  Parameter: ["in", "name", "required", "description", "schema"],
};

export const KeyOrder: Oas3Rule = (opts: Record<string, any>) => {
  const orders: Record<string, unknown> = { ...defaultOrders, ...opts?.orders };

  return {
    any: {
      enter: (node: unknown, ctx) => {
        const raw: unknown = orders[ctx.type.name];
        if (!Array.isArray(raw) || raw.length === 0) {
          return;
        }
        const order: string[] = [...new Set<string>(raw)];
        if (typeof node !== "object" || node === null || Array.isArray(node)) {
          return;
        }

        const actual = Object.keys(node);
        // 順序に載っているキーを orders の順に、載っていないキーを実際の順のまま後ろに並べる。
        const expected = [
          ...order.filter((key) => actual.includes(key)),
          ...actual.filter((key) => !order.includes(key)),
        ];

        const index = actual.findIndex((key, i) => key !== expected[i]);
        if (index === -1) {
          return;
        }

        ctx.report({
          message: `キーの順が規約と一致していません (actual: [${actual.join(", ")}], expected: [${expected.join(", ")}])。`,
          location: ctx.location.child([actual[index]]).key(),
        });
      },
    },
  };
};
