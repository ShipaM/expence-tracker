import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Input } from "./input";
import { Label } from "./label";

describe("Label", () => {
  it("рендерит подпись с переданным текстом", () => {
    render(<Label>Электронная почта</Label>);

    expect(screen.getByText("Электронная почта")).toBeInTheDocument();
  });

  it("рендерится элементом label", () => {
    render(<Label>Подпись</Label>);

    expect(screen.getByText("Подпись").tagName).toBe("LABEL");
  });

  it("проставляет data-slot", () => {
    render(<Label>Подпись</Label>);

    expect(screen.getByText("Подпись")).toHaveAttribute("data-slot", "label");
  });

  it("связывается с полем через htmlFor", () => {
    render(
      <>
        <Label htmlFor="email">Почта</Label>
        <Input id="email" />
      </>,
    );

    // Связь есть — поле находится по тексту подписи.
    expect(screen.getByLabelText("Почта")).toBe(screen.getByRole("textbox"));
  });

  it("клик по подписи переводит фокус в связанное поле", async () => {
    render(
      <>
        <Label htmlFor="email">Почта</Label>
        <Input id="email" />
      </>,
    );

    await userEvent.click(screen.getByText("Почта"));

    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("пользовательский className не затирает базовые классы", () => {
    render(<Label className="custom-label">Подпись</Label>);

    expect(screen.getByText("Подпись")).toHaveClass("custom-label", "text-sm", "font-medium");
  });

  it("рендерит вложенные элементы", () => {
    render(
      <Label>
        Пароль <span>*</span>
      </Label>,
    );

    expect(screen.getByText("*")).toBeInTheDocument();
  });
});
