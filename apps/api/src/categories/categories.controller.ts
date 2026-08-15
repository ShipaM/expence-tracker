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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { CategoryDto } from "@repo/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CategoriesService } from "./categories.service";
import { CategoryResponseDto } from "./dto/category-response.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

/**
 * HTTP-эндпоинты `/api/categories`.
 *
 * Весь контроллер закрыт `JwtAuthGuard`, `userId` берётся из токена через `@CurrentUser()`.
 * Тела запросов валидирует глобальный ValidationPipe (class-validator по DTO-классам).
 */
@ApiTags("categories")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Токен отсутствует, истёк или неверен" })
@Controller("categories")
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  /** @param categories Сервис с бизнес-логикой категорий. */
  constructor(private readonly categories: CategoriesService) {}

  /**
   * `GET /api/categories` — все категории пользователя, по алфавиту.
   *
   * @param userId Идентификатор пользователя из токена.
   * @returns Список категорий; пустой массив, если их нет.
   * @throws {UnauthorizedException} 401 от `JwtAuthGuard`: токена нет, он истёк или неверен.
   */
  @ApiOperation({
    summary: "Список категорий",
    description: "Все категории текущего пользователя, отсортированные по имени.",
  })
  @ApiResponse({
    status: 200,
    description: "Категории пользователя; пустой массив, если их нет",
    type: [CategoryResponseDto],
  })
  @Get()
  findAll(@CurrentUser() userId: string): Promise<CategoryDto[]> {
    return this.categories.findAll(userId);
  }

  /**
   * `GET /api/categories/:id` — одна категория пользователя.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id UUID категории из пути.
   * @returns Категория.
   * @throws {BadRequestException} 400 от `ParseUUIDPipe`: `id` не UUID.
   * @throws {UnauthorizedException} 401 от `JwtAuthGuard`: токена нет, он истёк или неверен.
   * @throws {NotFoundException} 404: категории нет или она принадлежит другому пользователю.
   */
  @ApiOperation({
    summary: "Категория по id",
    description: "Чужая категория неотличима от несуществующей — в обоих случаях 404.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Идентификатор категории" })
  @ApiResponse({ status: 200, description: "Категория", type: CategoryResponseDto })
  @ApiResponse({ status: 400, description: "id не UUID" })
  @ApiResponse({
    status: 404,
    description: "Категория не найдена или принадлежит другому пользователю",
  })
  @Get(":id")
  findOne(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<CategoryDto> {
    return this.categories.findOne(userId, id);
  }

  /**
   * `POST /api/categories` — создать категорию.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param dto Тело запроса: `name` и необязательные `color`, `icon`.
   * @returns Созданная категория (201).
   * @throws {BadRequestException} 400: тело не прошло валидацию или содержит лишние поля.
   * @throws {UnauthorizedException} 401: токен невалиден либо пользователя больше нет в БД.
   * @throws {ConflictException} 409: категория с таким именем у пользователя уже есть.
   */
  @ApiOperation({
    summary: "Создать категорию",
    description:
      "Имя уникально в пределах пользователя. Перед созданием проверяется, что пользователь " +
      "из токена ещё существует: токен живёт 7 дней и мог пережить удаление аккаунта.",
  })
  @ApiResponse({ status: 201, description: "Категория создана", type: CategoryResponseDto })
  @ApiResponse({ status: 400, description: "Тело не прошло валидацию или содержит лишние поля" })
  @ApiResponse({
    status: 401,
    description: "Токен невалиден либо пользователя из токена больше нет",
  })
  @ApiResponse({ status: 409, description: "Категория с таким именем у пользователя уже есть" })
  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categories.create(userId, dto);
  }

  /**
   * `PATCH /api/categories/:id` — частично обновить категорию.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id UUID категории из пути.
   * @param dto Изменяемые поля; все необязательны.
   * @returns Обновлённая категория.
   * @throws {BadRequestException} 400: `id` не UUID либо тело не прошло валидацию.
   * @throws {UnauthorizedException} 401 от `JwtAuthGuard`: токена нет, он истёк или неверен.
   * @throws {NotFoundException} 404: категории нет или она принадлежит другому пользователю.
   * @throws {ConflictException} 409: новое имя занято другой категорией пользователя.
   */
  @ApiOperation({
    summary: "Обновить категорию",
    description: "Частичное обновление: непереданные поля остаются как были.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Идентификатор категории" })
  @ApiResponse({ status: 200, description: "Обновлённая категория", type: CategoryResponseDto })
  @ApiResponse({ status: 400, description: "id не UUID либо тело не прошло валидацию" })
  @ApiResponse({
    status: 404,
    description: "Категория не найдена или принадлежит другому пользователю",
  })
  @ApiResponse({ status: 409, description: "Новое имя занято другой категорией пользователя" })
  @Patch(":id")
  update(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.update(userId, id, dto);
  }

  /**
   * `DELETE /api/categories/:id` — удалить категорию.
   *
   * @param userId Идентификатор пользователя из токена.
   * @param id UUID категории из пути.
   * @returns Пустой ответ со статусом 204.
   * @throws {BadRequestException} 400 от `ParseUUIDPipe`: `id` не UUID.
   * @throws {UnauthorizedException} 401 от `JwtAuthGuard`: токена нет, он истёк или неверен.
   * @throws {NotFoundException} 404: категории нет или она принадлежит другому пользователю.
   */
  @ApiOperation({ summary: "Удалить категорию" })
  @ApiParam({ name: "id", format: "uuid", description: "Идентификатор категории" })
  @ApiResponse({ status: 204, description: "Категория удалена, тело ответа пустое" })
  @ApiResponse({ status: 400, description: "id не UUID" })
  @ApiResponse({
    status: 404,
    description: "Категория не найдена или принадлежит другому пользователю",
  })
  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(userId, id);
  }
}
