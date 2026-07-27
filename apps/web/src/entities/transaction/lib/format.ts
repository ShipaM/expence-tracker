import type { TransactionType } from "@repo/shared";

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Сумма-строка из API ("1234.56") → "−1 234,56" для расхода, "+1 234,56" для дохода.
 * Number() тут для отображения; денежная точность держится строкой на стороне API.
 */
export function formatAmount(amount: string, type: TransactionType): string {
  const sign = type === "EXPENSE" ? "−" : "+";
  return `${sign}${currencyFormatter.format(Number(amount))}`;
}

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** ISO-дата → "14 июл. 2026". */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
