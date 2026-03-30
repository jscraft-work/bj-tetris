# BJ Tetris

Single repository for the BJ Tetris web client, Android app, and Spring backend.

## Structure

- `web/`: static web client
- `android/`: Android WebView wrapper app
- `server/`: Spring Boot backend
- `docs/`: PRDs and notes

## Notes

- The web client currently contains the OAuth PKCE callback experiment.
- The backend is the next step for moving auth/session handling out of the browser.

## Run

- Start the central auth server first.
- Run the Spring server:
  `./server/gradlew -p server bootRun`
- Serve `web/` separately, for example:
  `python3 -m http.server 5500 --directory web`
- Open `http://127.0.0.1:5500`
- If you use different ports or domains, update:
  - `server/src/main/resources/application.yml` `app.frontend.base-url`
  - `web/index.html` `backendBaseUrl`

## Current Auth Flow

- `GET /auth/login`: starts OIDC login with server-side PKCE cookies
- `GET /auth/callback`: exchanges the code, fetches userinfo, creates a local user/session
- `POST /auth/logout`: clears the local session
- `GET /api/me`: returns the current logged-in user
- `GET /api/leaderboard`: leaderboard records
- `GET /api/my-records`: current user's records
- `POST /api/records`: saves a game record
