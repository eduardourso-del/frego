import { prisma, type Prisma } from '@frego/db';
import { phoneLast4, toE164 } from './phone.js';

/**
 * The phone is the account. Staff may correct a display name, and may move a
 * registration that has not become an account — no app, and only this
 * estabelecimento — onto the right number, taking this loja's membership with it.
 */
export class CorrectCustomerError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = 'CorrectCustomerError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const PHONE_IS_ACCOUNT_MESSAGE =
  'Este telefone já é a conta do cliente. Desfaça o lançamento e busque o número certo.';

export type PhoneRetargetBlock = 'deleted' | 'app' | 'other_shop';

export function phoneRetargetBlock(input: {
  deletedAt: Date | null;
  firebaseUid: string | null;
  onboardingCompleted: boolean;
  deviceTokenCount: number;
  otherMembershipCount: number;
}): PhoneRetargetBlock | null {
  if (input.deletedAt) return 'deleted';
  if (
    input.firebaseUid ||
    input.onboardingCompleted ||
    input.deviceTokenCount > 0
  ) {
    return 'app';
  }
  if (input.otherMembershipCount > 0) return 'other_shop';
  return null;
}

export function normalizeDisplayName(
  value: string | null | undefined,
): string | null {
  const trimmed = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

export type CorrectCustomerResult = {
  customerId: string;
  moved: boolean;
  /** Welcome this number: it just became a member here. */
  welcomePhone: string | null;
};

function parsePhone(raw: string): string {
  try {
    return toE164(raw);
  } catch {
    throw new CorrectCustomerError(
      'INVALID_PHONE',
      400,
      'Telefone inválido. Informe DDD e número.',
    );
  }
}

function isUniqueConflict(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

function accountError(block: PhoneRetargetBlock): CorrectCustomerError {
  if (block === 'deleted') {
    return new CorrectCustomerError(
      'CUSTOMER_NOT_FOUND',
      404,
      'Cliente não encontrado.',
    );
  }
  return new CorrectCustomerError(
    'PHONE_IS_ACCOUNT',
    409,
    PHONE_IS_ACCOUNT_MESSAGE,
  );
}

export async function correctCustomerIdentity(input: {
  businessId: string;
  customerId: string;
  /** Undefined leaves the name. Null or blank clears it. */
  displayName?: string | null;
  /** Undefined leaves the phone. */
  phone?: string;
}): Promise<CorrectCustomerResult> {
  const source = await prisma.customer.findUnique({
    where: { id: input.customerId },
    include: {
      memberships: { select: { id: true, businessId: true } },
      _count: { select: { deviceTokens: true } },
    },
  });
  if (!source || source.deletedAt) {
    throw new CorrectCustomerError(
      'CUSTOMER_NOT_FOUND',
      404,
      'Cliente não encontrado.',
    );
  }
  const here = source.memberships.some((m) => m.businessId === input.businessId);
  if (!here) {
    throw new CorrectCustomerError(
      'MEMBERSHIP_NOT_FOUND',
      404,
      'Cliente não encontrado nesta loja.',
    );
  }

  const nameProvided = input.displayName !== undefined;
  const nextName = nameProvided
    ? normalizeDisplayName(input.displayName)
    : undefined;

  let nextPhone: string | null = null;
  if (input.phone !== undefined) {
    const parsed = parsePhone(input.phone);
    if (parsed !== source.phoneE164) nextPhone = parsed;
  }

  if (!nextPhone) {
    if (nameProvided && nextName !== source.displayName) {
      await prisma.customer.update({
        where: { id: source.id },
        data: { displayName: nextName },
      });
    }
    return { customerId: source.id, moved: false, welcomePhone: null };
  }

  const earlyBlock = phoneRetargetBlock({
    deletedAt: source.deletedAt,
    firebaseUid: source.firebaseUid,
    onboardingCompleted: source.onboardingCompleted,
    deviceTokenCount: source._count.deviceTokens,
    otherMembershipCount: source.memberships.filter(
      (m) => m.businessId !== input.businessId,
    ).length,
  });
  if (earlyBlock) throw accountError(earlyBlock);

  try {
    return await prisma.$transaction(async (tx) => {
      const fresh = await tx.customer.findUnique({
        where: { id: source.id },
        include: {
          memberships: { select: { id: true, businessId: true, isVip: true } },
          _count: { select: { deviceTokens: true } },
        },
      });
      if (!fresh) {
        throw new CorrectCustomerError(
          'CUSTOMER_NOT_FOUND',
          404,
          'Cliente não encontrado.',
        );
      }
      const block = phoneRetargetBlock({
        deletedAt: fresh.deletedAt,
        firebaseUid: fresh.firebaseUid,
        onboardingCompleted: fresh.onboardingCompleted,
        deviceTokenCount: fresh._count.deviceTokens,
        otherMembershipCount: fresh.memberships.filter(
          (m) => m.businessId !== input.businessId,
        ).length,
      });
      if (block) throw accountError(block);

      const sourceMembership = fresh.memberships.find(
        (m) => m.businessId === input.businessId,
      );
      if (!sourceMembership) {
        throw new CorrectCustomerError(
          'MEMBERSHIP_NOT_FOUND',
          404,
          'Cliente não encontrado nesta loja.',
        );
      }

      const target = await tx.customer.findUnique({
        where: { phoneE164: nextPhone! },
        select: { id: true, displayName: true, deletedAt: true },
      });

      if (!target) {
        await tx.customer.update({
          where: { id: fresh.id },
          data: {
            phoneE164: nextPhone!,
            phoneLast4: phoneLast4(nextPhone!),
            ...(nameProvided ? { displayName: nextName } : {}),
          },
        });
        return {
          customerId: fresh.id,
          moved: false,
          welcomePhone: nextPhone,
        };
      }

      if (target.deletedAt) {
        throw new CorrectCustomerError(
          'PHONE_UNAVAILABLE',
          409,
          'Esse número não pode receber o cadastro.',
        );
      }

      const targetMembership = await tx.membership.findUnique({
        where: {
          customerId_businessId: {
            customerId: target.id,
            businessId: input.businessId,
          },
        },
        select: { id: true, isVip: true },
      });

      await tx.transaction.updateMany({
        where: { actorCustomerId: fresh.id },
        data: { actorCustomerId: target.id },
      });

      if (!targetMembership) {
        await retargetRespostas(tx, fresh.id, target.id, sourceMembership.id);
        await tx.convite.updateMany({
          where: { customerId: fresh.id },
          data: { customerId: target.id },
        });
        await tx.membership.update({
          where: { id: sourceMembership.id },
          data: { customerId: target.id },
        });
      } else {
        await tx.transaction.updateMany({
          where: { membershipId: sourceMembership.id },
          data: { membershipId: targetMembership.id },
        });
        await retargetRespostas(tx, fresh.id, target.id, targetMembership.id);
        await tx.convite.updateMany({
          where: { customerId: fresh.id },
          data: {
            customerId: target.id,
            membershipId: targetMembership.id,
          },
        });

        const sourceTags = await tx.membershipTag.findMany({
          where: { membershipId: sourceMembership.id },
        });
        if (sourceTags.length > 0) {
          await tx.membershipTag.createMany({
            data: sourceTags.map((tag) => ({
              membershipId: targetMembership.id,
              tagId: tag.tagId,
              taggedByTeamMemberId: tag.taggedByTeamMemberId,
            })),
            skipDuplicates: true,
          });
        }

        if (sourceMembership.isVip && !targetMembership.isVip) {
          await tx.membership.update({
            where: { id: targetMembership.id },
            data: { isVip: true },
          });
        }

        await tx.membership.delete({ where: { id: sourceMembership.id } });
      }

      if (nameProvided && nextName && !target.displayName?.trim()) {
        await tx.customer.update({
          where: { id: target.id },
          data: { displayName: nextName },
        });
      }

      await tx.deviceToken.deleteMany({ where: { customerId: fresh.id } });
      const remaining = await tx.membership.count({
        where: { customerId: fresh.id },
      });
      if (remaining === 0) {
        await tx.customer.delete({ where: { id: fresh.id } });
      }

      return {
        customerId: target.id,
        moved: true,
        welcomePhone: targetMembership ? null : nextPhone,
      };
    });
  } catch (err) {
    if (err instanceof CorrectCustomerError) throw err;
    if (isUniqueConflict(err)) {
      throw new CorrectCustomerError(
        'PHONE_TAKEN',
        409,
        'Esse número acabou de ser cadastrado. Busque de novo.',
      );
    }
    throw err;
  }
}

async function retargetRespostas(
  tx: Prisma.TransactionClient,
  sourceId: string,
  targetId: string,
  membershipId: string,
) {
  const sourceRespostas = await tx.resposta.findMany({
    where: { customerId: sourceId },
    select: { id: true, pesquisaId: true },
  });
  if (sourceRespostas.length === 0) return;

  const taken = await tx.resposta.findMany({
    where: {
      customerId: targetId,
      pesquisaId: { in: sourceRespostas.map((r) => r.pesquisaId) },
    },
    select: { pesquisaId: true },
  });
  const takenIds = new Set(taken.map((r) => r.pesquisaId));
  const dropIds = sourceRespostas
    .filter((r) => takenIds.has(r.pesquisaId))
    .map((r) => r.id);
  if (dropIds.length > 0) {
    await tx.resposta.deleteMany({ where: { id: { in: dropIds } } });
  }
  await tx.resposta.updateMany({
    where: { customerId: sourceId },
    data: { customerId: targetId, membershipId },
  });
}
