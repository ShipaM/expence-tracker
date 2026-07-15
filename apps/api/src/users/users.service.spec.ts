import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

const repoMock = {
  create: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
};

describe("UsersService", () => {
  let service: UsersService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: UsersRepository, useValue: repoMock }],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it("create делегирует в репозиторий", async () => {
    const data = { email: "a@b.com", name: "A", passwordHash: "h" };
    repoMock.create.mockResolvedValue({ id: "1", ...data });

    const result = await service.create(data);

    expect(repoMock.create).toHaveBeenCalledWith(data);
    expect(result).toMatchObject({ id: "1", email: "a@b.com" });
  });

  it("findByEmail делегирует в репозиторий", async () => {
    repoMock.findByEmail.mockResolvedValue(null);

    await service.findByEmail("a@b.com");

    expect(repoMock.findByEmail).toHaveBeenCalledWith("a@b.com");
  });

  it("findById делегирует в репозиторий", async () => {
    repoMock.findById.mockResolvedValue(null);

    await service.findById("1");

    expect(repoMock.findById).toHaveBeenCalledWith("1");
  });
});
