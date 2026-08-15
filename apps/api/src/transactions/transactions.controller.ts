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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { PaginatedTransactionsDto, TransactionDto, TransactionSummaryDto } from "@repo/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TransactionsService } from "./transactions.service";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { QueryTransactionsDto } from "./dto/query-transactions.dto";
import { SummaryQueryDto } from "./dto/summary-query.dto";
import { TransactionSummaryResponseDto } from "./dto/summary-response.dto";
import {
  PaginatedTransactionsResponseDto,
  TransactionResponseDto,
} from "./dto/transaction-response.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";

/**
 * HTTP-эндпоинты `/api/transactions`.
 *
 * Весь контроллер закрыт `JwtAuthGuard`: без валидного Bearer-токена любой метод отвечает 401,
 * а `userId` берётся из токена через `@CurrentUser()`, а не из параметров запроса.
 * Тело и query валидирует глобальный ValidationPipe (class-validator по DTO-классам).
 */
@ApiTags("transactions")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Токен отсутствует, истёк или неверен" })
@Controller("transactions")
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  /** @param transactions Сервис с бизнес-логикой транзакций. */
  constructor(private readonly transactions: TransactionsService) {}

  /**
   * `GET /api/transactions/summary` — итоги за календарный месяц.
   *
   * Маршрут объявлен до `/:id`, иначе `ParseUUIDPipe` перехватит слово "summary".
   *
   * @param userId Идентификатор пользователя из токена.
   * @param query Обязательные `month` (1–12) и `year` (2000–2100).
   * @returns Доход, расход, баланс и разбивка по категориям — суммы строками.
   * @throws {BadRequestException} 400 от ValidationPipe: `month`/`year` отсутствуют или вне
   *   диапазона.
   * @throws {UnauthorizedException} 401 от `JwtAuthGuard`: токена нет, он истёк или неверен.
   */
  @ApiOperation({
    summary: "Итоги за месяц",
    description:
      "Доход, расход, баланс и разбивка по категориям за календарный месяц. " +
      "Суммы возвращаются строками: в БД Decimal(12,2), а JSON-число теряет копейки.",
  })
  @ApiResponse({ status: 200, description: "Итоги за месяц", type: TransactionSummaryResponseDto })
  @ApiResponse({ status: 400, description: "month/year отсутствуют или вне диапазона" })
  @Get("summary")
  summary(
    @CurrentUser() userId: string,
    @Query() query: SummaryQueryDto,
  ): Promise<TransactionSummaryDto> {
    return this.transactions.summary(userId, query.month, query.year);
  }

  /**
   * `GET /api/transactions` — страница транзакций пользователя, сначала новые.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param query Фильтры (`dateFrom`, `dateTo`, `type`, `categoryId`) и пагинация
   *   (`page`, `limit`) — все необязательны.
   * @returns Список транзакций и метаданные страницы (`total`, `page`, `limit`).
   * @throws {BadRequestException} 400 от ValidationPipe: неизвестный query-параметр или
   *   значение не того формата.
   * @throws {UnauthorizedException} 401 от `JwtAuthGuard`: токена нет, он истёк или неверен.
   */
  @ApiOperation({
    summary: "Список транзакций",
    description:
      "Страница транзакций текущего пользователя, сначала новые. Все фильтры необязательны; " +
      "по умолчанию page=1, limit=20.",
  })
  @ApiResponse({
    status: 200,
    description: "Страница транзакций и метаданные пагинации",
    type: PaginatedTransactionsResponseDto,
  })
  @ApiResponse({ status: 400, description: "Неизвестный query-параметр или неверный формат" })
  @Get()
  findAll(
    @CurrentUser() userId: string,
    @Query() query: QueryTransactionsDto,
  ): Promise<PaginatedTransactionsDto> {
    return this.transactions.findAll(userId, query);
  }

  /**
   * `GET /api/transactions/:id` — одна транзакция пользователя.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id UUID транзакции из пути.
   * @returns Транзакция с категорией.
   * @throws {BadRequestException} 400 от `ParseUUIDPipe`: `id` не UUID.
   * @throws {UnauthorizedException} 401 от `JwtAuthGuard`: токена нет, он истёк или неверен.
   * @throws {NotFoundException} 404: транзакции нет или она принадлежит другому пользователю.
   */
  @ApiOperation({
    summary: "Транзакция по id",
    description:
      "Чужая транзакция неотличима от несуществующей — в обоих случаях 404, " +
      "чтобы не раскрывать факт её существования.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Идентификатор транзакции" })
  @ApiResponse({
    status: 200,
    description: "Транзакция с категорией",
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 400, description: "id не UUID" })
  @ApiResponse({
    status: 404,
    description: "Транзакция не найдена или принадлежит другому пользователю",
  })
  @Get(":id")
  findOne(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TransactionDto> {
    return this.transactions.findOne(userId, id);
  }

  /**
   * `POST /api/transactions` — создать транзакцию.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param dto Тело запроса: `amount`, `type`, `date`, `categoryId` и необязательное
   *   `description`.
   * @returns Созданная транзакция (201).
   * @throws {BadRequestException} 400 от ValidationPipe: поле отсутствует, не того формата
   *   или лишнее (`forbidNonWhitelisted`).
   * @throws {UnauthorizedException} 401: токен невалиден либо пользователя из токена больше
   *   нет в БД.
   * @throws {NotFoundException} 404: категория не найдена или принадлежит другому пользователю.
   */
  @ApiOperation({
    summary: "Создать транзакцию",
    description:
      "Категория должна принадлежать текущему пользователю. Перед созданием проверяется, " +
      "что пользователь из токена ещё существует: токен живёт 7 дней и мог пережить удаление аккаунта.",
  })
  @ApiResponse({ status: 201, description: "Транзакция создана", type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: "Тело не прошло валидацию или содержит лишние поля" })
  @ApiResponse({
    status: 401,
    description: "Токен невалиден либо пользователя из токена больше нет",
  })
  @ApiResponse({
    status: 404,
    description: "Категория не найдена или принадлежит другому пользователю",
  })
  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactions.create(userId, dto);
  }

  /**
   * `PATCH /api/transactions/:id` — частично обновить транзакцию.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id UUID транзакции из пути.
   * @param dto Изменяемые поля; все необязательны, непереданные остаются как были.
   * @returns Обновлённая транзакция.
   * @throws {BadRequestException} 400: `id` не UUID либо тело не прошло валидацию.
   * @throws {UnauthorizedException} 401 от `JwtAuthGuard`: токена нет, он истёк или неверен.
   * @throws {NotFoundException} 404: транзакция не найдена/чужая либо новая категория не
   *   найдена/чужая.
   */
  @ApiOperation({
    summary: "Обновить транзакцию",
    description: "Частичное обновление: непереданные поля остаются как были.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Идентификатор транзакции" })
  @ApiResponse({ status: 200, description: "Обновлённая транзакция", type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: "id не UUID либо тело не прошло валидацию" })
  @ApiResponse({
    status: 404,
    description: "Транзакция не найдена/чужая либо новая категория не найдена/чужая",
  })
  @Patch(":id")
  update(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactions.update(userId, id, dto);
  }

  /**
   * `DELETE /api/transactions/:id` — удалить транзакцию.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id UUID транзакции из пути.
   * @returns Пустой ответ со статусом 204.
   * @throws {BadRequestException} 400 от `ParseUUIDPipe`: `id` не UUID.
   * @throws {UnauthorizedException} 401 от `JwtAuthGuard`: токена нет, он истёк или неверен.
   * @throws {NotFoundException} 404: транзакции нет или она принадлежит другому пользователю.
   */
  @ApiOperation({ summary: "Удалить транзакцию" })
  @ApiParam({ name: "id", format: "uuid", description: "Идентификатор транзакции" })
  @ApiResponse({ status: 204, description: "Транзакция удалена, тело ответа пустое" })
  @ApiResponse({ status: 400, description: "id не UUID" })
  @ApiResponse({
    status: 404,
    description: "Транзакция не найдена или принадлежит другому пользователю",
  })
  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.transactions.remove(userId, id);
  }
}
