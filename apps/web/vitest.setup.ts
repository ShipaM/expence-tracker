import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest не чистит DOM между кейсами сам (это делал бы globals-режим RTL с jest),
// поэтому размонтируем дерево вручную — иначе getBy* найдёт узлы прошлого теста.
afterEach(() => {
  cleanup();
});
