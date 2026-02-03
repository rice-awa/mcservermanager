# Repository Guidelines

## Project Structure & Modules
- `src/` holds application code: `components/` (layout, dashboard, console, players, shared `ui/`), `pages/` for routed screens, `router/` for React Router config, `services/` for server calls, `store/` for client state, `hooks/`, `lib/`, `types/`, and `assets/`.
- `public/` serves static files directly; `index.html` bootstraps Vite; entry is `src/main.tsx` with the root shell in `src/App.tsx`.
- Build/config files: `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `components.json` (shadcn/ui), `postcss.config.js`, `index.css` (Tailwind 4 theme tokens).

## Build, Test, and Development Commands
- `npm install` — install dependencies (Node 18+ recommended).
- `npm run dev` — start Vite dev server with hot reload.
- `npm run build` — type-check via `tsc -b` then create production bundle.
- `npm run preview` — serve the production build locally.
- `npm run lint` — ESLint flat config for TS/React; run before pushes and PRs.

## Coding Style & Naming Conventions
- Language: TypeScript + React 19 functional components; prefer hooks over classes; keep side effects inside custom hooks.
- Formatting: 2-space indent, single quotes, trailing commas per ESLint; no Prettier in repo, so rely on `npm run lint`.
- Components: PascalCase filenames (e.g., `Dashboard.tsx`, `ServerCard.tsx`); hooks use `useX` prefix; Zustand slices live under `src/store/`.
- Styling: Tailwind 4 utility-first; extend theme tokens in `src/index.css`; keep component-specific styles colocated or use utility classes.
- Imports: favor absolute-from-root Vite aliases when configured; otherwise maintain logical grouping (react libs → third-party UI → local modules).

## Testing Guidelines
- Automated tests are not set up yet; when adding, prefer Vitest + React Testing Library for components and place specs as `*.test.tsx` beside code.
- For now, gate changes with `npm run lint` and a manual smoke test via `npm run dev` to verify routing, theming, and console interactions.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`type(scope?): subject`); recent history shows `init`, `feat`, `chore(build)` patterns. Example: `feat: add player list tab`.
- Keep subjects ≤72 chars; describe user-facing impact. Include scope when touching a module (`feat(router): guard admin routes`).
- PRs should include: summary of changes, testing notes (`npm run lint`, manual steps), linked issue/TODO id if applicable, and UI screenshots or short clips for visual updates.
- Keep PRs small and focused; mention breaking changes explicitly and provide migration notes for config/env expectations.

## Security & Configuration Tips
- Do not commit secrets; store server endpoints or tokens in local env files (e.g., `.env.local`) and ensure they stay out of version control.
- Review `services/` for network calls and avoid logging sensitive payloads; scrub console/debug output before merging.
- Build output (`dist/`) and dependencies (`node_modules/`) are already ignored; keep cache artifacts and OS files out of commits.
