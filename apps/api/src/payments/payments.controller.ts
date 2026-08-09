import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  createPaymentSchema,
  queryPaymentsSchema,
  upcomingPaymentsSchema,
  updatePaymentSchema,
  type CreatePaymentDto,
  type PaidPaymentDto,
  type PaymentDto,
  type QueryPaymentsDto,
  type UpcomingPaymentsDto,
  type UpcomingPaymentsQueryDto,
  type UpdatePaymentDto,
} from "@repo/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import {
  CreatePaymentRequestDto,
  PaidPaymentResponseDto,
  PaymentResponseDto,
  UpcomingPaymentsResponseDto,
  UpdatePaymentRequestDto,
} from "./dto/payment-swagger.dto";
import { PaymentsService } from "./payments.service";

/**
 * HTTP-эндпоинты `/api/payments` — регулярные платежи.
 *
 * Весь контроллер закрыт `JwtAuthGuard`: без валидного Bearer-токена любой метод отвечает 401,
 * а `userId` берётся из токена через `@CurrentUser()`, а не из параметров запроса.
 *
 * Валидация — zod-схемами из `@repo/shared` (способ по умолчанию для новых модулей). Пайп
 * вешается **на параметр**: через `@UsePipes()` он применился бы и к строковому `id` из пути
 * и упал бы с «expected object, received string».
 */
