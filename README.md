# SITEAO OpsTracker

SITEAO OpsTracker is an inventory and borrowing management system for a student organization.

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- Axios
- TanStack Table
- Chart.js

### Backend

- Node.js
- Express
- Prisma ORM
- PostgreSQL

## Project Structure

```text
siteao-opstracker/
├── frontend/
└── backend/
```

## Deployment

The repository is configured as a two-service deployment:

- **Frontend:** Vercel, with the Vercel project root set to `frontend`
- **Backend and database:** Render, using the root-level `render.yaml` Blueprint

### Deploy the backend on Render

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render will create the `siteao-opstracker-api` web service and a PostgreSQL database from `render.yaml`.
4. Set the `CLIENT_URL` environment variable to the final Vercel URL, for example
   `https://your-frontend.vercel.app`.
5. Set `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD` to the initial administrator credentials.
6. Deploy. Render runs Prisma migrations when the API starts, after the database is reachable.

The backend health check is available at `/api/health`.

### Deploy the frontend on Vercel

1. In Vercel, import the same repository.
2. Set **Root Directory** to `frontend`.
3. Use the detected Vite settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add the environment variable:

   ```env
   VITE_API_BASE_URL=https://your-render-service.onrender.com/api
   ```

5. Deploy and copy the resulting Vercel URL into Render's `CLIENT_URL`.

The frontend already includes `frontend/vercel.json` so React Router routes fall back to
`index.html`. Do not commit either production `.env` file or administrator credentials.
