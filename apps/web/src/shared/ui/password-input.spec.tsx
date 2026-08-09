import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./password-input";

/** Поле пароля не имеет роли textbox — ищем его по data-slot, который проставляет Input. */
function getPasswordField(): HTMLInputElement {
  const field = document.querySelector<HTMLInputElement>("[data-slot='input']");
  if (!field) {
    throw new Error("Поле пароля не отрендерилось");
  }
  return field;
}

describe("PasswordInput", () => {
  it("по умолчанию скрывает пароль", () => {
    render(<PasswordInput aria-label="Пароль" />);

    expect(getPasswordField()).toHaveAttribute("type", "password");
  });

  it("кнопка-глазик доступна и предлагает показать пароль", () => {
    render(<PasswordInput aria-label="Пароль" />);

    const toggle = screen.getByRole("button", { name: "Показать пароль" });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("показывает пароль по клику на кнопку", async () => {
    render(<PasswordInput aria-label="Пароль" />);

    await userEvent.click(screen.getByRole("button", { name: "Показать пароль" }));

    expect(getPasswordField()).toHaveAttribute("type", "text");
  });

  it("меняет доступное имя и aria-pressed после переключения", async () => {
    render(<PasswordInput aria-label="Пароль" />);

    await userEvent.click(screen.getByRole("button", { name: "Показать пароль" }));

    const toggle = screen.getByRole("button", { name: "Скрыть пароль" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("повторный клик снова скрывает пароль", async () => {
    render(<PasswordInput aria-label="Пароль" />);

    await userEvent.click(screen.getByRole("button", { name: "Показать пароль" }));
    await userEvent.click(screen.getByRole("button", { name: "Скрыть пароль" }));

    expect(getPasswordField()).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Показать пароль" })).toBeInTheDocument();
  });

  it("сохраняет введённое значение при переключении видимости", async () => {
    render(<PasswordInput aria-label="Пароль" />);

    await userEvent.type(getPasswordField(), "s3cret");
    await userEvent.click(screen.getByRole("button", { name: "Показать пароль" }));

    expect(getPasswordField()).toHaveValue("s3cret");
  });

  it("у кнопки type=button — она не отправляет форму", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Пароль" />
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Показать пароль" }));

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disabled гасит и поле, и кнопку", async () => {
    render(<PasswordInput aria-label="Пароль" disabled />);

    const toggle = screen.getByRole("button", { name: "Показать пароль" });
    expect(getPasswordField()).toBeDisabled();
    expect(toggle).toBeDisabled();

    await userEvent.click(toggle);

    // Пароль не должен раскрыться кликом по выключенной кнопке.
    expect(getPasswordField()).toHaveAttribute("type", "password");
  });

  it("иконка скрыта от скринридеров — состояние озвучивает aria-label кнопки", () => {
    render(<PasswordInput aria-label="Пароль" />);

    const icon = screen.getByRole("button").querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("пробрасывает пропсы в поле и добавляет отступ под кнопку", () => {
    render(<PasswordInput aria-label="Пароль" name="password" placeholder="••••••" required />);

    const field = getPasswordField();
    expect(field).toHaveAttribute("name", "password");
    expect(field).toHaveAttribute("placeholder", "••••••");
    expect(field).toBeRequired();
    expect(field).toHaveClass("pr-9");
  });

  it("пользовательский className попадает на поле", () => {
    render(<PasswordInput aria-label="Пароль" className="custom-password" />);

    expect(getPasswordField()).toHaveClass("custom-password", "pr-9");
  });

  it("зовёт onChange при вводе", async () => {
    const onChange = vi.fn();
    render(<PasswordInput aria-label="Пароль" onChange={onChange} />);

    await userEvent.type(getPasswordField(), "abc");

    expect(onChange).toHaveBeenCalledTimes(3);
  });
});
