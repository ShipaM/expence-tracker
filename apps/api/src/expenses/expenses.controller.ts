import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
} from "@nestjs/common";
import {
  createExpenseSchema,
  updateExpenseSchema,
  type CreateExpenseDto,
  type ExpenseDto,
  type UpdateExpenseDto,
} from "@repo/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ExpensesService } from "./expenses.service";

// TODO: userId придёт из guard'а после появления аутентификации.
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  findAll(@Query("userId", ParseUUIDPipe) userId: string): Promise<ExpenseDto[]> {
    return this.expenses.findAll(userId);
  }

  @Get(":id")
  findOne(
    @Query("userId", ParseUUIDPipe) userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ExpenseDto> {
    return this.expenses.findOne(userId, id);
  }

  // Пайп вешаем на @Body, а не через @UsePipes: последний применяется ко всем
  // аргументам метода, включая userId из query, и валидация падает на строке.
  @Post()
  create(
    @Query("userId", ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(createExpenseSchema)) dto: CreateExpenseDto,
  ): Promise<ExpenseDto> {
    return this.expenses.create(userId, dto);
  }

  @Patch(":id")
  update(
    @Query("userId", ParseUUIDPipe) userId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateExpenseSchema)) dto: UpdateExpenseDto,
  ): Promise<ExpenseDto> {
    return this.expenses.update(userId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @Query("userId", ParseUUIDPipe) userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.expenses.remove(userId, id);
  }
}
