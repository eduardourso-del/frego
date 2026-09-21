import { prisma } from '@frego/db';

export const MAX_TAGS_PER_BUSINESS = 40;
export const MAX_TAGS_PER_MEMBERSHIP = 12;

export type TagDto = {
  id: string;
  name: string;
  color: string | null;
};

export type CatalogTagDto = TagDto & {
  sortOrder: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const tagSelect = {
  id: true,
  name: true,
  color: true,
  sortOrder: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function serializeCatalogTag(tag: {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CatalogTagDto {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    sortOrder: tag.sortOrder,
    archivedAt: tag.archivedAt,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

export function serializeTag(tag: {
  id: string;
  name: string;
  color: string | null;
}): TagDto {
  return { id: tag.id, name: tag.name, color: tag.color };
}

function sortTagDtos(a: TagDto, b: TagDto) {
  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
}

export async function loadMembershipTags(
  membershipId: string,
): Promise<TagDto[]> {
  const map = await loadTagsByMembershipIds([membershipId]);
  return map.get(membershipId) ?? [];
}

export async function loadTagsByMembershipIds(
  membershipIds: string[],
): Promise<Map<string, TagDto[]>> {
  const map = new Map<string, TagDto[]>();
  for (const id of membershipIds) map.set(id, []);
  if (membershipIds.length === 0) return map;

  const rows = await prisma.membershipTag.findMany({
    where: { membershipId: { in: membershipIds } },
    select: {
      membershipId: true,
      tag: { select: { id: true, name: true, color: true, sortOrder: true } },
    },
  });

  for (const row of rows) {
    const list = map.get(row.membershipId);
    if (!list) continue;
    list.push(serializeTag(row.tag));
  }
  for (const list of map.values()) list.sort(sortTagDtos);
  return map;
}

export async function replaceMembershipTags(opts: {
  membershipId: string;
  businessId: string;
  tagIds: string[];
  teamMemberId: string;
}): Promise<TagDto[]> {
  const uniqueIds = [...new Set(opts.tagIds)];
  if (uniqueIds.length > MAX_TAGS_PER_MEMBERSHIP) {
    throw Object.assign(new Error('TAG_LIMIT'), {
      code: 'TAG_LIMIT',
      statusCode: 400,
      message: `No máximo ${MAX_TAGS_PER_MEMBERSHIP} etiquetas por cliente.`,
    });
  }

  if (uniqueIds.length > 0) {
    const tags = await prisma.businessTag.findMany({
      where: {
        id: { in: uniqueIds },
        businessId: opts.businessId,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (tags.length !== uniqueIds.length) {
      throw Object.assign(new Error('TAG_NOT_FOUND'), {
        code: 'TAG_NOT_FOUND',
        statusCode: 400,
        message: 'Uma ou mais etiquetas não existem nesta casa.',
      });
    }
  }

  await prisma.$transaction([
    prisma.membershipTag.deleteMany({
      where: {
        membershipId: opts.membershipId,
        ...(uniqueIds.length > 0 ? { tagId: { notIn: uniqueIds } } : {}),
      },
    }),
    ...uniqueIds.map((tagId) =>
      prisma.membershipTag.upsert({
        where: {
          membershipId_tagId: {
            membershipId: opts.membershipId,
            tagId,
          },
        },
        create: {
          membershipId: opts.membershipId,
          tagId,
          taggedByTeamMemberId: opts.teamMemberId,
        },
        update: {},
      }),
    ),
  ]);

  return loadMembershipTags(opts.membershipId);
}

export { tagSelect };
