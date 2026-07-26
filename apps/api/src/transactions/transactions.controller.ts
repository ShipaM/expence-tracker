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
  UseGuards,
} from "@nestjs/common";
import type { TransactionDto, TransactionSummaryDto } from "@repo/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TransactionsService } from "./transactions.service";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { QueryTransactionsDto } from "./dto/query-transactions.dto";
import { SummaryQueryDto } from "./dto/summary-query.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";

// Тело и query валидирует глобальный ValidationPipe (class-validator по DTO-классам).
@Controller("transactions")
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  // /summary объявлен до /:id, иначе ParseUUIDPipe перехватит слово "summary".
  @Get("summary")
  summary(
    @CurrentUser() userId: string,
    @Query() query: SummaryQueryDto,
  ): Promise<TransactionSummaryDto> {
    return this.transactions.summary(userId, query.month, query.year);
  }

  @Get()
  findAll(
    @CurrentUser() userId: string,
    @Query() query: QueryTransactionsDto,
  ): Promise<TransactionDto[]> {
    return this.transactions.findAll(userId, query);
  }

  @Get(":id")
  findOne(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TransactionDto> {
    return this.transactions.findOne(userId, id);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactions.create(userId, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactions.update(userId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.transactions.remove(userId, id);
  }
}
