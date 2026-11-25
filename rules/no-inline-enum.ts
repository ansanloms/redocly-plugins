import type { Location, Oas3Rule } from "@redocly/openapi-core";

export const NoInlineEnum: Oas3Rule = () => {
  // components.schemas 直下に登録された schema (解決後のノード)。
  const registered = new Set<object>();
  const candidates: { node: object; location: Location }[] = [];

  return {
    Components: {
      NamedSchemas: {
        Schema: {
          enter: (target) => {
            if (typeof target === "object" && target !== null) {
              registered.add(target);
            }
          },
        },
      },
    },
    Schema: {
      enter: (target, ctx) => {
        if (typeof target !== "object" || target === null) {
          return;
        }
        if (target.enum !== undefined) {
          candidates.push({ node: target, location: ctx.location.child(["enum"]) });
        }
      },
    },
    Root: {
      // paths が components より先に辿られ、登録済みかどうかは enter の時点で確定しない。
      leave: (_target, ctx) => {
        for (const { node, location } of candidates) {
          if (!registered.has(node)) {
            ctx.report({
              message:
                "enum はインラインに書かず、Enum + 大文字で始まる名前の schema に切り出して $ref で参照してください。",
              location,
            });
          }
        }
      },
    },
  };
};
