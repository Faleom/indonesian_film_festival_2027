/**
 * How many of each sku are taken: paid orders, plus unpaid ones still inside
 * their checkout window (they hold stock until they expire).
 */
import { and, eq, gt, inArray, or, sql } from 'drizzle-orm';
import type { Db } from './db/client';
import { orderItems, orders } from './db/schema';
import { findSku } from './catalog';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export async function takenBySku(db: Db | Tx, skus?: string[]): Promise<Record<string, number>> {
  const rows = await db
    .select({ sku: orderItems.sku, qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        or(eq(orders.status, 'paid'), and(eq(orders.status, 'pending'), gt(orders.expiresAt, new Date()))),
        skus && skus.length ? inArray(orderItems.sku, skus) : undefined,
      ),
    )
    .groupBy(orderItems.sku);
  return Object.fromEntries(rows.map((r) => [r.sku, Number(r.qty)]));
}

/** Remaining per sku (null = unlimited). */
export async function remainingBySku(db: Db, skus: string[]): Promise<Record<string, number | null>> {
  const taken = await takenBySku(db, skus);
  return Object.fromEntries(
    skus.map((s) => {
      const limit = findSku(s)?.limit ?? null;
      return [s, limit === null ? null : Math.max(0, limit - (taken[s] ?? 0))];
    }),
  );
}
