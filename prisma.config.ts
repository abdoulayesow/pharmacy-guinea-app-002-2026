import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Use non-pooled URL for migrations (directUrl equivalent)
    url: env('DATABASE_URL_UNPOOLED') || env('DATABASE_URL'),
  },
});
