# Quick Start: Local Development Setup

## Prerequisites
- Node.js 20+ installed
- GitHub account (for Netlify deploy later)
- Free database (Neon.tech or Railway.app)

## Step 1: Get a Free Database (2 minutes)

### Option A: Neon.tech (Recommended)
1. Go to https://neon.tech
2. Sign up with GitHub
3. Create a project
4. Copy your connection string (looks like: `postgres://user:password@host:5432/dbname`)

### Option B: Railway.app
1. Go to https://railway.app
2. Sign up with GitHub
3. Create a new project → PostgreSQL
4. Copy the connection string

## Step 2: Set Up Environment Variables

### Backend Setup
```bash
cd server
cp .env.example .env
```

Edit `server/.env`:
```env
DATABASE_URL=paste-your-connection-string-here
JWT_SECRET=dev-secret-key
NODE_ENV=development
```

Save the file.

### Install Dependencies
```bash
npm install
```

## Step 3: Start Backend

```bash
npm start
```

You should see:
```
DropOff API listening on http://localhost:5418
```

✅ Backend is running!

## Step 4: Start Frontend (in a NEW terminal)

```bash
# From the root directory (dropoffff/)
npm install
npm run dev
```

You should see:
```
Local:   http://localhost:5417
```

Browser will open automatically. If not, visit `http://localhost:5417`

✅ Frontend is running!

## Step 5: Test the App

1. **Sign up**: Create a new account
2. **Send Package**:
   - From: Nigeria (choose Lagos)
   - To: United States (choose California)
   - Weight: 2 kg
   - Service: Express
3. **See Quote**: Price should show
4. **Book**: Create the shipment
5. **Track**: You can view your shipment status

## Troubleshooting

### "Could not reach the server"
- ✅ Check backend is running on terminal 1
- ✅ Verify `DATABASE_URL` is set in `server/.env`

### "Invalid origin country code"
- ✅ Make sure you selected valid countries (e.g., NG → Nigeria, US → USA)

### Backend won't connect to database
- ✅ Copy your connection string again (remove any extra spaces)
- ✅ Update `server/.env` with correct URL
- ✅ Restart the backend: `npm start`

### Port already in use
Frontend (5417) or Backend (5418) is already running on another process:
```bash
# Find and kill process
lsof -i :5417  # or :5418
kill -9 <PID>
```

---

## Next: Deploy to Netlify
Once testing locally is complete, see **DEPLOYMENT.md** for production setup!
