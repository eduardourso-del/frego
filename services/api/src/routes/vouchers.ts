import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireAuth } from '../plugins/auth.js';
import { nextFulfillAmountCents } from '../lib/campaign-return.js';
import {
  markVoucherUsed,
  normalizeVoucherCode,
  voucherFromMetadata,
} from '../lib/voucher.js';

const fulfillBody = z
  .object({
    /** Código do voucher (com ou sem hífen). */
    voucherCode: z.string().min(4).max(16).optional(),
    /** Ou o id da transação de redeem. */
    transactionId: z.string().min(1).optional(),
    /** Permite confirmar voucher já expirado (decisão da loja). */
    acceptExpired: z.boolean().optional(),
    /** Valor da compra no resgate (centavos). Opcional. */
    amountCents: z.number().int().nonnegative().max(10_000_000).nullish(),
  })
  .refine((b) => Boolean(b.voucherCode || b.transactionId), {
    message: 'Informe voucherCode ou transactionId',
  });

function publicVoucher(tx: {
  id: string;
  createdAt: Date;
  amountCents?: number | null;
  metadata: unknown;
  campaign: {
    name: string;
    rewardTitle: string | null;
    type: string;
  } | null;
}) {
  const voucher = voucherFromMetadata(tx.metadata, {
    createdAt: tx.createdAt,
  });
  if (!voucher) return null;
  return {
    transactionId: tx.id,
    voucherCode: voucher.voucherCode,
    voucherDisplay: voucher.voucherDisplay,
    status: voucher.status,
    usedAt: voucher.usedAt ?? null,
    expiresAt: voucher.expiresAt,
    createdAt: tx.createdAt,
    amountCents: tx.amountCents ?? null,
    rewardTitle: tx.campaign?.rewardTitle ?? tx.campaign?.name ?? 'Prêmio',
    campaignName: tx.campaign?.name ?? null,
    campaignType: tx.campaign?.type ?? null,
  };
}

export const voucherRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Balcão: marca voucher como usado (prêmio entregue).
   * Idempotente se já estiver usado.
   */
  app.post('/vouchers/fulfill', async (request, reply) => {
    const auth = requireAuth(request);
    const body = fulfillBody.parse(request.body);

    let tx = body.transactionId
      ? await prisma.transaction.findFirst({
          where: {
            id: body.transactionId,
            businessId: auth.businessId,
            type: 'redeem',
          },
          include: {
            campaign: {
              select: { name: true, rewardTitle: true, type: true },
            },
            membership: {
              select: {
                id: true,
                customer: {
                  select: {
                    id: true,
                    displayName: true,
                    phoneE164: true,
                  },
                },
              },
            },
          },
        })
      : null;

    if (!tx && body.voucherCode) {
      const code = normalizeVoucherCode(body.voucherCode);
      const candidates = await prisma.transaction.findMany({
        where: {
          businessId: auth.businessId,
          type: 'redeem',
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          campaign: {
            select: { name: true, rewardTitle: true, type: true },
          },
          membership: {
            select: {
              id: true,
              customer: {
                select: {
                  id: true,
                  displayName: true,
                  phoneE164: true,
                },
              },
            },
          },
        },
      });
      tx =
        candidates.find((c) => {
          const v = voucherFromMetadata(c.metadata, { createdAt: c.createdAt });
          return v && normalizeVoucherCode(v.voucherCode) === code;
        }) ?? null;
    }

    if (!tx) {
      return reply.code(404).send({ error: 'VOUCHER_NOT_FOUND' });
    }

    const current = voucherFromMetadata(tx.metadata, {
      createdAt: tx.createdAt,
    });
    if (!current) {
      return reply.code(400).send({ error: 'INVALID_VOUCHER' });
    }

    if (current.status === 'expired' && !body.acceptExpired) {
      return reply.code(409).send({
        error: 'VOUCHER_EXPIRED',
        voucher: publicVoucher(tx),
        message: `Voucher ${current.voucherDisplay} expirou`,
      });
    }

    const alreadyUsed = Boolean(current.usedAt);
    let nextMeta;
    try {
      nextMeta = markVoucherUsed(
        tx.metadata,
        auth.teamMemberId,
        new Date(),
        tx.createdAt,
        { acceptExpired: body.acceptExpired === true },
      );
    } catch (err) {
      if (err instanceof Error && err.message === 'VOUCHER_EXPIRED') {
        return reply.code(409).send({
          error: 'VOUCHER_EXPIRED',
          voucher: publicVoucher(tx),
          message: `Voucher ${current.voucherDisplay} expirou`,
        });
      }
      throw err;
    }

    const amountToSet = nextFulfillAmountCents({
      alreadyUsed,
      existingAmountCents: tx.amountCents,
      incomingAmountCents:
        body.amountCents === null || body.amountCents === undefined
          ? undefined
          : body.amountCents,
    });
    const shouldUpdateMeta = !alreadyUsed;
    const shouldUpdateAmount = amountToSet !== undefined;

    const updated =
      shouldUpdateMeta || shouldUpdateAmount
        ? await prisma.transaction.update({
            where: { id: tx.id },
            data: {
              ...(shouldUpdateMeta ? { metadata: nextMeta } : {}),
              ...(shouldUpdateAmount ? { amountCents: amountToSet } : {}),
            },
            include: {
              campaign: {
                select: { name: true, rewardTitle: true, type: true },
              },
              membership: {
                select: {
                  id: true,
                  customer: {
                    select: {
                      id: true,
                      displayName: true,
                      phoneE164: true,
                    },
                  },
                },
              },
            },
          })
        : tx;

    const voucher = publicVoucher(updated)!;
    const acceptedExpired =
      current.status === 'expired' && body.acceptExpired === true;

    return {
      alreadyUsed,
      acceptedExpired,
      voucher,
      customer: {
        id: updated.membership.customer.id,
        displayName: updated.membership.customer.displayName,
        phoneE164: updated.membership.customer.phoneE164,
      },
      message: alreadyUsed
        ? `Voucher ${voucher.voucherDisplay} já estava usado`
        : acceptedExpired
          ? `Voucher ${voucher.voucherDisplay} aceito mesmo expirado`
          : `Voucher ${voucher.voucherDisplay} marcado como usado`,
    };
  });

  /**
   * Busca voucher por código neste negócio (aberto ou usado).
   */
  app.get('/vouchers/lookup', async (request, reply) => {
    const auth = requireAuth(request);
    const query = request.query as { code?: string };
    const raw = (query.code ?? '').trim();
    if (!raw) {
      return reply.code(400).send({ error: 'CODE_REQUIRED' });
    }
    const code = normalizeVoucherCode(raw);
    const candidates = await prisma.transaction.findMany({
      where: { businessId: auth.businessId, type: 'redeem' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        campaign: { select: { name: true, rewardTitle: true, type: true } },
        membership: {
          select: {
            customer: {
              select: { id: true, displayName: true, phoneE164: true },
            },
          },
        },
      },
    });
    const tx = candidates.find((c) => {
      const v = voucherFromMetadata(c.metadata, { createdAt: c.createdAt });
      return v && normalizeVoucherCode(v.voucherCode) === code;
    });
    if (!tx) {
      return reply.code(404).send({ error: 'VOUCHER_NOT_FOUND' });
    }
    return {
      voucher: publicVoucher(tx),
      customer: {
        id: tx.membership.customer.id,
        displayName: tx.membership.customer.displayName,
        phoneE164: tx.membership.customer.phoneE164,
      },
    };
  });
};
