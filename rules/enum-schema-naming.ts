import type { Oas3Rule } from "@redocly/openapi-core";

/** `Enum` の次が ASCII 大文字で続く名前。 */
const ENUM_NAME = /^Enum[A-Z]/;

export const EnumSchemaNaming: Oas3Rule = () => ({
  Components: {
    NamedSchemas: {
      Schema: {
        enter: (target, ctx) => {
          if (typeof target !== "object" || target === null) {
            return;
          }

          const name = String(ctx.key);
          const hasEnum = target.enum !== undefined;
          const isEnumName = ENUM_NAME.test(name);
          if (hasEnum === isEnumName) {
            return;
          }

          // ctx.location は $ref 先を指すので、登録キーの位置に報告する。
          ctx.report({
            message: hasEnum
              ? `enum を持つ schema の名前は Enum + 大文字で始めてください (actual: ${name})。`
              : `名前が Enum + 大文字で始まる schema はルートに enum を持たせてください (actual: ${name})。`,
            location: ctx.parentLocations.NamedSchemas!.child([name]).key(),
          });
        },
      },
    },
  },
});
