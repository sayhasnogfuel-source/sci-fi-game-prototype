# Neon Frontier: Drone Breaker (Browser Prototype)

Original Three.js third-person sci-fi shooter prototype with desktop and mobile controls.

## Play locally

1. Open terminal in this folder.
2. Run:
   ```bash
   python3 -m http.server 8000
   ```
3. Open: `http://localhost:8000`

---

## Deploy to GitHub Pages (recommended)

This repo already includes a GitHub Actions workflow at:

- `.github/workflows/deploy-pages.yml`

### One-time setup in GitHub

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Source: GitHub Actions**.
4. Ensure your default branch is `main` (or `master`; workflow supports both).
5. Push a commit (or manually run the workflow from **Actions** tab).
6. After workflow completes, your game will be live at:
   - `https://<your-username>.github.io/<repo-name>/`

### Notes

- This is a static project (`index.html`, `style.css`, `main.js`), so no server runtime is required.
- Keep all file references relative (already done) so Pages hosting works.

---

## If GitHub Pages is blocked: easiest free fallback (Netlify Drop)

1. Visit: https://app.netlify.com/drop
2. Drag and drop this project folder (or a zip containing `index.html`, `style.css`, `main.js`).
3. Netlify instantly publishes and gives a public URL.
4. Optional: create a free account to keep a stable site URL and edit settings.
