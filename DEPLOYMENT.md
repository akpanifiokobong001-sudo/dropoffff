# DropOff Deployment Guide: Netlify + Render

## Overview
- **Frontend**: React app deployed to Netlify
- **Backend**: Node.js Express API deployed to Render
- **Database**: PostgreSQL on Render (managed)

---

## PART 1: Deploy Backend to Render (5 minutes)

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub (recommended)

### Step 2: Create PostgreSQL Database
1. Click **New +** → **PostgreSQL**
2. Name: `dropoff-db`
3. Region: Choose closest to you
4. Keep defaults, click **Create**
5. Wait ~2 minutes for creation
6. Copy the **Internal Database URL** (you'll need this)

### Step 3: Deploy Backend Service
1. Click **New +** → **Web Service**
2. Select **Build and deploy from a Git repository**
3. Connect your GitHub repo with this project
4. Fill in:
   - **Name**: `dropoff-api`
   - **Root Directory**: `server` (important!)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

### Step 4: Add Environment Variables
In the Web Service settings, add these **Environment Variables**:
```
DATABASE_URL = [paste your Internal Database URL from Step 2]
JWT_SECRET = [generate a random string, e.g., use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
NODE_ENV = production
```

### Step 5: Deploy
Click **Deploy** and wait ~3 minutes.

**✅ Once deployed**, you'll get a URL like: `https://dropoff-api-xxxxx.onrender.com`

**Save this URL!** You'll need it for the frontend.

---

## PART 2: Deploy Frontend to Netlify (5 minutes)

### Step 1: Connect GitHub to Netlify
1. Go to https://netlify.com
2. Sign up / Log in with GitHub
3. Click **Import an existing project** → **GitHub**
4. Select your repository

### Step 2: Configure Build Settings
Netlify should auto-detect, but verify:
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Base Directory**: (leave empty)

### Step 3: Update Backend URL in netlify.toml
Replace the redirect URL with your Render backend:

Edit `netlify.toml` and change:
```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-RENDER-URL/api/:splat"  ← PUT YOUR RENDER URL HERE
  status = 200
  force = true
```

For example:
```toml
to = "https://dropoff-api-abc123.onrender.com/api/:splat"
```

### Step 4: Deploy
1. Push the updated `netlify.toml` to GitHub
2. Netlify auto-deploys! You'll see it in the deploy logs.

**✅ Your app is now live!** 🎉

---

## PART 3: Local Testing Before Deployment

### Test Backend Locally
```bash
cd server
cp .env.example .env
# Edit .env and add a DATABASE_URL (from Neon.tech or Railway for free PostgreSQL)
npm install
npm start
# Backend runs on http://localhost:5418
```

### Test Frontend Locally
```bash
npm install
npm run dev
# Frontend runs on http://localhost:5417
# API calls proxy to backend via vite.config.js
```

---

## Troubleshooting

### Backend won't start: "password authentication failed"
**Solution**: `DATABASE_URL` is missing or invalid. Check your `.env` file.

### Frontend can't reach API
**Solution**: Make sure `netlify.toml` has the correct Render URL (with no trailing slash).

### Deployment failing on Render
1. Check build logs: Render Dashboard → Your Service → Logs
2. Verify `Node_VERSION` = 20 in `.env`
3. Ensure `.env` has `DATABASE_URL` and `JWT_SECRET`

### Free tier limitations
- **Render**: Spins down after 15 min of inactivity
- **Netlify**: Always active for frontend
- **Upgrade anytime** when you're ready for production

---

## Next Steps

1. ✅ Set up Render PostgreSQL database
2. ✅ Deploy backend to Render
3. ✅ Update netlify.toml with Render URL
4. ✅ Deploy frontend to Netlify
5. ✅ Test at your Netlify URL
6. ✅ Enable admin features (set ADMIN_EMAILS in Render env vars)

---

## Useful Links
- Render: https://render.com/docs
- Netlify: https://docs.netlify.com
- Postgres (free): https://neon.tech (for local dev)
