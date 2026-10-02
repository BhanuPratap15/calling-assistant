import { IsValidPassword } from '../../auth/decorators/is-valid-password.decorator.js';

export class ResetPasswordDto {
  @IsValidPassword()
  newPassword: string;
}
