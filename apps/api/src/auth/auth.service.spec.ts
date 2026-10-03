import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.js';

describe('AuthService', () => {
  let service: AuthService;
  const prismaMock = {
    staff: { findUnique: vi.fn(), update: vi.fn() },
    // $transaction(fn) → fn ko isi mock ke saath chala do
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prismaMock)),
  };
  const auditMock = { record: vi.fn() };
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
        { provide: AuditService, useValue: auditMock },
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
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login', actorId: 'staff-1' }),
      prismaMock,
    );
  });

  it('rejects wrong password', async () => {
    prismaMock.staff.findUnique.mockResolvedValue(activeStaff());
    await expect(service.login('amit@crm.local', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login_failed',
        actorId: null,
        metadata: { email: 'amit@crm.local', reason: 'wrong_password' },
      }),
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
