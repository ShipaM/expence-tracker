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
  UseGuards,
} from "@nestjs/common";
import {
  createExpenseSchema,
  updateExpenseSchema,
  type CreateExpenseDto,
  type ExpenseDto,
  type UpdateExpenseDto,
} from "@repo/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ExpensesService } from "./expenses.service";

@Controller("expenses")
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  findAll(@CurrentUser() userId: string): Promise<ExpenseDto[]> {
    return this.expenses.findAll(userId);
  }

  @Get(":id")
  findOne(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ExpenseDto> {
    return this.expenses.findOne(userId, id);
  }

  // Пайп вешаем на @Body, а не через @UsePipes: последний применяется ко всем
  // аргументам метода и валидация падает на userId.
  @Post()
  create(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createExpenseSchema)) dto: CreateExpenseDto,
  ): Promise<ExpenseDto> {
    return this.expenses.create(userId, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateExpenseSchema)) dto: UpdateExpenseDto,
  ): Promise<ExpenseDto> {
    return this.expenses.update(userId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.expenses.remove(userId, id);
  }
}
