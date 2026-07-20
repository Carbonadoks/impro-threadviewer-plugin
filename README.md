# Thread Viewer — Impro plugin

An [Impro](https://github.com/improsocial/impro) plugin that opens Bluesky posts
and profiles in [Thread Viewer](https://threadviewer.app).

- **On a post** — a row of actions appears below the thread. **Blog** and
  **Parallel board** open in Thread Viewer; **Tree panel** opens a native,
  plugin-only tree drawer inside Impro.
- **On a profile** — the profile context menu gains **View repo in Thread
  Viewer**, which opens the author's full repo (every post + self-reply thread).
- **Sidebar** — a "Thread Viewer" item with a short about panel and a link home.

Built against the sample plugin: https://github.com/improsocial/impro-sample-plugin

## How it hooks into Impro

| Feature | Integration point | Notes |
| --- | --- | --- |
| Post viewer actions | `registerSlot("post-thread-view:after-main", …)` | Host passes `context.uri` = `at://<did>/app.bsky.feed.post/<rkey>`. Links convert it to a `bsky.app` URL; the tree action loads it through the public Bluesky AppView. |
| View repo | `app.on("profile-context-menu", (menu, profile) => …)` | Opens a modal with a link to the repo route (`?handle=`). Context-menu items can't navigate directly, so the link is surfaced in a modal. |
| Sidebar item | `addSidebarItem(icon, title, cb)` | Opens an about modal. |
| Settings | `addSettingTab(new PluginSettingTab())` | Base URL, repo route, and per-viewer toggles. |

External actions are rendered as `<a>` elements. The Impro host only renders
**https** hrefs and forces `target="_blank"`, so the configured base URL must be
https (an external-link confirmation is shown on click). The native Tree panel
uses a regular plugin button.

## Settings

- **Thread Viewer URL** — base URL of your Thread Viewer instance (default
  `https://threadviewer.app`; must be https).
- **Repo viewer route** — route used by *View repo* (default `viewer2`).
- **Show "Blog" / "Parallel board" / "Tree panel"** — toggle each post action.

## Routes used

| Action | Thread Viewer URL |
| --- | --- |
| Blog | `<base>/blog?url=<bsky post url>` |
| Parallel board | `<base>/parallelboard?url=<bsky post url>` |
| Tree panel | Native Impro drawer; its “Open full Tree Viewer” action uses `<base>/treeviewer?url=<bsky post url>&embed=tree` |
| View repo | `<base>/viewer2?handle=<handle or did>` |

The side panel stays entirely within the existing plugin API. It fetches the
public Bluesky thread, finds the conversation root, and renders a compact native
tree using Impro's permitted virtual elements. No iframe or Impro host changes
are required. The `embed=tree` route remains available for the panel's full-view
link.

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
   npm run build    # bundles src/main.js -> main.js
   # or: npm start  # watch mode
   ```

`main.js` (the bundled artifact the host loads) is committed so the plugin works
without a build step. `npm run build` regenerates it from `src/main.js`.

## Publishing

Tag a commit with the version number (e.g. `0.1.0`, no `v`) on a public GitHub
repo, then PR the plugin info to https://github.com/improsocial/impro-releases.
Keep `version` in `manifest.json` in sync with the tag.
