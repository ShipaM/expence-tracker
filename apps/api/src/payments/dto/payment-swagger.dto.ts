import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  CreatePaymentDto,
  PaidPaymentDto,
  PaymentDto,
  PaymentPeriod,
  UpcomingPaymentsDto,
} from "@repo/shared";
import { PAYMENT_PERIODS, TRANSACTION_TYPES, type TransactionType } from "@repo/shared";
import { CategoryResponseDto } from "../../categories/dto/category-response.dto";
import { TransactionResponseDto } from "../../transactions/dto/transaction-response.dto";

/**
 * Схемы запросов и ответов `/api/payments` для Swagger.
 *
 * Модуль валидируется zod-схемами из `@repo/shared` (способ по умолчанию для новых модулей),
 * поэтому у Nest нет метаданных о телах запросов — эти классы нужны только для документации и
 * подставляются через `@ApiBody`/`@ApiResponse`. В рантайме они не участвуют: проверяет
 * `ZodValidationPipe`.
 *
 * Классы `implements` те же типы, что отдаёт сервис, поэтому состав полей разойтись не может —
 * расхождение поймает `typecheck`. Ограничения (длины, диапазоны) продублированы из
 * `createPaymentSchema`; меняете схему — поправьте и здесь.
 */

/** Тело `POST /api/payments`. */
export class CreatePaymentRequestDto implements CreatePaymentDto {
  @ApiProperty({ minLength: 1, maxLength: 60, example: "Подписка на музыку" })
  name!: string;

  @ApiProperty({
    example: "299.00",
    pattern: "^\\d+(\\.\\d{1,2})?$",
    description: "Строка, а не число: в БД Decimal(12,2), а JSON-число теряет копейки",
  })
  amount!: string;

  @ApiProperty({ enum: TRANSACTION_TYPES, example: "EXPENSE" })
  type!: TransactionType;

  @ApiProperty({ enum: PAYMENT_PERIODS, example: "MONTHLY" })
  period!: PaymentPeriod;

  @ApiProperty({
    format: "date-time",
    example: "2026-09-01T00:00:00.000Z",
    description: "Дата ближайшего списания",
  })
  nextDueDate!: string;

  @ApiProperty({ format: "uuid", description: "Категория должна принадлежать пользователю" })
  categoryId!: string;

  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true, example: "Семейный тариф" })
  description?: string | null;

  @ApiPropertyOptional({
    default: true,
    description: "Выключенный платёж не попадает в прогноз ближайших списаний",
  })
  isActive?: boolean;
}

/** Тело `PATCH /api/payments/:id`: все поля необязательны. */
export class UpdatePaymentRequestDto implements Partial<CreatePaymentDto> {
  @ApiPropertyOptional({ minLength: 1, maxLength: 60, example: "Подписка на музыку" })
  name?: string;

  @ApiPropertyOptional({ example: "349.00", pattern: "^\\d+(\\.\\d{1,2})?$" })
  amount?: string;

  @ApiPropertyOptional({ enum: TRANSACTION_TYPES })
  type?: TransactionType;

  @ApiPropertyOptional({ enum: PAYMENT_PERIODS })
  period?: PaymentPeriod;

  @ApiPropertyOptional({ format: "date-time", example: "2026-10-01T00:00:00.000Z" })
  nextDueDate?: string;

  @ApiPropertyOptional({ format: "uuid" })
  categoryId?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  description?: string | null;

  @ApiPropertyOptional()
  isActive?: boolean;
}

/** Регулярный платёж в ответе API. */
export class PaymentResponseDto implements PaymentDto {
  @ApiProperty({ format: "uuid", example: "0c4f7a21-8b6d-4e93-a5f1-7d2c9e0b3a68" })
  id!: string;

  @ApiProperty({ example: "Подписка на музыку" })
  name!: string;

  @ApiProperty({ example: "299.00" })
  amount!: string;

  @ApiProperty({ enum: TRANSACTION_TYPES, example: "EXPENSE" })
  type!: TransactionType;

  @ApiProperty({ enum: PAYMENT_PERIODS, example: "MONTHLY" })
  period!: PaymentPeriod;

  @ApiProperty({ format: "date-time", example: "2026-09-01T00:00:00.000Z" })
  nextDueDate!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, nullable: true, example: "Семейный тариф" })
  description!: string | null;

  @ApiProperty({ type: CategoryResponseDto })
  category!: CategoryResponseDto;

  @ApiProperty({ format: "date-time", example: "2026-08-06T12:34:56.789Z" })
  createdAt!: string;
}

/** Ответ `POST /api/payments/:id/pay`. */
export class PaidPaymentResponseDto implements PaidPaymentDto {
  @ApiProperty({ type: PaymentResponseDto, description: "Платёж с уже сдвинутой nextDueDate" })
  payment!: PaymentResponseDto;

  @ApiProperty({ type: TransactionResponseDto, description: "Созданная по платежу транзакция" })
  transaction!: TransactionResponseDto;
}

/** Ответ `GET /api/payments/upcoming`. */
export class UpcomingPaymentsResponseDto implements UpcomingPaymentsDto {
  @ApiProperty({ type: [PaymentResponseDto] })
  items!: PaymentResponseDto[];

  @ApiProperty({ example: "75000.00", description: "Сумма ожидаемых поступлений за окно" })
  totalIncome!: string;

  @ApiProperty({ example: "12480.00", description: "Сумма ожидаемых списаний за окно" })
  totalExpense!: string;
}
