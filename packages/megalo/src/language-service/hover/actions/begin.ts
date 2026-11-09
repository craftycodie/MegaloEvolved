import { defineActionHover } from "src/language-service/hover/registry";

export const beginHover = defineActionHover("begin", {
  grammar: "begin",
});
