# Thread Viewer — Impro plugin

An [Impro](https://github.com/improsocial/impro) plugin that opens Bluesky posts
and profiles in [Thread Viewer](https://threadviewer.app).

- **On a post** — a row below the focused post links to **Tree viewer** and
  **Parallel board** in Thread Viewer.
- **Anywhere (feeds, search, …)** — the post ⋯ menu gains **Open in Thread
  Viewer** with the same two links (toggleable).
- **On a profile** — the profile context menu gains **View repo in Thread
  Viewer**, which opens the author's full repo (every post + self-reply thread).

Built against the sample plugin: https://github.com/improsocial/impro-sample-plugin
(plugin SDK `@impro.social/impro-plugin` 0.0.24).

## How it hooks into Impro

| Feature | Integration point | Notes |
| --- | --- | --- |
| Post viewer links | `registerSlot("post-thread-view:after-main", …, { cacheKey: ["uri"] })` | Host passes `context.uri` = `at://<did>/app.bsky.feed.post/<rkey>`, converted to a `bsky.app` URL. Cached per URI; `refreshSlot` re-renders after a settings change. |
| Post menu | `app.on("post-context-menu", (menu, post) => …)` | Opens a modal with the viewer links. |
| View repo | `app.on("profile-context-menu", (menu, profile) => …)` | Opens a modal with a link to `viewer2?handle=`. |
| Settings | `addSettingTab(new PluginSettingTab())` | Base URL and per-viewer toggles. |

Context-menu items can't navigate directly, so links are surfaced in a modal.
Links are rendered as `<a>` elements; the Impro host only renders **https**
hrefs, forces `target="_blank"`, and shows an external-link confirmation. The
plugin needs no network permissions.

## Settings

- **Thread Viewer URL** — base URL of your Thread Viewer instance (default
  `https://threadviewer.app`; must be https).
- **Show "Tree viewer" / "Parallel board"** — toggle each post link.
- **Add to post menu** — toggle the ⋯ menu entry.

## Routes used

| Action | Thread Viewer URL |
| --- | --- |
| Tree viewer | `<base>/treeviewer?url=<bsky post url>` |
| Parallel board | `<base>/parallelboard?url=<bsky post url>` |
| View repo | `<base>/viewer2?handle=<handle or did>` |

## Local development

1. Clone and run Impro locally.
2. Symlink this directory into Impro's local plugins directory:
   ```
   ln -s /absolute/path/to/impro-threadviewer-plugin /path/to/impro/plugins-local/threadviewer
   ```
3. It now appears under **Community Plugins**
   (`http://localhost:8080/settings/plugins/community`).
4. Rebuild after editing `src/main.js`:
   ```
   npm install      # pulls @impro.social/impro-plugin from the @atpkgs registry (see .npmrc)
                    # newer npm may refuse its remote tarball; if so, `npm pack` it from
                    # the @atpkgs registry and extract into node_modules/@impro.social/impro-plugin
   npm run build    # bundles src/main.js -> main.js
   # or: npm start  # watch mode
   ```

`main.js` (the bundled artifact the host loads) is committed so the plugin works
without a build step. `npm run build` regenerates it from `src/main.js`.

## Publishing

Tag a commit with the version number (e.g. `0.1.0`, no `v`) on a public GitHub
repo, then PR the plugin info to https://github.com/improsocial/impro-releases.
Keep `version` in `manifest.json` in sync with the tag.
