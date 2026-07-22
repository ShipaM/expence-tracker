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

// P2002 — нарушение уникальности (@@unique([userId, name])); ловим утиной проверкой
// кода, чтобы не завязываться на путь импорта класса ошибки Prisma (как в CreateUserHandler).
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBus: QueryBus,
  ) {}

  async findAll(userId: string): Promise<CategoryDto[]> {
    const categories = await this.prisma.client.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });

    return categories.map((category) => this.toDto(category));
  }

  async findOne(userId: string, id: string): Promise<CategoryDto> {
    const category = await this.prisma.client.category.findFirst({
      where: { id, userId },
    });

    if (!category) {
      throw new NotFoundException(`Категория ${id} не найдена`);
    }

    return this.toDto(category);
  }

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

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.client.category.delete({ where: { id } });
  }

  private toDto(category: Category): CategoryDto {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
    };
  }
}
