import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("рендерит чекбокс, доступный по роли", () => {
    render(<Checkbox aria-label="Согласен с условиями" />);

    expect(screen.getByRole("checkbox", { name: "Согласен с условиями" })).toBeInTheDocument();
  });

  it("проставляет data-slot", () => {
    render(<Checkbox aria-label="Чекбокс" />);

    expect(screen.getByRole("checkbox")).toHaveAttribute("data-slot", "checkbox");
  });

  it("по умолчанию не отмечен", () => {
    render(<Checkbox aria-label="Чекбокс" />);

    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("отмечается по клику и зовёт onCheckedChange", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Чекбокс" onCheckedChange={onCheckedChange} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("снимает отметку повторным кликом", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Чекбокс" defaultChecked onCheckedChange={onCheckedChange} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onCheckedChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("показывает индикатор только в отмеченном состоянии", () => {
    const { rerender } = render(<Checkbox aria-label="Чекбокс" checked={false} />);

    // Radix монтирует индикатор лишь когда состояние checked — до этого его нет в DOM.
    expect(document.querySelector("[data-slot='checkbox-indicator']")).not.toBeInTheDocument();

    rerender(<Checkbox aria-label="Чекбокс" checked />);

    expect(document.querySelector("[data-slot='checkbox-indicator']")).toBeInTheDocument();
  });

  it("не реагирует на клик, когда disabled", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Чекбокс" disabled onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole("checkbox");
    await userEvent.click(checkbox);

    expect(checkbox).toBeDisabled();
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(checkbox).not.toBeChecked();
  });

  it("работает как управляемый: состояние задаёт проп, а не внутренний стейт", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Чекбокс" checked={false} onCheckedChange={onCheckedChange} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
    // Родитель проп не поменял — чекбокс обязан остаться неотмеченным.
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("пользовательский className не затирает базовые классы", () => {
    render(<Checkbox aria-label="Чекбокс" className="custom-checkbox" />);

    expect(screen.getByRole("checkbox")).toHaveClass("custom-checkbox", "size-4", "shrink-0");
  });

  it("прокидывает aria-invalid для состояния ошибки", () => {
    render(<Checkbox aria-label="Чекбокс" aria-invalid />);

    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-invalid", "true");
  });
});
