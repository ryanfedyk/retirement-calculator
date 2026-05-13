# Deployment Guide for Zipline

This guide covers how to deploy the **frontend** to Zipline (Google's internal static hosting).

## Prerequisites
- **Frontend**: A static React site (Vite).
- **Backend**: The `server` folder is an Express app. **Zipline DOES NOT host Node.js servers.** You must deploy the backend separately (e.g., to Google App Engine, Cloud Run, or Borg) OR run the frontend in a mock-only mode if applicable.

## 1. Configure the API URL
The frontend connects to a backend API. By default, it looks for `http://localhost:3001`.
To point it to your deployed backend, set the `VITE_API_BASE_URL` environment variable during the build.

**Example:**
```bash
export VITE_API_BASE_URL="https://your-backend-service.googleplex.com"
```

## 2. Build the Frontend
Run the build command from the project root:

```bash
# Install dependencies if needed
npm install

# Build for production
# passing the API URL if different from localhost
VITE_API_BASE_URL="https://your-backend-url.com" npm run build
```

This will create a `dist` folder containing the static assets.

## 3. Deploy to Zipline
1.  Go to [Zipline](http://zipline/) (internal link).
2.  Create a new site.
3.  Upload the contents of the `dist` folder.
4.  **Important**: Ensure your Zipline configuration serves `index.html` for all unknown routes (SPA fallback) if you use client-side routing.

## 4. Backend Considerations
If you cannot deploy the Node.js backend to an internal server:
- You may need to create a "Mock Mode" for the app that bypasses API calls.
- Or simply run the backend locally and access the Zipline site (this works if `localhost:3001` is running on your machine and you access Zipline from the same machine).

## 5. Troubleshooting
- **CORS**: Ensure your backend allows requests from your Zipline domain (`https://<your-site>.zipline.googleplex.com`).
- **Mixed Content**: Zipline is HTTPS. Your backend MUST also be HTTPS, or the browser will block the request. `localhost` is an exception to this rule.
