import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { User } from "@repo/db";
import { GetUserByIdQuery } from "../contracts/get-user-by-id.query";
import { UsersService } from "../users.service";

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery, User | null> {
  constructor(private readonly users: UsersService) {}

  execute(query: GetUserByIdQuery): Promise<User | null> {
    return this.users.findById(query.id);
  }
}
