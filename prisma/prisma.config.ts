import 'dotenv/config'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),

  // Database connection for Prisma CLI commands
  datasource: {
    url: env('DATABASE_URL_UNPOOLED') ?? env('DATABASE_URL'),
  },
})
