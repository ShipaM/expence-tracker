import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { Prisma } from "@repo/db";
import type { Category, Payment, Transaction, User } from "@repo/db";
import type {
  CreatePaymentDto,
  PaidPaymentDto,
  PaymentDto,
  PaymentPeriod,
  QueryPaymentsDto,
  TransactionDto,
  UpcomingPaymentsDto,
  UpdatePaymentDto,
} from "@repo/shared";
import { PrismaService } from "../prisma/prisma.service";
import { GetUserByIdQuery } from "../users/contracts/get-user-by-id.query";

/** Платёж вместе с подгруженной категорией — форма, из которой собирается {@link PaymentDto}. */
type PaymentWithCategory = Payment & { category: Category };

/** Транзакция с подгруженной категорией — то, что создаёт {@link PaymentsService.pay}. */
type TransactionWithCategory = Transaction & { category: Category };

/**
 * На сколько месяцев сдвигает дату каждая периодичность; неделя обрабатывается отдельно.
 *
 * `switch`, а не таблица-`Record`: при включённом `noUncheckedIndexedAccess` индексация дала бы
 * `number | undefined`, а здесь все ветки заданы исчерпывающе.
 *
 * @param period Периодичность платежа, кроме недельной.
 * @returns Количество месяцев в одном периоде.
 */
function monthsInPeriod(period: Exclude<PaymentPeriod, "WEEKLY">): number {
  switch (period) {
    case "MONTHLY":
      return 1;
    case "QUARTERLY":
      return 3;
    case "YEARLY":
      return 12;
  }
}

/**
 * Сдвигает дату на один период вперёд.
 *
 * Считает по UTC — так же, как хранит Prisma и как считает агрегация транзакций. Для месячных
 * периодов дата прижимается к последнему дню месяца, если в целевом месяце нет такого числа:
 * 31 января + месяц даёт 28 (или 29) февраля, а не 2–3 марта, как получилось бы при наивном
 * `setUTCMonth`.
 *
 * @param date Текущая дата списания.
 * @param period Периодичность платежа.
 * @returns Новая дата списания.
 */
