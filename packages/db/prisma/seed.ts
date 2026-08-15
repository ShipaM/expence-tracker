import path from "node:path";
import * as bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";
import { expand } from "dotenv-expand";
import { createPrismaClient } from "../dist/index.js";

// .env лежит в корне монорепо, а скрипт запускается из packages/db — путь задаём явно,
// как в prisma.config.ts. expand разворачивает ${POSTGRES_*} внутри DATABASE_URL.
expand(loadEnv({ path: path.join(import.meta.dirname, "..", "..", "..", ".env") }));

/**
 * Демо-аккаунт. Сид работает **только** с этим пользователем: находит по email, сносит
 * его вместе с данными (каскадом) и создаёт заново. Чужие аккаунты в базе не трогаются —
 * там могут лежать настоящие данные разработчика.
 */
const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo1234";
const DEMO_NAME = "Демо Пользователь";

/** Та же стоимость, что в AuthService — иначе вход демо-аккаунтом не сработает. */
const BCRYPT_ROUNDS = 10;

type CategorySeed = {
  name: string;
  color: string;
  icon: string;
  kind: "EXPENSE" | "INCOME";
};

const CATEGORIES: CategorySeed[] = [
  { name: "Продукты", color: "#2c6349", icon: "shopping-cart", kind: "EXPENSE" },
  { name: "Кафе и рестораны", color: "#b3352c", icon: "utensils", kind: "EXPENSE" },
  { name: "Транспорт", color: "#3b6ea5", icon: "bus", kind: "EXPENSE" },
  { name: "Жильё", color: "#6b4f8a", icon: "home", kind: "EXPENSE" },
  { name: "Здоровье", color: "#0f766e", icon: "heart-pulse", kind: "EXPENSE" },
  { name: "Развлечения", color: "#b06a1f", icon: "clapperboard", kind: "EXPENSE" },
  { name: "Подписки", color: "#5b5f97", icon: "repeat", kind: "EXPENSE" },
  { name: "Зарплата", color: "#16202b", icon: "wallet", kind: "INCOME" },
  { name: "Фриланс", color: "#2f6b4f", icon: "laptop", kind: "INCOME" },
];

/**
 * Повседневные траты: из них набирается лента.
 *
 * `weight` — во сколько раз категория вероятнее прочих: за продуктами ходят чаще,
 * чем к стоматологу. Без веса лента получается неправдоподобной, а расходы улетают
 * выше доходов.
 */
const DAILY_EXPENSES: Record<
  string,
  { descriptions: string[]; min: number; max: number; weight: number }
> = {
  Продукты: {
    descriptions: ["Пятёрочка", "Магнит", "Ашан", "Вкусвилл", "Рынок", "Лента"],
    min: 340,
    max: 3200,
    weight: 6,
  },
  "Кафе и рестораны": {
    descriptions: ["Кофе с собой", "Обед в столовой", "Ужин с друзьями", "Доставка пиццы"],
    min: 180,
    max: 2400,
    weight: 4,
  },
  Транспорт: {
    descriptions: ["Метро", "Такси", "Бензин", "Каршеринг", "Проездной"],
    min: 60,
    max: 1800,
    weight: 5,
  },
  Развлечения: {
    descriptions: ["Кино", "Концерт", "Книги", "Настольные игры", "Музей"],
    min: 300,
    max: 3400,
    weight: 2,
  },
  Здоровье: {
    descriptions: ["Аптека", "Приём у врача", "Анализы", "Стоматолог"],
    min: 450,
    max: 5200,
    weight: 1,
  },
};

/** Крупные обязательные платежи — раз в месяц, а не вперемешку с кофе. */
const MONTHLY_EXPENSES: {
  category: string;
  description: string;
  dayOfMonth: number;
  amount: [number, number];
}[] = [
  { category: "Жильё", description: "Аренда квартиры", dayOfMonth: 5, amount: [45000, 45000] },
  { category: "Жильё", description: "Коммунальные услуги", dayOfMonth: 12, amount: [3200, 6400] },
  { category: "Жильё", description: "Интернет", dayOfMonth: 12, amount: [800, 800] },
  { category: "Подписки", description: "Музыка", dayOfMonth: 11, amount: [299, 299] },
  { category: "Подписки", description: "Онлайн-кинотеатр", dayOfMonth: 23, amount: [599, 599] },
];

/** Детерминированный генератор: один и тот же сид даёт одну и ту же базу. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const random = createRandom(20260809);

function pick<T>(items: T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error("Пустой список для выбора");
  }
  return item;
}

/** Имена повседневных категорий, повторённые по весу: чем больше вес, тем чаще выпадает. */
const WEIGHTED_DAILY = Object.entries(DAILY_EXPENSES).flatMap(([name, pattern]) =>
  Array.from({ length: pattern.weight }, () => name),
);

/** Сумма в рублях с копейками, строкой — Decimal(12,2) принимает строку без потери точности. */
function amountBetween(min: number, max: number): string {
  return (min + random() * (max - min)).toFixed(2);
}

function daysAgo(days: number, hour: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, Math.floor(random() * 60), 0, 0);
  return date;
}

