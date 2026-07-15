import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateExpenseDto, ExpenseDto, UpdateExpenseDto } from "@repo/shared";
import type { Expense, Category } from "@repo/db";
import { PrismaService } from "../prisma/prisma.service";

type ExpenseWithCategory = Expense & { category: Category | null };

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<ExpenseDto[]> {
    const expenses = await this.prisma.client.expense.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { spentAt: "desc" },
    });

    return expenses.map((expense) => this.toDto(expense));
  }

  async findOne(userId: string, id: string): Promise<ExpenseDto> {
    const expense = await this.prisma.client.expense.findFirst({
      where: { id, userId },
      include: { category: true },
    });

    if (!expense) {
      throw new NotFoundException(`Расход ${id} не найден`);
    }

    return this.toDto(expense);
  }

  async create(userId: string, dto: CreateExpenseDto): Promise<ExpenseDto> {
    const expense = await this.prisma.client.expense.create({
      data: {
        userId,
        title: dto.title,
        amount: dto.amount,
        type: dto.type,
        spentAt: new Date(dto.spentAt),
        note: dto.note ?? null,
        categoryId: dto.categoryId ?? null,
      },
      include: { category: true },
    });

    return this.toDto(expense);
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto): Promise<ExpenseDto> {
    await this.findOne(userId, id);

    const expense = await this.prisma.client.expense.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.spentAt !== undefined && { spentAt: new Date(dto.spentAt) }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: { category: true },
    });

    return this.toDto(expense);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.client.expense.delete({ where: { id } });
  }

  // Decimal сериализуем строкой: JSON-число теряет точность на копейках.
  private toDto(expense: ExpenseWithCategory): ExpenseDto {
    return {
      id: expense.id,
      title: expense.title,
      amount: expense.amount.toFixed(2),
      type: expense.type,
      spentAt: expense.spentAt.toISOString(),
      note: expense.note,
      category: expense.category
        ? {
            id: expense.category.id,
            name: expense.category.name,
            color: expense.category.color,
          }
        : null,
      createdAt: expense.createdAt.toISOString(),
    };
  }
}
