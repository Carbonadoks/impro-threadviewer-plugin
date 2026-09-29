import { Plugin, Modal, PluginSettingTab, Setting, VirtualEl } from "@impro.social/impro-plugin";

// Thread Viewer routes that take a single bsky post URL via ?url=
const POST_VIEWERS = [
  {
    key: "showTree",
    route: "treeviewer",
    label: "Tree viewer",
    title: "View this thread as a tree",
    icon: "sitemap-line",
  },
  {
    key: "showParallelBoard",
    route: "parallelboard",
    label: "Parallel board",
    title: "View this thread as a parallel board",
    icon: "view-columns-line",
  },
];

// Route that loads an author's full repo (every post + self-reply thread).
const REPO_ROUTE = "viewer2";

const POST_SLOT = "post-thread-view:after-main";

const DEFAULT_SETTINGS = {
  // Must be https:// — the host only renders https links.
  baseUrl: "https://threadviewer.app",
  showTree: true,
  showParallelBoard: true,
  // Adds "Open in Thread Viewer" to every post's context menu (feeds, search…).
  showInPostMenu: true,
};

const AT_POST_RE = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/;

function normalizeBaseUrl(value) {
  const raw = (value ?? "").trim();
  return (raw || DEFAULT_SETTINGS.baseUrl).replace(/\/+$/, "");
}

// Impro gives us `at://<did>/app.bsky.feed.post/<rkey>`. Thread Viewer wants
// a public bsky.app URL — a DID works in the /profile/ path just like a handle.
function postUrlFromAtUri(uri) {
  const match = typeof uri === "string" ? uri.trim().match(AT_POST_RE) : null;
  return match ? `https://bsky.app/profile/${match[1]}/post/${match[2]}` : null;
}

function viewerHref(base, route, params) {
  const search = new URLSearchParams(params).toString();
  return `${base}/${route}${search ? `?${search}` : ""}`;
}

function profileActor(profile) {
  const actor = (profile?.handle || profile?.did || "").trim();
  return actor || null;
}

function addViewerLink(parent, href, { label, title, icon }, cls = "tv-button") {
  const link = parent.createEl("a", { cls, attr: { href, title } });
  link.createIcon((c) => c.setIcon(icon));
  link.createSpan({ text: label });
  return link;
}

// Context-menu items can't navigate on their own, so they open a small modal
// that surfaces real <a> links (the host confirms external links on click).
class LinksModal extends Modal {
  constructor({ title, text, links }) {
    super();
    this.title = title;
    this.text = text;
    this.links = links;
  }

  onOpen() {
    this.titleEl.setText(this.title);
    if (this.text) this.contentEl.createEl("p", { cls: "tv-modal-text", text: this.text });
    const actions = this.contentEl.createDiv({ cls: "tv-modal-actions" });
    for (const link of this.links) {
      addViewerLink(actions, link.href, link, "tv-button tv-button--primary");
    }
    actions.createEl("button", { cls: "tv-button", text: "Close" }).onClick(() => this.close());
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
      .setDesc("Base URL of your Thread Viewer instance. Must be https:// for links to open.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.baseUrl)
          .setValue(settings.baseUrl)
          .onChange((value) => this.plugin.updateSetting("baseUrl", value)),
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

    new Setting(this.containerEl)
      .setName("Add to post menu")
      .setDesc('Show "Open in Thread Viewer" in every post\'s ⋯ menu, e.g. in feeds.')
      .addToggle((toggle) =>
        toggle
          .setValue(settings.showInPostMenu !== false)
          .onChange((value) => this.plugin.updateSetting("showInPostMenu", value)),
      );
  }
}

export default class ThreadViewerPlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };

    this.addSettingTab(new ThreadViewerSettingTab());

    // Post page: viewer links directly below the focused post. Output depends
    // only on the post URI (plus settings, which refresh the slot on change).
    this.registerSlot(POST_SLOT, (context) => this.renderPostViewerBar(context), {
      cacheKey: ["uri"],
    });

    // Any post, anywhere: "Open in Thread Viewer" in the post context menu.
    this.app.on("post-context-menu", (menu, post) => {
      if (this.settings.showInPostMenu === false) return;
      const links = this.postViewerLinks(post?.uri);
      if (links.length === 0) return;
      menu.addItem((item) =>
        item
          .setTitle("Open in Thread Viewer")
          .setIcon("sitemap-line")
          .onClick(() =>
            new LinksModal({ title: "Open in Thread Viewer", links }).open(),
          ),
      );
    });

    // Profile: link to the author's full repo.
    this.app.on("profile-context-menu", (menu, profile) => {
      const actor = profileActor(profile);
      if (!actor) return;
      menu.addItem((item) =>
        item
          .setTitle("View repo in Thread Viewer")
          .setIcon("git-branch-line")
          .onClick(() =>
            new LinksModal({
              title: "Open repo in Thread Viewer",
              text: `View @${profile?.handle || actor}'s full repository — every post and self-reply thread.`,
              links: [
                {
                  href: viewerHref(normalizeBaseUrl(this.settings.baseUrl), REPO_ROUTE, {
                    handle: actor,
                  }),
                  label: "Open repo viewer",
                  title: "Open repo viewer",
                  icon: "git-branch-line",
                },
              ],
            }).open(),
          ),
      );
    });
  }

  async updateSetting(key, value) {
    this.settings[key] = value;
    await this.saveData(this.settings);
    await this.refreshSlot(POST_SLOT);
  }

  postViewerLinks(uri) {
    const postUrl = postUrlFromAtUri(uri);
    if (!postUrl) return [];
    const base = normalizeBaseUrl(this.settings.baseUrl);
    return POST_VIEWERS.filter((v) => this.settings[v.key] !== false).map((v) => ({
      ...v,
      href: viewerHref(base, v.route, { url: postUrl }),
    }));
  }

  renderPostViewerBar(context) {
    const links = this.postViewerLinks(context?.uri);
    if (links.length === 0) return null;

    const bar = new VirtualEl("div").addClass("tv-viewer-bar");
    bar.createSpan({ cls: "tv-viewer-bar__label", text: "Open in Thread Viewer" });
    const group = bar.createDiv({ cls: "tv-viewer-bar__buttons" });
    for (const link of links) addViewerLink(group, link.href, link);
    return bar;
  }
}
