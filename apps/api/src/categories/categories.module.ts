import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { AuthModule } from "../auth/auth.module";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

// AuthModule → JwtAuthGuard; CqrsModule → QueryBus (диспетч GetUserByIdQuery в Users).
@Module({
  imports: [AuthModule, CqrsModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
