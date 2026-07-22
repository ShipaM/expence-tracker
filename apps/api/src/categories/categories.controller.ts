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
import type { CategoryDto } from "@repo/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Controller("categories")
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  findAll(@CurrentUser() userId: string): Promise<CategoryDto[]> {
    return this.categories.findAll(userId);
  }

  @Get(":id")
  findOne(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<CategoryDto> {
    return this.categories.findOne(userId, id);
  }

  // Тело валидирует глобальный ValidationPipe (class-validator по DTO-классу).
  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.create(userId, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.update(userId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.categories.remove(userId, id);
  }
}
