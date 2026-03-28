# CreditBook v3 — Deployment Guide (Twilio OTP)

## Overview
- **Backend** → Render (Node.js)
- **Frontend** → Vercel (React)
- **Database** → MongoDB Atlas
- **OTP** → Twilio SMS

---

## STEP 1 — MongoDB Atlas

1. Go to https://cloud.mongodb.com → sign up free
2. Create a free **M0 cluster**
3. Click **Connect** → **Connect your application** → copy URI
4. Append `/creditbook3` → `mongodb+srv://user:pass@cluster.mongodb.net/creditbook3`
5. **Network Access** → Add IP → Allow from anywhere (`0.0.0.0/0`)

---

## STEP 2 — Deploy Backend to Render

1. Push `backend/` folder to GitHub

2. Go to https://render.com → **New** → **Web Service** → connect repo

3. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

4. Add these **Environment Variables**:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | your MongoDB Atlas URI |
| `JWT_SECRET` | any long random string |
| `JWT_EXPIRES_IN` | `30d` |
| `TWILIO_ACCOUNT_SID` | from twilio.com/console |
| `TWILIO_AUTH_TOKEN` | from twilio.com/console |
| `TWILIO_PHONE_NUMBER` | your Twilio number e.g. `+1xxxxxxxxxx` |
| `GROQ_API_KEY` | free at groq.com |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |

5. Click **Deploy** → copy your URL: `https://creditbook-1.onrender.com`

---

## STEP 3 — Deploy Frontend to Vercel

1. Push `frontend/` folder to GitHub

2. Go to https://vercel.com → **New Project** → import repo

3. Add **Environment Variables**:

| Key | Value |
|-----|-------|
| `REACT_APP_API_URL` | `https://creditbook-1.onrender.com` |

4. Click **Deploy** → copy your Vercel URL

5. Go back to Render → update `ALLOWED_ORIGINS` with your Vercel URL

---

## STEP 4 — Pre-register Users in MongoDB

Since there's no self-registration, add users via MongoDB Atlas:

1. Atlas → **Browse Collections** → `creditbook3` → `users` → **Insert Document**:

```json
{
  "name": "Your Name",
  "phone": "+91XXXXXXXXXX",
  "businessName": "My Business",
  "isActive": true,
  "createdAt": { "$date": "2024-01-01T00:00:00Z" }
}
```

Phone must exactly match what the user enters (with `+91`).

---

## STEP 5 — Twilio Trial Limits

On free trial, Twilio can only send SMS to **verified numbers**.

To verify a number:
1. Go to https://console.twilio.com
2. **Phone Numbers** → **Verified Caller IDs**
3. Add and verify each phone number that needs to log in

To remove this limit, upgrade to a paid Twilio account.

---

## Fix Render Cold Start (optional)

Free Render services sleep after 15 min of inactivity.
Add a cron job at https://cron-job.org to ping every 10 min:
```
https://creditbook-1.onrender.com/api/health
```
