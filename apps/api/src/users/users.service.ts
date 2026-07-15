import { Injectable } from "@nestjs/common";
import type { User } from "@repo/db";
import { CreateUserData, UsersRepository } from "./users.repository";

// Тонкий слой над репозиторием: точка для будущих доменных правил.
@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  create(data: CreateUserData): Promise<User> {
    return this.users.create(data);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }
}
