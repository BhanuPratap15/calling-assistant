import bcrypt from 'bcryptjs';

// Cost factor: jitna bada, utna slow hash (attacker ke liye bhi slow). 12 = ~250ms, industry standard.
const SALT_ROUNDS = 12;

/** Plain password → hash (DB me sirf hash save hota hai, password kabhi nahi) */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Login ke time: user ka password stored hash se match karta hai ya nahi */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
