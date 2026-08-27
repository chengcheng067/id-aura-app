import clsx, { type ClassValue } from 'clsx';

/** className 条件合并薄封装（clsx 直通，统一入口便于未来替换 tailwind-merge） */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
