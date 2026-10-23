import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Libera a rota (ou o controller inteiro) sem sessão. Por padrão toda rota exige login. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
