# Netlify Deployment Guide

## Deploy to Netlify

1. Go to https://app.netlify.com
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **"Deploy with GitHub"**
4. Select **`wardawger/fantasy-tracker`**
5. Configure build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
6. Add environment variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://web-production-64239.up.railway.app`
7. Click **"Deploy site"**

## After Deployment

Your frontend will be live at: `https://[random-name].netlify.app`

You can customize the domain in Netlify's **Site settings** → **Domain management**

## Test Your Deployment

Visit your Netlify URL and:
1. Dashboard should load and show 0 members
2. Click "Payments" - sync will fetch members from Sleeper
3. All features should work with the Railway backend!
