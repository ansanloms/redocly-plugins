import type { Oas3Rule } from "@redocly/openapi-core";
/** メソッドとパスから期待する operationId を返す関数の型。plugin に注入できる。 */
export type ExpectedOperationId = (method: string, path: string) => string;
export declare const createOperationIdNaming: (expected: ExpectedOperationId) => Oas3Rule;
