import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO = Data Transfer Object: request body ka "shape" + validation rules.
 * Galat body aayi (email missing, galat format) to 400 Bad Request — controller tak pahunchegi hi nahi.
 */
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
