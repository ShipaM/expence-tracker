import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { AuthModule } from "../auth/auth.module";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";

// AuthModule → JwtAuthGuard; CqrsModule → QueryBus (диспетч GetUserByIdQuery в Users).
@Module({
  imports: [AuthModule, CqrsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