@ApiTags("payments")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Токен отсутствует, истёк или неверен" })
@Controller("payments")
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  /** @param payments Сервис с бизнес-логикой регулярных платежей. */
  constructor(private readonly payments: PaymentsService) {}

  /**
   * `GET /api/payments/upcoming` — что спишется в ближайшие N дней.
   *
   * Маршрут объявлен до `/:id`, иначе `ParseUUIDPipe` перехватит слово "upcoming".
   *
   * @param userId Идентификатор пользователя из токена.
   * @param query Ширина окна `days`, 1–365; по умолчанию 30.
   * @returns Активные платежи окна и суммы по типам строками.
   * @throws {BadRequestException} 400: `days` не число или вне диапазона.
   */
  @ApiOperation({
    summary: "Ближайшие списания",
    description:
      "Только активные платежи. Просроченные (дата уже прошла) тоже попадают в выборку — " +
      "их всё равно предстоит оплатить.",
  })
  @ApiQuery({ name: "days", required: false, schema: { type: "integer", minimum: 1, maximum: 365, default: 30 } })
  @ApiResponse({ status: 200, description: "Платежи окна и итоги", type: UpcomingPaymentsResponseDto })
  @ApiResponse({ status: 400, description: "days вне диапазона 1–365" })
  @Get("upcoming")
  upcoming(
    @CurrentUser() userId: string,
    @Query(new ZodValidationPipe(upcomingPaymentsSchema)) query: UpcomingPaymentsQueryDto,
  ): Promise<UpcomingPaymentsDto> {
    return this.payments.upcoming(userId, query.days);
  }

  /**
   * `GET /api/payments` — регулярные платежи пользователя, ближайшие по дате — первыми.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param query Фильтры `isActive`, `categoryId`, `dueBefore` — все необязательны.
   * @returns Список платежей с категориями.
   * @throws {BadRequestException} 400: неизвестный параметр или неверный формат.
   */
  @ApiOperation({ summary: "Список платежей" })
  @ApiQuery({ name: "isActive", required: false, enum: ["true", "false"] })
  @ApiQuery({ name: "categoryId", required: false, schema: { type: "string", format: "uuid" } })
  @ApiQuery({ name: "dueBefore", required: false, schema: { type: "string", format: "date-time" } })
  @ApiResponse({ status: 200, description: "Платежи пользователя", type: [PaymentResponseDto] })
  @ApiResponse({ status: 400, description: "Параметры не прошли валидацию" })
  @Get()
  findAll(
    @CurrentUser() userId: string,
    @Query(new ZodValidationPipe(queryPaymentsSchema)) query: QueryPaymentsDto,
  ): Promise<PaymentDto[]> {
    return this.payments.findAll(userId, query);
  }

  /**
   * `GET /api/payments/:id` — один платёж.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id UUID платежа из пути.
   * @returns Платёж с категорией.
   * @throws {BadRequestException} 400 от `ParseUUIDPipe`: `id` не UUID.
   * @throws {NotFoundException} 404: платежа нет или он принадлежит другому пользователю.
   */
  @ApiOperation({
    summary: "Платёж по id",
    description: "Чужой платёж неотличим от несуществующего — в обоих случаях 404.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Идентификатор платежа" })
  @ApiResponse({ status: 200, description: "Платёж", type: PaymentResponseDto })
  @ApiResponse({ status: 400, description: "id не UUID" })
  @ApiResponse({ status: 404, description: "Платёж не найден или принадлежит другому пользователю" })
  @Get(":id")
  findOne(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PaymentDto> {
    return this.payments.findOne(userId, id);
  }

  /**
   * `POST /api/payments` — создать регулярный платёж.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param dto Тело: `name`, `amount`, `type`, `period`, `nextDueDate`, `categoryId`.
   * @returns Созданный платёж (201).
   * @throws {BadRequestException} 400: тело не прошло zod-схему (в ответе — `issues`).
   * @throws {UnauthorizedException} 401: токен невалиден либо пользователя больше нет в БД.
   * @throws {NotFoundException} 404: категория не найдена или чужая.
   */
  @ApiOperation({
    summary: "Создать платёж",
    description:
      "Платёж сам по себе денег не двигает — это шаблон. Фактом операции становится " +
      "транзакция, которую создаёт POST /payments/:id/pay.",
  })
  @ApiBody({ type: CreatePaymentRequestDto })
  @ApiResponse({ status: 201, description: "Платёж создан", type: PaymentResponseDto })
  @ApiResponse({ status: 400, description: "Тело не прошло валидацию" })
  @ApiResponse({ status: 401, description: "Токен невалиден либо пользователя из токена больше нет" })
  @ApiResponse({ status: 404, description: "Категория не найдена или принадлежит другому пользователю" })
  @Post()
  create(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createPaymentSchema)) dto: CreatePaymentDto,
  ): Promise<PaymentDto> {
    return this.payments.create(userId, dto);
  }

  /**
   * `PATCH /api/payments/:id` — частично обновить платёж.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id UUID платежа из пути.
   * @param dto Изменяемые поля; непереданные остаются как были.
   * @returns Обновлённый платёж.
   * @throws {BadRequestException} 400: `id` не UUID либо тело не прошло схему.
   * @throws {NotFoundException} 404: платёж не найден/чужой либо новая категория не найдена/чужая.
   */
  @ApiOperation({
    summary: "Обновить платёж",
    description: "Частичное обновление: непереданные поля остаются как были.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Идентификатор платежа" })
  @ApiBody({ type: UpdatePaymentRequestDto })
  @ApiResponse({ status: 200, description: "Обновлённый платёж", type: PaymentResponseDto })
  @ApiResponse({ status: 400, description: "id не UUID либо тело не прошло валидацию" })
  @ApiResponse({ status: 404, description: "Платёж не найден/чужой либо категория не найдена/чужая" })
  @Patch(":id")
  update(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePaymentSchema)) dto: UpdatePaymentDto,
  ): Promise<PaymentDto> {
    return this.payments.update(userId, id, dto);
  }

  /**
   * `POST /api/payments/:id/pay` — отметить платёж оплаченным.
   *
   * Создаёт транзакцию по данным платежа и сдвигает `nextDueDate` на период вперёд. Оба
   * действия идут в одной транзакции БД.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id UUID платежа из пути.
   * @returns Созданная транзакция и платёж с новой датой списания (201).
   * @throws {BadRequestException} 400 от `ParseUUIDPipe`: `id` не UUID.
   * @throws {NotFoundException} 404: платежа нет или он принадлежит другому пользователю.
   */
  @ApiOperation({
    summary: "Отметить оплаченным",
    description:
      "Дата транзакции — та, на которую платёж был назначен, а не «сейчас»: платёж могли " +
      "отметить с опозданием, и в отчёт он должен попасть по плановому месяцу.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Идентификатор платежа" })
  @ApiResponse({ status: 201, description: "Транзакция создана, дата сдвинута", type: PaidPaymentResponseDto })
  @ApiResponse({ status: 400, description: "id не UUID" })
  @ApiResponse({ status: 404, description: "Платёж не найден или принадлежит другому пользователю" })
  @Post(":id/pay")
  pay(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PaidPaymentDto> {
    return this.payments.pay(userId, id);
  }

  /**
   * `DELETE /api/payments/:id` — удалить платёж.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id UUID платежа из пути.
   * @returns Пустой ответ со статусом 204.
   * @throws {BadRequestException} 400 от `ParseUUIDPipe`: `id` не UUID.
   * @throws {NotFoundException} 404: платежа нет или он принадлежит другому пользователю.
   */
  @ApiOperation({
    summary: "Удалить платёж",
    description: "Уже созданные из него транзакции остаются — они факт, а не часть шаблона.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Идентификатор платежа" })
  @ApiResponse({ status: 204, description: "Платёж удалён, тело ответа пустое" })
  @ApiResponse({ status: 400, description: "id не UUID" })
  @ApiResponse({ status: 404, description: "Платёж не найден или принадлежит другому пользователю" })
  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.payments.remove(userId, id);
  }
}
