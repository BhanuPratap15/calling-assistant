import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Default: har API ko login chahiye (secure by default).
 * Jo route bina login ke khulna chahiye (login, health) uspe @Public() lagao.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
