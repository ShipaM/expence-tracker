import { describe, expect, it } from "vitest";
import { createCategorySchema } from "./index";

describe("createCategorySchema", () => {
  it("принимает HEX-цвет", () => {
    expect(createCategorySchema.safeParse({ name: "Еда", color: "#22c55e" }).success).toBe(true);
  });

  it.each(["22c55e", "#22c5", "красный"])("отклоняет цвет %s", (color) => {
    expect(createCategorySchema.safeParse({ name: "Еда", color }).success).toBe(false);
  });
});
