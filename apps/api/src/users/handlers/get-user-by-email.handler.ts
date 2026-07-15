import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { User } from "@repo/db";
import { GetUserByEmailQuery } from "../contracts/get-user-by-email.query";
import { UsersService } from "../users.service";

@QueryHandler(GetUserByEmailQuery)
export class GetUserByEmailHandler implements IQueryHandler<GetUserByEmailQuery, User | null> {
  constructor(private readonly users: UsersService) {}

  execute(query: GetUserByEmailQuery): Promise<User | null> {
    return this.users.findByEmail(query.email);
  }
}
