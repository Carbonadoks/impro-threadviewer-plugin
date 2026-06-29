import {
  Plugin,
  Modal,
  PluginSettingTab,
  Setting,
  VirtualEl,
} from "@impro.social/impro-plugin";

// Thread Viewer routes that take a single bsky post URL via ?url=
// These render in the `post-thread-view:top` slot when you open a post.
const POST_VIEWERS = [
  {
    key: "showBlog",
    route: "blog",
    label: "Blog",
    title: "Read this thread as a blog post",
    icon: "article-line",
  },
  {
    key: "showParallelBoard",
    route: "parallelboard",
    label: "Parallel board",
    title: "View this thread as a parallel board",
    icon: "view-columns-line",
  },
  {
    key: "showTree",
    route: "treeviewer",
    label: "Tree",
    title: "View this thread as a tree",
    icon: "sitemap-line",
  },
];

const DEFAULT_SETTINGS = {
  // Must be https:// — the host only renders https links.
  baseUrl: "https://threadviewer.app",
  // Route used by "View repo" on a profile (loads the author's full repo).
  repoRoute: "viewer2",
  showBlog: true,
  showParallelBoard: true,
  showTree: true,
};

const AT_POST_RE = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/;

function normalizeBaseUrl(value) {
  const raw = (value ?? "").trim();
  return (raw || DEFAULT_SETTINGS.baseUrl).replace(/\/+$/, "");
}

// The slot gives us `at://<did>/app.bsky.feed.post/<rkey>`. Thread Viewer wants
// a public bsky.app URL — a DID works in the /profile/ path just like a handle.
function postUrlFromContextUri(uri) {
  if (typeof uri !== "string") return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  const match = trimmed.match(AT_POST_RE);
  if (match) {
    // Leave the DID/rkey raw in the path (bsky.app accepts a DID actor); the
    // whole URL is encoded once when it becomes the ?url= value.
    return `https://bsky.app/profile/${match[1]}/post/${match[2]}`;
  }
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function viewerHref(base, route, params) {
  const search = new URLSearchParams(params).toString();
  return `${base}/${route}${search ? `?${search}` : ""}`;
}

function profileActor(profile) {
  const actor = (profile?.handle || profile?.did || "").trim();
  return actor || null;
}

// A modal with a single prominent link out to the Thread Viewer repo page.
// Context-menu items can't navigate on their own, so we surface a real <a>.
class RepoModal extends Modal {
  constructor({ base, route, actor, label }) {
    super();
    this.base = base;
    this.route = route;
    this.actor = actor;
    this.label = label;
  }

  onOpen() {
    this.titleEl.setText("Open repo in Thread Viewer");
    const href = viewerHref(this.base, this.route, { handle: this.actor });
    this.contentEl.createEl("p", {
      cls: "tv-modal-text",
      text: `View @${this.label}'s full repository — every post and self-reply thread — in Thread Viewer.`,
    });
    const actions = this.contentEl.createDiv({ cls: "tv-modal-actions" });
    actions.createEl("a", {
      cls: "tv-button tv-button--primary",
      text: "Open repo viewer →",
      attr: { href, title: "Open repo viewer" },
    });
    actions
      .createEl("button", { cls: "tv-button", text: "Close" })
      .onClick(() => this.close());
  }

  onClose() {
    this.titleEl.empty();
    this.contentEl.empty();
  }
}

// Sidebar entry: a short "what is this" panel plus a link to the home page.
class AboutModal extends Modal {
  constructor(base) {
    super();
    this.base = base;
  }

  onOpen() {
    this.titleEl.setText("Thread Viewer");
    this.contentEl.createEl("p", {
      cls: "tv-modal-text",
      text: "Thread Viewer renders Bluesky self-reply threads in alternate layouts.",
    });
    const list = this.contentEl.createEl("ul", { cls: "tv-modal-list" });
    list.createEl("li", { text: "On a post: open it as a blog, parallel board, or tree." });
    list.createEl("li", { text: "On a profile: open the author's full repo." });
    const actions = this.contentEl.createDiv({ cls: "tv-modal-actions" });
    actions.createEl("a", {
      cls: "tv-button tv-button--primary",
      text: "Open Thread Viewer →",
      attr: { href: this.base, title: "Open Thread Viewer" },
    });
    actions
      .createEl("button", { cls: "tv-button", text: "Close" })
      .onClick(() => this.close());
  }

  onClose() {
    this.titleEl.empty();
    this.contentEl.empty();
  }
}

class ThreadViewerSettingTab extends PluginSettingTab {
  constructor() {
    super();
    this.setName("Thread Viewer");
  }

  display() {
    const settings = this.plugin.settings;

    new Setting(this.containerEl)
      .setName("Thread Viewer URL")
      .setDesc("Base URL of your Thread Viewer instance. Must be https:// for in-app links to open.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.baseUrl)
          .setValue(settings.baseUrl)
          .onChange((value) => this.plugin.updateSetting("baseUrl", value)),
      );

    new Setting(this.containerEl)
      .setName("Repo viewer route")
      .setDesc('Route used by "View repo" on a profile (default: viewer2).')
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.repoRoute)
          .setValue(settings.repoRoute)
          .onChange((value) => this.plugin.updateSetting("repoRoute", value)),
      );

    for (const viewer of POST_VIEWERS) {
      new Setting(this.containerEl)
        .setName(`Show "${viewer.label}"`)
        .setDesc(viewer.title)
        .addToggle((toggle) =>
          toggle
            .setValue(settings[viewer.key] !== false)
            .onChange((value) => this.plugin.updateSetting(viewer.key, value)),
        );
    }
  }
}

