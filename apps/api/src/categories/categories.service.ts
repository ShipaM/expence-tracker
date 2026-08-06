import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import type { Category, User } from "@repo/db";
import type { CategoryDto } from "@repo/shared";
import { PrismaService } from "../prisma/prisma.service";
import { GetUserByIdQuery } from "../users/contracts/get-user-by-id.query";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

/**
 * Отличает нарушение уникальности от прочих ошибок Prisma.
 *
 * P2002 — нарушение уникальности (`@@unique([userId, name])`); ловим утиной проверкой кода,
 * чтобы не завязываться на путь импорта класса ошибки Prisma (как в `CreateUserHandler`).
 *
 * @param error Пойманное исключение, тип неизвестен.
 * @returns `true`, если это ошибка Prisma с кодом `P2002`.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

/**
 * CRUD категорий пользователя.
 *
 * Изоляция пользователей держится на фильтре по `userId` в каждом запросе. Имя категории
 * уникально в пределах пользователя (`@@unique([userId, name])`), поэтому создание и
 * переименование могут упереться в конфликт.
 */
@Injectable()
export class CategoriesService {
  /**
   * @param prisma Доступ к Prisma-клиенту (`prisma.client`).
   * @param queryBus Шина запросов CQRS: через неё проверяется существование пользователя.
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Возвращает все категории пользователя, отсортированные по имени.
   *
   * @param userId Идентификатор пользователя из токена.
   * @returns Список категорий; пустой, если их ещё нет.
   */
  async findAll(userId: string): Promise<CategoryDto[]> {
    const categories = await this.prisma.client.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });

    return categories.map((category) => this.toDto(category));
  }

  /**
   * Возвращает одну категорию пользователя.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id Идентификатор категории (UUID).
   * @returns Категория.
   * @throws {NotFoundException} Категории нет или она принадлежит другому пользователю
   *   (чужая запись неотличима от несуществующей).
   */
  async findOne(userId: string, id: string): Promise<CategoryDto> {
    const category = await this.prisma.client.category.findFirst({
      where: { id, userId },
    });

    if (!category) {
      throw new NotFoundException(`Категория ${id} не найдена`);
    }

    return this.toDto(category);
  }

  /**
   * Создаёт категорию, предварительно убедившись, что пользователь ещё существует.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param dto Имя категории и необязательные `color`/`icon`; без `color` в БД подставляется
   *   дефолт `#6366f1`.
   * @returns Созданная категория.
   * @throws {UnauthorizedException} Пользователя из токена больше нет в БД.
   * @throws {ConflictException} У пользователя уже есть категория с таким именем.
   */
  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    // CQRS: пользователь мог быть удалён, пока жил его 7-дневный токен.
    const user = await this.queryBus.execute<GetUserByIdQuery, User | null>(
      new GetUserByIdQuery(userId),
    );
    if (!user) {
      throw new UnauthorizedException("Пользователь не найден");
    }

    try {
      const category = await this.prisma.client.category.create({
        data: {
          userId,
          name: dto.name,
          ...(dto.color !== undefined && { color: dto.color }),
          icon: dto.icon ?? null,
        },
      });

      return this.toDto(category);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Категория с таким именем уже есть");
      }
      throw error;
    }
  }

  /**
   * Частично обновляет категорию: в БД уходят только переданные поля.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id Идентификатор категории (UUID).
   * @param dto Изменяемые поля; отсутствующие (`undefined`) не трогаются.
   * @returns Обновлённая категория.
   * @throws {NotFoundException} Категория не найдена или принадлежит другому пользователю.
   * @throws {ConflictException} Новое имя занято другой категорией того же пользователя.
   */
  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    await this.findOne(userId, id);

    try {
      const category = await this.prisma.client.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.color !== undefined && { color: dto.color }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
        },
      });

      return this.toDto(category);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Категория с таким именем уже есть");
      }
      throw error;
    }
  }

  /**
   * Удаляет категорию пользователя.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id Идентификатор категории (UUID).
   * @returns Ничего: успех — это отсутствие исключения (контроллер отвечает 204).
   * @throws {NotFoundException} Категория не найдена или принадлежит другому пользователю.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.client.category.delete({ where: { id } });
  }

  /**
   * Приводит запись Prisma к ответу API.
   *
   * @param category Запись категории из БД.
   * @returns DTO категории: `userId` и служебные поля наружу не попадают.
   */
  private toDto(category: Category): CategoryDto {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
    };
  }
}
