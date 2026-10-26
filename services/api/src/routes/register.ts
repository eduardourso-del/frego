import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireFirebaseUser } from '../plugins/auth.js';
import { businessTypeSchema } from '../lib/business-type.js';
import { normalizeCnpj } from '../lib/cnpj.js';
import { operatingAddressSchema, parseOperatingAddress } from '../lib/operating-address.js';
import {
  cadastroAwaitsEmail,
  confirmCadastro,
  cnpjAlreadyUsed,
  holdCadastro,
  loadCadastro,
  openCadastro,
  registrationBlock,
  type CadastroInput,
} from '../lib/business-registration.js';

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use hex #RRGGBB')
  .optional();

const registerBody = z.object({
  ownerName: z.string().min(2).max(80),
  businessName: z.string().min(2).max(80),
  type: businessTypeSchema,
  slogan: z.string().max(160).optional(),
  cnpj: z.string().trim().max(18).optional(),
  primaryColor: hexColor,
  primaryColorDark: hexColor,
  locationName: z.string().min(2).max(80),
  address: operatingAddressSchema,
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(60)
    .optional(),
});

export const registerRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Cadastro público. Sem o e-mail confirmado, o pedido fica guardado
   * e não entra na fila de aprovação.
   */
  app.get('/businesses/register', async (request) => {
    const user = requireFirebaseUser(request);
    return { application: await loadCadastro(user.uid) };
  });

  app.post('/businesses/register', async (request, reply) => {
    const user = requireFirebaseUser(request);
    if (!user.email) {
      return reply.code(400).send({ error: 'EMAIL_REQUIRED' });
    }
    const account = { uid: user.uid, email: user.email };

    const body = registerBody.parse(request.body);
    const parsedAddress = parseOperatingAddress(body.address);
    if (!parsedAddress.ok) {
      return reply.code(400).send({ error: parsedAddress.error });
    }
    const cnpj = normalizeCnpj(body.cnpj);
    if (cnpj === 'invalid') {
      return reply.code(400).send({ error: 'INVALID_CNPJ' });
    }

    const input: CadastroInput = {
      ownerName: body.ownerName.trim(),
      businessName: body.businessName.trim(),
      type: body.type,
      slogan: body.slogan?.trim() || null,
      cnpj,
      primaryColor: body.primaryColor ?? '#070707',
      primaryColorDark: body.primaryColorDark ?? '#070707',
      locationName: body.locationName.trim(),
      slug: body.slug,
      address: parsedAddress.address,
    };

    const block = await registrationBlock(account);
    if (block) return reply.code(block.status).send({ error: block.error });
    if (cnpj && (await cnpjAlreadyUsed(cnpj))) {
      return reply.code(409).send({ error: 'CNPJ_TAKEN' });
    }

    if (cadastroAwaitsEmail(user.emailVerified)) {
      await holdCadastro(account, input);
      return reply.code(202).send({
        status: 'email_confirmation_required',
        email: user.email,
        message: 'Confirme o e-mail para enviar o cadastro à equipe Frego.',
      });
    }

    const opened = await openCadastro(account, input);
    if (!opened.ok) return reply.code(opened.status).send({ error: opened.error });
    return reply.code(201).send(opened.body);
  });

  app.post('/businesses/register/confirm', async (request, reply) => {
    const user = requireFirebaseUser(request);
    if (!user.email) {
      return reply.code(400).send({ error: 'EMAIL_REQUIRED' });
    }
    const opened = await confirmCadastro({
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
    });
    if (!opened.ok) return reply.code(opened.status).send({ error: opened.error });
    return reply.code(201).send(opened.body);
  });
};