export default class ThreadViewerPlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };

    this.addSettingTab(new ThreadViewerSettingTab());

    this.addSidebarItem("telescope-line", "Thread Viewer", () => {
      new AboutModal(normalizeBaseUrl(this.settings.baseUrl)).open();
    });

    // Post page: a row of viewer links directly below the post.
    this.registerSlot("post-thread-view:after-main", (context) =>
      this.renderPostViewerBar(context),
    );

    // Author page: a "View repo" entry in the profile context menu.
    this.app.on("profile-context-menu", (menu, profile) => {
      const actor = profileActor(profile);
      if (!actor) return;
      menu.addItem((item) =>
        item
          .setTitle("View repo in Thread Viewer")
          .setIcon("git-branch-line")
          .onClick(() => {
            new RepoModal({
              base: normalizeBaseUrl(this.settings.baseUrl),
              route: this.settings.repoRoute || DEFAULT_SETTINGS.repoRoute,
              actor,
              label: profile?.handle || actor,
            }).open();
          }),
      );
    });
  }

  async updateSetting(key, value) {
    this.settings[key] = value;
    await this.saveData(this.settings);
  }

  renderPostViewerBar(context) {
    const postUrl = postUrlFromContextUri(context?.uri);
    if (!postUrl) return null;

    const viewers = POST_VIEWERS.filter((v) => this.settings[v.key] !== false);
    if (viewers.length === 0) return null;

    const base = normalizeBaseUrl(this.settings.baseUrl);
    const bar = new VirtualEl("div").addClass("tv-viewer-bar");
    bar.createSpan({ cls: "tv-viewer-bar__label", text: "Open in Thread Viewer" });
    const group = bar.createDiv({ cls: "tv-viewer-bar__buttons" });

    for (const viewer of viewers) {
      const link = group.createEl("a", {
        cls: "tv-button",
        attr: {
          href: viewerHref(base, viewer.route, { url: postUrl }),
          title: viewer.title,
        },
      });
      link.createIcon((icon) => icon.setIcon(viewer.icon));
      link.createSpan({ text: viewer.label });
    }

    return bar;
  }
}
