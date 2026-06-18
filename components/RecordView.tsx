'use client';

import { useEffect } from 'react';
import { useShelf } from '@/lib/shelf-store';

/**
 * Side-effect-only: records that this product was looked up, pushing it to the
 * top of "your shelf". Mounted on the product page. Renders nothing.
 */
export function RecordView({ id }: { id: string }) {
  const add = useShelf((s) => s.add);
  useEffect(() => {
    add(id);
  }, [id, add]);
  return null;
}
