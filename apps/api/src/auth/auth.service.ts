import { Injectable, UnauthorizedException } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { JwtService } from "@nestjs/jwt";
import type { User } from "@repo/db";
import type { AuthResponseDto, LoginDto, RegisterDto, UserDto } from "@repo/shared";
import * as bcrypt from "bcryptjs";
import { CreateUserCommand } from "../users/contracts/create-user.command";
import { GetUserByEmailQuery } from "../users/contracts/get-user-by-email.query";
import { GetUserByIdQuery } from "../users/contracts/get-user-by-id.query";

const BCRYPT_ROUNDS = 10;

// Хэширование/сверка пароля и подпись JWT живут здесь; Users лишь хранит хэш.
// С модулем Users общаемся только через шину — без импорта его сервисов.
@Injectable()
export class AuthService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.commandBus.execute<CreateUserCommand, User>(
      new CreateUserCommand(dto.email, dto.name, passwordHash),
    );

    return this.buildResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.queryBus.execute<GetUserByEmailQuery, User | null>(
      new GetUserByEmailQuery(dto.email),
    );

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Неверный email или пароль");
    }

    return this.buildResponse(user);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.queryBus.execute<GetUserByIdQuery, User | null>(
      new GetUserByIdQuery(userId),
    );

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.toUserDto(user);
  }

  private buildResponse(user: User): AuthResponseDto {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email });
    return { accessToken, user: this.toUserDto(user) };
  }

  private toUserDto(user: User): UserDto {
    return { id: user.id, email: user.email, name: user.name };
  }
}
