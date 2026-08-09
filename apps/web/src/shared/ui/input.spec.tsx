import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("рендерит поле ввода, доступное по роли", () => {
    render(<Input aria-label="Электронная почта" />);

    expect(screen.getByRole("textbox", { name: "Электронная почта" })).toBeInTheDocument();
  });

  it("проставляет data-slot", () => {
    render(<Input aria-label="Поле" />);

    expect(screen.getByRole("textbox")).toHaveAttribute("data-slot", "input");
  });

  it("пробрасывает type в разметку", () => {
    render(<Input type="email" aria-label="Почта" />);

    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
  });

  it("без type остаётся текстовым полем", () => {
    render(<Input aria-label="Поле" />);

    // type не задан — атрибута в DOM нет, браузер трактует это как text.
    expect(screen.getByRole("textbox")).not.toHaveAttribute("type");
  });

  it("показывает placeholder", () => {
    render(<Input placeholder="you@example.com" />);

    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("принимает ввод пользователя", async () => {
    render(<Input aria-label="Имя" />);

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Максим");

    expect(input).toHaveValue("Максим");
  });

  it("зовёт onChange на каждый введённый символ", async () => {
    const onChange = vi.fn();
    render(<Input aria-label="Имя" onChange={onChange} />);

    await userEvent.type(screen.getByRole("textbox"), "abc");

    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("не принимает ввод, когда disabled", async () => {
    render(<Input aria-label="Имя" disabled />);

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "текст");

    expect(input).toBeDisabled();
    expect(input).toHaveValue("");
  });

  it("работает как управляемое поле", async () => {
    const onChange = vi.fn();
    render(<Input aria-label="Имя" value="фикс" onChange={onChange} />);

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "х");

    expect(onChange).toHaveBeenCalled();
    // Родитель value не поменял — в поле остаётся прежнее значение.
    expect(input).toHaveValue("фикс");
  });

  it("пользовательский className не затирает базовые классы", () => {
    render(<Input aria-label="Поле" className="custom-input" />);

    expect(screen.getByRole("textbox")).toHaveClass("custom-input", "h-9", "w-full");
  });

  it("прокидывает aria-invalid для состояния ошибки", () => {
    render(<Input aria-label="Поле" aria-invalid />);

    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("пробрасывает нативные атрибуты формы", () => {
    render(<Input aria-label="Поле" name="email" required readOnly />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("name", "email");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("readonly");
  });
});
