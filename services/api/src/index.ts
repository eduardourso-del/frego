import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authPlugin } from './plugins/auth.js';
import { customerRoutes } from './routes/customers.js';
import { transactionRoutes } from './routes/transactions.js';
import { campaignRoutes } from './routes/campaigns.js';
import { audienceRoutes } from './routes/audiences.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { reportsRoutes } from './routes/reports.js';
import { businessRoutes } from './routes/business.js';
import { meRoutes } from './routes/me.js';
import { healthRoutes } from './routes/health.js';
import { registerRoutes } from './routes/register.js';
import { adminRoutes } from './routes/admin.js';
import { whatsappRoutes } from './routes/whatsapp.js';
import { metaWebhookRoutes } from './routes/meta-webhook.js';
import { publicBusinessRoutes } from './routes/public-business.js';
import { voucherRoutes } from './routes/vouchers.js';
import { tagRoutes } from './routes/tags.js';

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(metaWebhookRoutes);
  await app.register(publicBusinessRoutes);
  await app.register(registerRoutes);
  await app.register(adminRoutes);
  await app.register(meRoutes);
  await app.register(businessRoutes);
  await app.register(dashboardRoutes);
  await app.register(reportsRoutes);
  await app.register(customerRoutes);
  await app.register(tagRoutes);
  await app.register(transactionRoutes);
  await app.register(voucherRoutes);
  await app.register(campaignRoutes);
  await app.register(audienceRoutes);
  await app.register(whatsappRoutes);

  await app.listen({ port, host });
  app.log.info(`Frego API listening on http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
