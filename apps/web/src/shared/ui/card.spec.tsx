import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

describe("Card", () => {
  it("рендерит div с data-slot='card'", () => {
    render(<Card data-testid="card">Содержимое</Card>);

    const card = screen.getByTestId("card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("data-slot", "card");
    expect(card.tagName).toBe("DIV");
  });

  it("пробрасывает className и объединяет с базовыми классами", () => {
    render(
      <Card data-testid="card" className="custom-class">
        Содержимое
      </Card>,
    );

    const card = screen.getByTestId("card");
    expect(card).toHaveClass("custom-class", "flex", "flex-col", "rounded-xl");
  });

  it("пробрасывает нативные атрибуты", () => {
    render(
      <Card data-testid="card" aria-label="Карточка профиля">
        Содержимое
      </Card>,
    );

    expect(screen.getByLabelText("Карточка профиля")).toBeInTheDocument();
  });

  it("рендерит дочерние элементы", () => {
    render(
      <Card>
        <span>Дочерний элемент</span>
      </Card>,
    );

    expect(screen.getByText("Дочерний элемент")).toBeInTheDocument();
  });
});

describe("CardHeader", () => {
  it("рендерит div с data-slot='card-header'", () => {
    render(<CardHeader data-testid="header">Заголовок</CardHeader>);

    const header = screen.getByTestId("header");
    expect(header).toHaveAttribute("data-slot", "card-header");
    expect(header.tagName).toBe("DIV");
  });

  it("пробрасывает className", () => {
    render(
      <CardHeader data-testid="header" className="custom-header">
        Заголовок
      </CardHeader>,
    );

    expect(screen.getByTestId("header")).toHaveClass("custom-header", "@container/card-header");
  });
});

describe("CardTitle", () => {
  it("рендерит div с data-slot='card-title'", () => {
    render(<CardTitle data-testid="title">Название карточки</CardTitle>);

    const title = screen.getByTestId("title");
    expect(title).toHaveAttribute("data-slot", "card-title");
    expect(title).toHaveTextContent("Название карточки");
  });

  it("пробрасывает className", () => {
    render(
      <CardTitle data-testid="title" className="custom-title">
        Название
      </CardTitle>,
    );

    expect(screen.getByTestId("title")).toHaveClass("custom-title", "font-semibold");
  });
});

describe("CardDescription", () => {
  it("рендерит div с data-slot='card-description'", () => {
    render(<CardDescription data-testid="desc">Описание карточки</CardDescription>);

    const desc = screen.getByTestId("desc");
    expect(desc).toHaveAttribute("data-slot", "card-description");
    expect(desc).toHaveTextContent("Описание карточки");
  });

  it("пробрасывает className", () => {
    render(
      <CardDescription data-testid="desc" className="custom-desc">
        Описание
      </CardDescription>,
    );

    expect(screen.getByTestId("desc")).toHaveClass("custom-desc", "text-muted-foreground");
  });
});

describe("CardAction", () => {
  it("рендерит div с data-slot='card-action'", () => {
    render(<CardAction data-testid="action">Действие</CardAction>);

    const action = screen.getByTestId("action");
    expect(action).toHaveAttribute("data-slot", "card-action");
    expect(action).toHaveTextContent("Действие");
  });

  it("пробрасывает className и применяет классы grid-позиции", () => {
    render(
      <CardAction data-testid="action" className="custom-action">
        Действие
      </CardAction>,
    );

    expect(screen.getByTestId("action")).toHaveClass("custom-action", "col-start-2", "row-span-2");
  });
});

describe("CardContent", () => {
  it("рендерит div с data-slot='card-content'", () => {
    render(<CardContent data-testid="content">Контент карточки</CardContent>);

    const content = screen.getByTestId("content");
    expect(content).toHaveAttribute("data-slot", "card-content");
    expect(content).toHaveTextContent("Контент карточки");
  });

  it("пробрасывает className", () => {
    render(
      <CardContent data-testid="content" className="custom-content">
        Контент
      </CardContent>,
    );

    expect(screen.getByTestId("content")).toHaveClass("custom-content", "px-6");
  });
});

describe("CardFooter", () => {
  it("рендерит div с data-slot='card-footer'", () => {
    render(<CardFooter data-testid="footer">Подвал</CardFooter>);

    const footer = screen.getByTestId("footer");
    expect(footer).toHaveAttribute("data-slot", "card-footer");
    expect(footer).toHaveTextContent("Подвал");
  });

  it("пробрасывает className", () => {
    render(
      <CardFooter data-testid="footer" className="custom-footer">
        Подвал
      </CardFooter>,
    );

    expect(screen.getByTestId("footer")).toHaveClass("custom-footer", "flex", "items-center");
  });
});

describe("Card композиция", () => {
  it("собирает все части вместе в семантичную структуру", () => {
    render(
      <Card data-testid="card">
        <CardHeader data-testid="header">
          <CardTitle data-testid="title">Заголовок</CardTitle>
          <CardDescription data-testid="desc">Описание</CardDescription>
          <CardAction data-testid="action">Действие</CardAction>
        </CardHeader>
        <CardContent data-testid="content">Контент</CardContent>
        <CardFooter data-testid="footer">Подвал</CardFooter>
      </Card>,
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("title")).toHaveTextContent("Заголовок");
    expect(screen.getByTestId("desc")).toHaveTextContent("Описание");
    expect(screen.getByTestId("action")).toHaveTextContent("Действие");
    expect(screen.getByTestId("content")).toHaveTextContent("Контент");
    expect(screen.getByTestId("footer")).toHaveTextContent("Подвал");
  });
});
