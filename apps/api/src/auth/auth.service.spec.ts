import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.js';

describe('AuthService', () => {
  let service: AuthService;
  const prismaMock = {
    staff: { findUnique: vi.fn(), update: vi.fn() },
  };
  const jwtMock = { signAsync: vi.fn().mockResolvedValue('signed-token') };
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await hashPassword('Correct@123');
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  const activeStaff = () => ({
    id: 'staff-1',
    name: 'Amit',
    email: 'amit@crm.local',
    role: 'ASSISTANT',
    isActive: true,
    passwordHash,
  });

  it('returns token and user for correct credentials', async () => {
    prismaMock.staff.findUnique.mockResolvedValue(activeStaff());

    const result = await service.login('  AMIT@crm.local ', 'Correct@123');

    // email normalize hua (trim + lowercase)
    expect(prismaMock.staff.findUnique).toHaveBeenCalledWith({
      where: { email: 'amit@crm.local' },
    });
    expect(jwtMock.signAsync).toHaveBeenCalledWith({
      sub: 'staff-1',
      role: 'ASSISTANT',
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      user: {
        id: 'staff-1',
        name: 'Amit',
        email: 'amit@crm.local',
        role: 'ASSISTANT',
      },
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects wrong password', async () => {
    prismaMock.staff.findUnique.mockResolvedValue(activeStaff());
    await expect(service.login('amit@crm.local', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects unknown email', async () => {
    prismaMock.staff.findUnique.mockResolvedValue(null);
    await expect(service.login('nobody@crm.local', 'x')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects deactivated staff even with correct password', async () => {
    prismaMock.staff.findUnique.mockResolvedValue({
      ...activeStaff(),
      isActive: false,
    });
    await expect(
      service.login('amit@crm.local', 'Correct@123'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
