import { IsNotEmpty, IsString } from 'class-validator';
import { IsValidPassword } from '../decorators/is-valid-password.decorator.js';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsValidPassword()
  newPassword: string;
}
