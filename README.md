# Tiki Tiki Gank — Netlify Ready

IMPORTANT: this project needs a Netlify build/deployment that processes `netlify/functions`. The previous Netlify Drop deployment was a static/manual deploy, which is why the `api` Function was missing.

Project root:
- netlify.toml
- package.json
- public/
- netlify/functions/api.mjs

Recommended deployment:
1. Put this project in a Git repository and connect the repository to Netlify, OR use a Netlify deployment method that runs the build/function processing.
2. Confirm the Netlify dashboard shows a Function named `api`.
3. Set environment variable `ADMIN_PASSWORD` to your private host password.
4. Open the site and test JOIN.

Do not upload only the `public` folder.

Features:
- Public 25,000,000+ follower display.
- No public actual-member-count notice.
- Member signup with unique username, name, password.
- Login later from another browser/device.
- Passwords are hashed with scrypt before storage.
- Persistent member/quest data through Netlify Blobs.
- Host dashboard, site editing, individual quests, proof review, rank changes, member removal.
- Fast JOIN/LOGIN loading.
