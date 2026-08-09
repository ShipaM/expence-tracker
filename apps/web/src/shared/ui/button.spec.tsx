import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("рендерит кнопку с переданным содержимым", () => {
    render(<Button>Сохранить</Button>);

    expect(screen.getByRole("button", { name: "Сохранить" })).toBeInTheDocument();
  });

  it("проставляет data-slot и дефолтные variant/size", () => {
    render(<Button>Сохранить</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-slot", "button");
    expect(button).toHaveAttribute("data-variant", "default");
    expect(button).toHaveAttribute("data-size", "default");
  });

  it.each(["destructive", "outline", "secondary", "ghost", "link"] as const)(
    "проносит variant %s в data-атрибут",
    (variant) => {
      render(<Button variant={variant}>Кнопка</Button>);

      expect(screen.getByRole("button")).toHaveAttribute("data-variant", variant);
    },
  );

  it.each(["xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"] as const)(
    "проносит size %s в data-атрибут",
    (size) => {
      render(<Button size={size}>Кнопка</Button>);

      expect(screen.getByRole("button")).toHaveAttribute("data-size", size);
    },
  );

  it("добавляет классы варианта к базовым", () => {
    render(<Button variant="destructive">Удалить</Button>);

    expect(screen.getByRole("button")).toHaveClass("bg-destructive", "inline-flex");
  });

  it("пользовательский className перебивает конфликтующий класс варианта", () => {
    // cn использует twMerge: bg-red-500 должен вытеснить bg-primary, а не сосуществовать с ним.
    render(<Button className="bg-red-500">Кнопка</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-red-500");
    expect(button).not.toHaveClass("bg-primary");
  });

  it("пробрасывает нативные атрибуты кнопки", () => {
    render(
      <Button type="submit" disabled aria-label="Отправить форму">
        Отправить
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Отправить форму" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeDisabled();
  });

  it("вызывает onClick по клику", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Кликни</Button>);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("не вызывает onClick, когда кнопка disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Кликни
      </Button>,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });

  describe("asChild", () => {
    it("рендерит дочерний элемент вместо button, сохраняя классы", () => {
      render(
        <Button asChild variant="link">
          <a href="/login">Войти</a>
        </Button>,
      );

      const link = screen.getByRole("link", { name: "Войти" });
      expect(link).toHaveAttribute("href", "/login");
      expect(link).toHaveAttribute("data-slot", "button");
      expect(link).toHaveClass("underline-offset-4");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});

describe("buttonVariants", () => {
  it("без аргументов отдаёт классы дефолтных варианта и размера", () => {
    const classes = buttonVariants();

    expect(classes).toContain("bg-primary");
    expect(classes).toContain("h-9");
  });

  it("собирает классы для заданных варианта и размера", () => {
    const classes = buttonVariants({ variant: "outline", size: "sm" });

    expect(classes).toContain("hover:bg-accent");
    expect(classes).toContain("h-8");
    expect(classes).not.toContain("bg-primary");
  });
});
