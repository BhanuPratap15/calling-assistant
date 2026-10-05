import { SetMetadata } from '@nestjs/common';

/**
 * mustChangePassword wala user sirf yahi routes chala sakta hai (me, change-password).
 * Baaki sab → 403 "Password change required" — pehle password badlo.
 */
export const ALLOW_PASSWORD_CHANGE_KEY = 'allowPasswordChange';
export const AllowDuringPasswordChange = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
