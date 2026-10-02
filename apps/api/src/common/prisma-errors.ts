import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

/**
 * DB unique constraint toota (same email / phone) → 409 Conflict, 500 nahi.
 *   return withUniqueConflict(() => prisma.x.create(...), 'Email already exists');
 */
export async function withUniqueConflict<T>(
  save: () => Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await save();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
