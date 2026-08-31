# Frontend

The React + TypeScript client renders the department snapshots returned by the FastAPI backend. It expects the API at `http://localhost:8000` through Vite's `/api` development proxy.

```sh
npm ci
npm run dev
npm run test -- --run
npm run build
npm run lint
```

See the repository [README](../README.md) for the full local setup and project flow.
