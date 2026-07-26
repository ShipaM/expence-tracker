# Новая функциональность

## Контекст (что уже есть)

- NestJS + Next.js + PostgreSQL + Prisma
- Авторизация (JWT), модуль категорий
  Что уже есть: User,авторизация JWT, модуль категорий + frontend

## Задача

Центральный модуль учёта доходов и расходов.

## Модель данных

Добавь модель Transaction в schema.prisma:
-id (String, uuid, @default(uuid()))
-amount (Decimal)
-type (Enum: INCOME, EXPENSE)
-description (String, nullable)
-date (DateTime)
-categoryId (String, связь с Category)
-userId (String, связь с User)
-createdAt (DateTime, @default(now()))

Обнови модели Гыук и Category - добавь обратные связи transactions Transactions[]

После изменения схемы создай и примени миграцию:
npx prisma migrate dev --name add-transactions

## Контроллер и эндпоинты

- POST /transactions: создать транзакцию,
- GET /transactions: список с query параметрами dateFrom, dateTo, type, categoryId,
- GET /transactions/summary: агрегация, query параметры month и year обе обязательные
- GET /transactions:id: одна транзакция
- PATCH /transactions/:id: обновить,
- DELETE /transactions/:id: удалить

## Паттерн

- Следуй структуре модуля из api/src/categories/
- Взаимодействие через CQRS

## Ограничения

- Не добавлять зависимости без указания
- class-validator для DTO
- После реализации запустить сборку
