import { ApiProperty } from "@nestjs/swagger";
import type { TransactionSummaryDto } from "@repo/shared";
import { TRANSACTION_TYPES, type TransactionType } from "@repo/shared";

/** Строка разбивки итогов: одна на пару «категория + тип операции». */
export class SummaryByCategoryResponseDto {
  @ApiProperty({ format: "uuid", example: "3f1a7c4e-9b2d-4a15-8c3e-2d6f0b7a1e94" })
  categoryId!: string;

  @ApiProperty({
    example: "Продукты",
    description: "Пустая строка, если категорию удалили после создания транзакций",
  })
  name!: string;

  @ApiProperty({ enum: TRANSACTION_TYPES, example: "EXPENSE" })
  type!: TransactionType;

  @ApiProperty({ example: "4300.00", description: "Сумма по категории строкой" })
  total!: string;
}

/**
 * Итоги за календарный месяц.
 *
 * Все суммы — строки (`Decimal.toFixed(2)`): JSON-число теряет точность на копейках.
 */
export class TransactionSummaryResponseDto implements TransactionSummaryDto {
  @ApiProperty({ example: "75000.00", description: "Сумма доходов за месяц" })
  income!: string;

  @ApiProperty({ example: "43250.10", description: "Сумма расходов за месяц" })
  expense!: string;

  @ApiProperty({ example: "31749.90", description: "income − expense; может быть отрицательным" })
  balance!: string;

  @ApiProperty({
    type: [SummaryByCategoryResponseDto],
    description: "Пустой массив, если за месяц транзакций не было",
  })
  byCategory!: SummaryByCategoryResponseDto[];
}
