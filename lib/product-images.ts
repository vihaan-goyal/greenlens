import { existsSync } from 'fs';
import { join } from 'path';

const EXTS = ['jpg', 'png', 'webp'] as const;

/** Returns the /public-relative path to a downloaded product image, or null. */
export function localProductImage(productId: string): string | null {
  for (const ext of EXTS) {
    if (existsSync(join(process.cwd(), 'public', 'products', `${productId}.${ext}`))) {
      return `/products/${productId}.${ext}`;
    }
  }
  return null;
}
