# Vercel + Neon Database Setup Guide

This guide walks you through setting up your Seri app on Vercel with Neon PostgreSQL database.

---

## Step 1: Create Vercel Account & Import Project

1. Go to [vercel.com](https://vercel.com) and sign up/log in
2. Click "Add New..." → "Project"
3. Import your GitHub repository: `pharmacy-guinea-app-002-2026`
4. Configure project settings:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

**⚠️ STOP HERE** - Don't deploy yet! We need to add the Neon integration first.

---

## Step 2: Add Neon Integration (Recommended Method)

### Option A: Via Vercel Dashboard (Easiest)

1. In your Vercel project, go to "Storage" tab
2. Click "Connect Database"
3. Select "Neon" from the list
4. Click "Connect"
5. Choose "Create New Database" or connect existing
6. Vercel will automatically:
   - Create a Neon database
   - Add `DATABASE_URL` to your environment variables
   - Link the database to your project

### Option B: Manual Neon Setup

If you prefer to set up Neon manually:

1. Go to [neon.tech](https://neon.tech) and create account
2. Create new project: "seri-production"
3. Copy the connection string (looks like):
   ```
   postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
4. In Vercel project → Settings → Environment Variables
5. Add variable:
   - **Key**: `DATABASE_URL`
   - **Value**: [your connection string]
   - **Environments**: Production, Preview, Development (check all)

---

## Step 3: Add Other Environment Variables

In Vercel project → Settings → Environment Variables, add:

### Required Variables:

1. **JWT_SECRET** (generate a strong random string)
   ```bash
   # Run this locally to generate:
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   - **Value**: [generated string]
   - **Environments**: Production, Preview, Development

2. **NEXT_PUBLIC_APP_URL**
   - **Value**: `https://your-project.vercel.app` (your Vercel domain)
   - **Environments**: Production, Preview, Development

### Optional (Rate Limiting):

3. **UPSTASH_REDIS_REST_URL** (if using rate limiting)
4. **UPSTASH_REDIS_REST_TOKEN**

---

## Step 4: Local Development Setup

1. Pull environment variables from Vercel:
   ```bash
   npx vercel env pull .env.local
   ```

2. Or manually create `.env.local` (use `.env.example` as template):
   ```bash
   cp .env.example .env.local
   ```

3. Edit `.env.local` with your values:
   - `DATABASE_URL` - from Vercel/Neon
   - `JWT_SECRET` - generate locally (see above)
   - `NEXT_PUBLIC_APP_URL` - `http://localhost:8888`

---

## Step 5: Run Database Migrations

### On Your Local Machine (for testing):

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name init

# This will:
# - Create all tables in your database
# - Generate migration files
```

### On Vercel (Production):

After your first deployment:

```bash
# Deploy migrations to production database
npx prisma migrate deploy
```

**Or** add this to your `package.json` build script:
```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

---

## Step 6: Seed Initial Data

After migrations, you need to create the initial owner account:

```bash
# Run seed script
npm run seed
```

This will create:
- Owner account (Mamadou) with PIN
- Sample products for testing

---

## Step 7: Deploy to Vercel

1. Push your code to GitHub:
   ```bash
   git add -A
   git commit -m "Add Prisma setup and authentication"
   git push origin main
   ```

2. Vercel will auto-deploy when you push to main
3. Monitor deployment in Vercel dashboard
4. Check build logs for any errors

---

## Step 8: Verify Deployment

1. Visit your Vercel URL: `https://your-project.vercel.app`
2. Test login with owner account
3. Try creating a sale offline
4. Verify PWA installation works

---

## Troubleshooting

### Build fails with "DATABASE_URL not found"
- Check environment variables are set in Vercel
- Ensure DATABASE_URL is available in all environments

### "Can't reach database server"
- Verify Neon database is running (check neon.tech dashboard)
- Check connection string format includes `?sslmode=require`

### "JWT_SECRET is required"
- Generate and add JWT_SECRET environment variable
- Redeploy after adding

### Migrations fail
- Check DATABASE_URL is correct
- Ensure database is accessible from Vercel
- Check Neon dashboard for connection issues

---

## Cost Estimate

### Vercel Free Tier:
- 100 GB bandwidth
- 100 hours build time
- Unlimited projects
- **Cost**: $0/month

### Neon Free Tier:
- 0.5 GB storage
- Serverless (auto-pause when inactive)
- Unlimited queries
- **Cost**: $0/month

**Total for MVP**: **$0/month** 🎉

---

## Next Steps

Once deployed:

1. ✅ Test authentication flow
2. ✅ Verify offline functionality
3. ✅ Test on actual device (OnePlus 12)
4. ✅ Configure custom domain (optional)
5. ✅ Enable Vercel Analytics (recommended)
6. ✅ Set up monitoring (optional: Sentry)

---

**Need help?** Check [docs/DEPLOYMENT.md](./DEPLOYMENT.md) for detailed production checklist.