function daysAhead(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(9, 0, 0, 0);
  return date;
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();

  try {
    const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (existing) {
      // Каскад в схеме снесёт категории, транзакции и платежи этого пользователя.
      await prisma.user.delete({ where: { id: existing.id } });
      console.log(`Прежний демо-аккаунт удалён (${existing.id}).`);
    }

    const user = await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        name: DEMO_NAME,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS),
      },
    });

    await prisma.category.createMany({
      data: CATEGORIES.map((category) => ({
        name: category.name,
        color: category.color,
        icon: category.icon,
        userId: user.id,
      })),
    });

    const categories = await prisma.category.findMany({ where: { userId: user.id } });
    const byName = new Map(categories.map((category) => [category.name, category.id]));

    /** Идентификатор категории по имени; бросает, если имя разошлось со списком выше. */
    const categoryId = (name: string): string => {
      const id = byName.get(name);
      if (!id) {
        throw new Error(`Категория «${name}» не создалась`);
      }
      return id;
    };

    const transactions: {
      amount: string;
      type: "INCOME" | "EXPENSE";
      description: string;
      date: Date;
      userId: string;
      categoryId: string;
    }[] = [];

    // Четыре месяца истории: повседневные траты, 1–3 в день.
    for (let day = 118; day >= 0; day -= 1) {
      const perDay = 1 + Math.floor(random() * 3);
      for (let i = 0; i < perDay; i += 1) {
        const name = pick(WEIGHTED_DAILY);
        const pattern = DAILY_EXPENSES[name];
        if (!pattern) continue;

        transactions.push({
          amount: amountBetween(pattern.min, pattern.max),
          type: "EXPENSE",
          description: pick(pattern.descriptions),
          date: daysAgo(day, 8 + Math.floor(random() * 13)),
          userId: user.id,
          categoryId: categoryId(name),
        });
      }
    }

    // Обязательные платежи — по разу в месяц, в свою дату.
    for (let day = 118; day >= 0; day -= 1) {
      const date = daysAgo(day, 12);
      for (const item of MONTHLY_EXPENSES) {
        if (date.getUTCDate() !== item.dayOfMonth) continue;

        transactions.push({
          amount: amountBetween(item.amount[0], item.amount[1]),
          type: "EXPENSE",
          description: item.description,
          date,
          userId: user.id,
          categoryId: categoryId(item.category),
        });
      }
    }

    // Доходы: зарплата дважды в месяц, фриланс изредка.
    for (let day = 118; day >= 0; day -= 1) {
      const date = daysAgo(day, 10);
      const dayOfMonth = date.getUTCDate();

      if (dayOfMonth === 5 || dayOfMonth === 20) {
        transactions.push({
          amount: amountBetween(68000, 74000),
          type: "INCOME",
          description: dayOfMonth === 5 ? "Зарплата за месяц" : "Аванс",
          date,
          userId: user.id,
          categoryId: categoryId("Зарплата"),
        });
      }

      if (random() > 0.94) {
        transactions.push({
          amount: amountBetween(12000, 48000),
          type: "INCOME",
          description: pick(["Проект на заказ", "Консультация", "Правки по вёрстке"]),
          date,
          userId: user.id,
          categoryId: categoryId("Фриланс"),
        });
      }
    }

    await prisma.transaction.createMany({ data: transactions });

    await prisma.payment.createMany({
      data: [
        {
          name: "Аренда квартиры",
          amount: "45000.00",
          type: "EXPENSE",
          period: "MONTHLY",
          nextDueDate: daysAhead(4),
          description: "Оплата до пятого числа",
          userId: user.id,
          categoryId: categoryId("Жильё"),
        },
        {
          name: "Подписка на музыку",
          amount: "299.00",
          type: "EXPENSE",
          period: "MONTHLY",
          nextDueDate: daysAhead(11),
          userId: user.id,
          categoryId: categoryId("Подписки"),
        },
        {
          name: "Онлайн-кинотеатр",
          amount: "599.00",
          type: "EXPENSE",
          period: "MONTHLY",
          nextDueDate: daysAhead(23),
          userId: user.id,
          categoryId: categoryId("Подписки"),
        },
        {
          name: "Интернет",
          amount: "800.00",
          type: "EXPENSE",
          period: "MONTHLY",
          // Просрочен: дата уже прошла — такой платёж тоже попадает в «ближайшие».
          nextDueDate: daysAhead(-3),
          userId: user.id,
          categoryId: categoryId("Жильё"),
        },
        {
          name: "Страховка",
          amount: "14500.00",
          type: "EXPENSE",
          period: "YEARLY",
          nextDueDate: daysAhead(96),
          isActive: false,
          description: "Пока приостановлена",
          userId: user.id,
          categoryId: categoryId("Здоровье"),
        },
        {
          name: "Зарплата",
          amount: "71000.00",
          type: "INCOME",
          period: "MONTHLY",
          nextDueDate: daysAhead(6),
          userId: user.id,
          categoryId: categoryId("Зарплата"),
        },
      ],
    });

    const income = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    console.log(`Демо-аккаунт: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    console.log(`Категорий: ${CATEGORIES.length}, транзакций: ${transactions.length}, платежей: 6`);
    console.log(
      `Доходы: ${income.toFixed(2)} ₽, расходы: ${expense.toFixed(2)} ₽, баланс: ${(income - expense).toFixed(2)} ₽`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