export function addPeriod(date: Date, period: PaymentPeriod): Date {
  if (period === "WEEKLY") {
    return new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + monthsInPeriod(period);
  const day = date.getUTCDate();

  // День 0 следующего месяца — последний день целевого: так узнаём, есть ли в нём нужное число.
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, lastDayOfTargetMonth),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/**
 * Регулярные платежи пользователя: шаблоны повторяющихся операций.
 *
 * Платёж сам по себе денег не двигает — он лишь описывает, что и когда должно списаться.
 * Фактом операции становится транзакция, которую создаёт {@link PaymentsService.pay}.
 *
 * Изоляция пользователей держится на фильтре по `userId` в каждом запросе; денежные суммы
 * наружу отдаются строками (`Decimal.toFixed(2)`).
 */
@Injectable()
export class PaymentsService {
  /**
   * @param prisma Доступ к Prisma-клиенту (`prisma.client`).
   * @param queryBus Шина запросов CQRS: через неё проверяется существование пользователя,
   *   без прямого импорта `UsersModule`.
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Возвращает регулярные платежи пользователя, ближайшие по дате списания — первыми.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param filters Фильтры `isActive`, `categoryId`, `dueBefore`; пустые не участвуют в запросе.
   * @returns Список платежей с категориями; пустой, если ничего не подошло.
   */
  async findAll(userId: string, filters: QueryPaymentsDto): Promise<PaymentDto[]> {
    const payments = await this.prisma.client.payment.findMany({
      where: {
        userId,
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters.categoryId && { categoryId: filters.categoryId }),
        ...(filters.dueBefore && { nextDueDate: { lte: new Date(filters.dueBefore) } }),
      },
      include: { category: true },
      orderBy: { nextDueDate: "asc" },
    });

    return payments.map((payment) => this.toDto(payment));
  }

  /**
   * Возвращает платежи, которые спишутся в ближайшие N дней, и суммы по типам.
   *
   * Учитываются только активные платежи: выключенные не спишутся, и в прогнозе им не место.
   * Просроченные (дата уже прошла) попадают в выборку — их всё равно предстоит оплатить.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param days Ширина окна в днях, 1–365.
   * @returns Платежи окна плюс `totalIncome` и `totalExpense` строками.
   */
  async upcoming(userId: string, days: number): Promise<UpcomingPaymentsDto> {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const payments = await this.prisma.client.payment.findMany({
      where: { userId, isActive: true, nextDueDate: { lte: until } },
      include: { category: true },
      orderBy: { nextDueDate: "asc" },
    });

    const zero = new Prisma.Decimal(0);
    const totals = payments.reduce(
      (acc, payment) => {
        if (payment.type === "INCOME") {
          return { ...acc, income: acc.income.plus(payment.amount) };
        }
        return { ...acc, expense: acc.expense.plus(payment.amount) };
      },
      { income: zero, expense: zero },
    );

    return {
      items: payments.map((payment) => this.toDto(payment)),
      totalIncome: totals.income.toFixed(2),
      totalExpense: totals.expense.toFixed(2),
    };
  }

  /**
   * Возвращает один платёж пользователя.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id Идентификатор платежа (UUID).
   * @returns Платёж с категорией.
   * @throws {NotFoundException} Платежа нет или он принадлежит другому пользователю
   *   (чужая запись неотличима от несуществующей).
   */
  async findOne(userId: string, id: string): Promise<PaymentDto> {
    const payment = await this.prisma.client.payment.findFirst({
      where: { id, userId },
      include: { category: true },
    });

    if (!payment) {
      throw new NotFoundException(`Платёж ${id} не найден`);
    }

    return this.toDto(payment);
  }

  /**
   * Создаёт регулярный платёж: сначала проверяет, что пользователь ещё существует, затем —
   * что категория принадлежит ему.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param dto Данные платежа; `amount` — строка, `nextDueDate` — ISO-8601.
   * @returns Созданный платёж с категорией.
   * @throws {UnauthorizedException} Пользователя из токена больше нет в БД (токен живёт
   *   7 дней и мог пережить удаление аккаунта).
   * @throws {NotFoundException} Категория не найдена или принадлежит другому пользователю.
   */
  async create(userId: string, dto: CreatePaymentDto): Promise<PaymentDto> {
    // CQRS: пользователь мог быть удалён, пока жил его 7-дневный токен.
    const user = await this.queryBus.execute<GetUserByIdQuery, User | null>(
      new GetUserByIdQuery(userId),
    );
    if (!user) {
      throw new UnauthorizedException("Пользователь не найден");
    }

    await this.assertCategoryOwned(userId, dto.categoryId);

    const payment = await this.prisma.client.payment.create({
      data: {
        userId,
        name: dto.name,
        amount: dto.amount,
        type: dto.type,
        period: dto.period,
        nextDueDate: new Date(dto.nextDueDate),
        description: dto.description ?? null,
        categoryId: dto.categoryId,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: true },
    });

    return this.toDto(payment);
  }

  /**
   * Частично обновляет платёж: в БД уходят только переданные поля.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id Идентификатор платежа (UUID).
   * @param dto Изменяемые поля; отсутствующие (`undefined`) не трогаются.
   * @returns Обновлённый платёж с категорией.
   * @throws {NotFoundException} Платёж не найден/чужой либо новая категория не найдена/чужая.
   */
  async update(userId: string, id: string, dto: UpdatePaymentDto): Promise<PaymentDto> {
    await this.findOne(userId, id);

    if (dto.categoryId !== undefined) {
      await this.assertCategoryOwned(userId, dto.categoryId);
    }

    const payment = await this.prisma.client.payment.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.period !== undefined && { period: dto.period }),
        ...(dto.nextDueDate !== undefined && { nextDueDate: new Date(dto.nextDueDate) }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: true },
    });

    return this.toDto(payment);
  }

  /**
   * Удаляет платёж пользователя. Уже созданные из него транзакции остаются — они факт,
   * а не часть шаблона.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id Идентификатор платежа (UUID).
   * @returns Ничего: успех — это отсутствие исключения (контроллер отвечает 204).
   * @throws {NotFoundException} Платёж не найден или принадлежит другому пользователю.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.client.payment.delete({ where: { id } });
  }

  /**
   * Отмечает платёж оплаченным: создаёт транзакцию по его данным и сдвигает дату следующего
   * списания на период вперёд.
   *
   * Оба действия идут в одной транзакции БД: иначе при сбое между ними пользователь получил бы
   * либо списание без сдвига даты (двойная оплата при повторе), либо сдвиг без транзакции
   * (потерянный расход). Дата транзакции — та, на которую платёж был назначен, а не «сейчас»:
   * платёж могли отметить с опозданием, и в отчёт он должен попасть по плановому месяцу.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id Идентификатор платежа (UUID).
   * @returns Созданная транзакция и платёж с новой `nextDueDate`.
   * @throws {NotFoundException} Платёж не найден или принадлежит другому пользователю.
   */
  async pay(userId: string, id: string): Promise<PaidPaymentDto> {
    const existing = await this.prisma.client.payment.findFirst({
      where: { id, userId },
      include: { category: true },
    });

    if (!existing) {
      throw new NotFoundException(`Платёж ${id} не найден`);
    }

    const [transaction, payment] = await this.prisma.client.$transaction([
      this.prisma.client.transaction.create({
        data: {
          userId,
          amount: existing.amount,
          type: existing.type,
          description: existing.description ?? existing.name,
          date: existing.nextDueDate,
          categoryId: existing.categoryId,
        },
        include: { category: true },
      }),
      this.prisma.client.payment.update({
        where: { id },
        data: { nextDueDate: addPeriod(existing.nextDueDate, existing.period) },
        include: { category: true },
      }),
    ]);

    return {
      payment: this.toDto(payment),
      transaction: this.toTransactionDto(transaction),
    };
  }

  /**
   * Проверяет, что категория существует и принадлежит пользователю.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param categoryId Идентификатор проверяемой категории (UUID).
   * @returns Ничего: успех — это отсутствие исключения.
   * @throws {NotFoundException} Категории нет или она принадлежит другому пользователю.
   */
  private async assertCategoryOwned(userId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.client.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      throw new NotFoundException(`Категория ${categoryId} не найдена`);
    }
  }

  /**
   * Приводит запись Prisma к ответу API.
   *
   * Decimal сериализуем строкой: JSON-число теряет точность на копейках. Даты — ISO-8601.
   *
   * @param payment Платёж с подгруженной категорией (`include: { category: true }`).
   * @returns DTO платежа для ответа API.
   */
  private toDto(payment: PaymentWithCategory): PaymentDto {
    return {
      id: payment.id,
      name: payment.name,
      amount: payment.amount.toFixed(2),
      type: payment.type,
      period: payment.period,
      nextDueDate: payment.nextDueDate.toISOString(),
      isActive: payment.isActive,
      description: payment.description,
      category: {
        id: payment.category.id,
        name: payment.category.name,
        color: payment.category.color,
        icon: payment.category.icon,
      },
      createdAt: payment.createdAt.toISOString(),
    };
  }

  /**
   * Приводит созданную транзакцию к ответу API.
   *
   * Дублирует `TransactionsService.toDto` намеренно: тянуть сюда сервис транзакций значило бы
   * связать модули ради четырёх строк маппинга.
   *
   * @param transaction Транзакция с подгруженной категорией.
   * @returns DTO транзакции для ответа API.
   */
  private toTransactionDto(transaction: TransactionWithCategory): TransactionDto {
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
