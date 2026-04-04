# BJ Tetris

> **[Play Demo](https://tetris.jscraft.work/)**

Tetris game project. Web client + Spring Boot server + Android app, all in one repo.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Web Client | Vanilla JS, HTML5 Canvas, Vite |
| Server | Java 21, Spring Boot 3, PostgreSQL, Flyway |
| Android | Kotlin/Java, WebView, Immersive Mode |
| Auth | OAuth 2.0 / OIDC with server-side PKCE |
| Infra | Docker |

## Features

- Tetris with ghost piece, lock delay, level system
- Login, leaderboard
- Mobile touch controls
- Custom block types, BGM settings
- Sound effects and BGM (Web Audio API)
- Android app (fullscreen WebView)

## Project Structure

```
web/       — Static web client (Vite + vanilla JS)
server/    — Spring Boot backend (REST API, OAuth, PostgreSQL)
android/   — Android WebView wrapper app
docs/      — PRDs and notes
```

## Run Locally

1. Start the Spring server:
   ```
   ./server/gradlew -p server bootRun
   ```
2. Serve `web/` separately:
   ```
   python3 -m http.server 5500 --directory web
   ```
3. Open `http://127.0.0.1:5500`

If you use different ports or domains, update:
- `server/src/main/resources/application.yml` → `app.frontend.base-url`
- `web/index.html` → `backendBaseUrl`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/login` | Start OAuth login |
| GET | `/auth/callback` | OAuth callback handler |
| GET | `/auth/logout` | Logout |
| GET | `/api/me` | Current user info |
| GET | `/api/leaderboard` | Leaderboard |
| GET | `/api/my-records` | My records |
| POST | `/api/records` | Save record |
