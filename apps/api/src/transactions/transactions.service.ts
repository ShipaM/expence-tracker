import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { Prisma } from "@repo/db";
import type { Category, Transaction, User } from "@repo/db";
import type {
  PaginatedTransactionsDto,
  TransactionDto,
  TransactionSummaryDto,
} from "@repo/shared";
import { PrismaService } from "../prisma/prisma.service";
import { GetUserByIdQuery } from "../users/contracts/get-user-by-id.query";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { QueryTransactionsDto } from "./dto/query-transactions.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";

type TransactionWithCategory = Transaction & { category: Category };

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBus: QueryBus,
  ) {}

  async findAll(
    userId: string,
    filters: QueryTransactionsDto,
  ): Promise<PaginatedTransactionsDto> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(filters.type && { type: filters.type }),
      ...(filters.categoryId && { categoryId: filters.categoryId }),
      ...((filters.dateFrom || filters.dateTo) && {
        date: {
          ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
          ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
        },
      }),
    };

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const [transactions, total] = await Promise.all([
      this.prisma.client.transaction.findMany({
        where,
        include: { category: true },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.transaction.count({ where }),
    ]);

    return {
      items: transactions.map((transaction) => this.toDto(transaction)),
      total,
      page,
      limit,
    };
  }

  async findOne(userId: string, id: string): Promise<TransactionDto> {
    const transaction = await this.prisma.client.transaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Транзакция ${id} не найдена`);
    }

    return this.toDto(transaction);
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionDto> {
    // CQRS: пользователь мог быть удалён, пока жил его 7-дневный токен.
    const user = await this.queryBus.execute<GetUserByIdQuery, User | null>(
      new GetUserByIdQuery(userId),
    );
    if (!user) {
      throw new UnauthorizedException("Пользователь не найден");
    }

    await this.assertCategoryOwned(userId, dto.categoryId);

    const transaction = await this.prisma.client.transaction.create({
      data: {
        userId,
        amount: dto.amount,
        type: dto.type,
        description: dto.description ?? null,
        date: new Date(dto.date),
        categoryId: dto.categoryId,
      },
      include: { category: true },
    });

    return this.toDto(transaction);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto): Promise<TransactionDto> {
    await this.findOne(userId, id);

    if (dto.categoryId !== undefined) {
      await this.assertCategoryOwned(userId, dto.categoryId);
    }

    const transaction = await this.prisma.client.transaction.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: { category: true },
    });

    return this.toDto(transaction);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.client.transaction.delete({ where: { id } });
  }

  async summary(userId: string, month: number, year: number): Promise<TransactionSummaryDto> {
    // Полуинтервал [начало месяца, начало следующего) — по UTC, как хранит Prisma.
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const where: Prisma.TransactionWhereInput = { userId, date: { gte: start, lt: end } };

    const zero = new Prisma.Decimal(0);

    const byType = await this.prisma.client.transaction.groupBy({
      by: ["type"],
      where,
      _sum: { amount: true },
    });
    const income = byType.find((group) => group.type === "INCOME")?._sum.amount ?? zero;
    const expense = byType.find((group) => group.type === "EXPENSE")?._sum.amount ?? zero;
    const balance = income.minus(expense);

    const grouped = await this.prisma.client.transaction.groupBy({
      by: ["categoryId", "type"],
      where,
      _sum: { amount: true },
    });
    const categoryIds = [...new Set(grouped.map((group) => group.categoryId))];
    const categories = await this.prisma.client.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(categories.map((category) => [category.id, category.name]));

    const byCategory = grouped.map((group) => ({
      categoryId: group.categoryId,
      name: nameById.get(group.categoryId) ?? "",
      type: group.type,
      total: (group._sum.amount ?? zero).toFixed(2),
    }));

    return {
      income: income.toFixed(2),
      expense: expense.toFixed(2),
      balance: balance.toFixed(2),
      byCategory,
    };
  }

  private async assertCategoryOwned(userId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.client.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      throw new NotFoundException(`Категория ${categoryId} не найдена`);
    }
  }

  // Decimal сериализуем строкой: JSON-число теряет точность на копейках.
  private toDto(transaction: TransactionWithCategory): TransactionDto {
    return {
      id: transaction.id,
      amount: transaction.amount.toFixed(2),
      type: transaction.type,
      description: transaction.description,
      date: transaction.date.toISOString(),
      category: {
        id: transaction.category.id,
        name: transaction.category.name,
        color: transaction.category.color,
        icon: transaction.category.icon,
      },
      createdAt: transaction.createdAt.toISOString(),
    };
  }
}
