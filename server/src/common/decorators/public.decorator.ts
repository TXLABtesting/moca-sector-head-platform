import { SetMetadata } from '@nestjs/common';

/** Marks a route as reachable without a valid Entra token (e.g. health). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
