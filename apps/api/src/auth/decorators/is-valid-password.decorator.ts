import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

/**
 * Password policy (ek jagah — badalna ho to sirf yahan):
 *  - 8 se 72 characters (bcrypt 72 bytes se aage ignore karta hai)
 *  - kam se kam 1 letter aur 1 number
 */
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

export const IsValidPassword = () =>
  applyDecorators(
    IsString(),
    Matches(PASSWORD_RULE, {
      message:
        'password must be 8-72 characters and contain at least one letter and one number',
    }),
  );
