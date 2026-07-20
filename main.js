var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.js
var main_exports = {};
__export(main_exports, {
  default: () => ThreadViewerPlugin
});
module.exports = __toCommonJS(main_exports);

// ../../../../tmp/impro-upstream/impro-plugin/main.js
var SimpleUUID = class {
  constructor() {
    this._id = 0;
  }
  create() {
    return this._id++;
  }
};
var uuid = new SimpleUUID();
var callHandlers = /* @__PURE__ */ new Map();
var pendingHostCalls = /* @__PURE__ */ new Map();
function hostCall(method, ...args) {
  const hostCallId = uuid.create();
  return new Promise((resolve, reject) => {
    pendingHostCalls.set(hostCallId, { resolve, reject });
    self.postMessage({ type: "hostCall", method, hostCallId, args });
  });
}
var eventListeners = /* @__PURE__ */ new Map();
var registeredEvents = /* @__PURE__ */ new Set();
async function invokeListeners(listeners, event, args) {
  for (const listener of listeners) {
    try {
      await listener(...args);
    } catch (error) {
      console.error(`"${event}" listener threw:`, error);
    }
  }
}
async function dispatchEvent(event, args) {
  const listeners = eventListeners.get(event) ?? /* @__PURE__ */ new Set();
  switch (event) {
    case "post-context-menu":
    case "profile-context-menu": {
      const menu = new Menu();
      await invokeListeners(listeners, event, [menu, ...args]);
      return menu._serialize();
    }
    case "post-composer-open": {
      const composer = new Composer();
      await invokeListeners(listeners, event, [composer, ...args]);
      return composer._serialize();
    }
    default:
      console.warn(`No dispatch case for plugin event "${event}".`);
      return null;
  }
}
function addEventListener(event, listener) {
  let listeners = eventListeners.get(event);
  if (!listeners) {
    listeners = /* @__PURE__ */ new Set();
    eventListeners.set(event, listeners);
  }
  listeners.add(listener);
  if (!registeredEvents.has(event)) {
    registeredEvents.add(event);
    const handlerId = uuid.create();
    callHandlers.set(handlerId, (...args) => dispatchEvent(event, args));
    self.postMessage({
      type: "register",
      target: "eventListener",
      event,
      handlerId
    });
  }
}
var MenuItem = class {
  constructor() {
    this.title = "";
    this.icon = null;
    this._callback = () => {
    };
  }
  setTitle(title) {
    this.title = title;
    return this;
  }
  setIcon(icon) {
    this.icon = icon;
    return this;
  }
  onClick(callback) {
    this._callback = callback;
    return this;
  }
};
var Menu = class {
  constructor() {
    this.items = [];
  }
  addItem(builder) {
    const item = new MenuItem();
    builder(item);
    this.items.push(item);
    return this;
  }
  _serialize() {
    return this.items.map((item) => {
      const handlerId = uuid.create();
      callHandlers.set(handlerId, item._callback);
      return { title: item.title, icon: item.icon, handlerId };
    });
  }
};
var Composer = class {
  constructor() {
    this._ops = [];
    this._cursor = null;
  }
  setText(text) {
    this._ops.push({ op: "set", text: String(text) });
    return this;
  }
  appendText(text) {
    this._ops.push({ op: "append", text: String(text) });
    return this;
  }
  prependText(text) {
    this._ops.push({ op: "prepend", text: String(text) });
    return this;
  }
  setCursor(index) {
    this._cursor = index;
    return this;
  }
  _serialize() {
    return { ops: this._ops, cursor: this._cursor };
  }
};
var PluginData = class {
  getPost(uri) {
    return hostCall("getPost", { uri });
  }
  getProfile(did) {
    return hostCall("getProfile", { did });
  }
  getRecord(repo, collection, rkey) {
    return hostCall("getRecord", { repo, collection, rkey });
  }
};
var App = class {
  constructor() {
    this.currentUser = null;
    this.data = new PluginData();
  }
  on(event, listener) {
    addEventListener(event, listener);
  }
  refreshFeedFilters(feedURI = null) {
    return hostCall("refreshFeedFilters", feedURI);
  }
};
async function fetch(url, init = {}) {
  const result = await hostCall("fetch", {
    url,
    init: serializeFetchInit(init)
  });
  return new PluginResponse(result);
}
function serializeFetchInit(init) {
  const serialized = {};
  if (init.method != null) serialized.method = String(init.method);
  if (init.headers != null) {
    const headers = {};
    if (typeof init.headers.forEach === "function") {
      init.headers.forEach((value, name) => {
        headers[name] = value;
      });
    } else if (typeof init.headers[Symbol.iterator] === "function") {
      for (const [name, value] of init.headers) headers[name] = value;
    } else {
      Object.assign(headers, init.headers);
    }
    serialized.headers = headers;
  }
  if (init.body != null) serialized.body = init.body;
  return serialized;
}
var PluginResponse = class {
  constructor({ status, ok, headers, body }) {
    this.status = status;
    this.ok = ok;
    this.headers = new Map(Object.entries(headers ?? {}));
    this._body = body;
  }
  async text() {
    return this._body;
  }
  async json() {
    return JSON.parse(this._body);
  }
};
var Notice = class {
  constructor(message, timeout = 0) {
    this._toastId = uuid.create();
    this._timeout = timeout;
    this._hidden = false;
    this.noticeEl = new VirtualEl("div");
    this.noticeEl.addClass("toast");
    this.noticeEl.setText(message);
    queueMicrotask(() => {
      if (this._hidden) return;
      hostCall("showToast", {
        toastId: this._toastId,
        element: this.noticeEl._serialize(),
        timeout: this._timeout
      });
    });
  }
  setMessage(message) {
    this.noticeEl.setText(message);
    return this;
  }
  hide() {
    if (this._hidden) return;
    this._hidden = true;
    hostCall("hideToast", { toastId: this._toastId });
  }
};
var registered = false;
var Plugin = class {
  constructor() {
    this.app = new App();
  }
  addSidebarItem(icon, title, callback = () => {
  }) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, callback);
    self.postMessage({
      type: "register",
      target: "sidebarItem",
      icon,
      title,
      handlerId
    });
  }
  async loadData() {
    return hostCall("loadData");
  }
  async saveData(data) {
    await hostCall("saveData", { data });
  }
  addSettingTab(tab) {
    tab.plugin = this;
    const displayHandlerId = uuid.create();
    callHandlers.set(displayHandlerId, () => {
      tab.containerEl = new VirtualEl("div");
      tab.display();
      return tab.containerEl._serialize();
    });
    self.postMessage({
      type: "register",
      target: "settingTab",
      name: tab.name ?? null,
      displayHandlerId
    });
    this._settingTab = tab;
  }
  addFeedFilter(callback = () => {
  }) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, callback);
    self.postMessage({
      type: "register",
      target: "feedFilter",
      handlerId
    });
  }
  // callback(tokens, context) receives the rich-text token stream for one
  // post and returns a new token array (or the input unchanged). The host
  // batches all posts of a render into one call per plugin.
  //
  // options.handlesFacetTypes: array of facet feature $type strings this
  // transform owns, to prevent render flash of fallback text
  registerRichTextTransform(callback = (tokens) => tokens, options = {}) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, async (batch) => {
      const results = [];
      for (const { tokens, context } of batch) {
        try {
          const value = await callback(tokens, context);
          results.push({ value: serializeTransformTokens(value) });
        } catch (error) {
          results.push({ error: error?.message ?? String(error) });
        }
      }
      return results;
    });
    const handlesFacetTypes = Array.isArray(options.handlesFacetTypes) ? options.handlesFacetTypes.filter((type) => typeof type === "string") : [];
    self.postMessage({
      type: "register",
      target: "richTextTransform",
      handlerId,
      handlesFacetTypes
    });
  }
  registerSlot(name, callback = () => null) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, async (context) => {
      const result = await callback(context);
      if (result == null) return null;
      if (!(result instanceof VirtualEl)) {
        const description = result?.constructor?.name ?? typeof result;
        throw new Error(
          `Slot "${name}" must return a VirtualEl (or null), got ${description}`
        );
      }
      return result._serialize();
    });
    self.postMessage({
      type: "register",
      target: "slot",
      name,
      handlerId
    });
  }
  onload() {
  }
  onunload() {
  }
  static register() {
    if (registered) return;
    registered = true;
    const instance = new this();
    hostCall("getCurrentUser").then((user) => {
      instance.app.currentUser = user;
      return instance.onload();
    }).then(
      () => self.postMessage({ type: "ready" }),
      (error) => self.postMessage({
        type: "ready",
        error: error?.message ?? String(error)
      })
    );
  }
};
function serializeTransformTokens(tokens) {
  if (!Array.isArray(tokens)) return tokens;
  return tokens.map((token) => {
    if ((token?.type === "inline" || token?.type === "block") && token.node instanceof VirtualEl) {
      return { ...token, node: token.node._serialize() };
    }
    return token;
  });
}
var openModals = /* @__PURE__ */ new Map();
var Modal = class {
  constructor() {
    this._modalId = uuid.create();
    this.contentEl = new VirtualEl("div");
    this.titleEl = new VirtualEl("h2");
  }
  open() {
    if (openModals.has(this._modalId)) return;
    openModals.set(this._modalId, this);
    this.onOpen();
    self.postMessage({
      type: "hostCall",
      method: "openModal",
      args: [
        {
          modalId: this._modalId,
          title: this.titleEl._serialize(),
          content: this.contentEl._serialize()
        }
      ]
    });
  }
  close() {
    if (!openModals.has(this._modalId)) return;
    openModals.delete(this._modalId);
    self.postMessage({
      type: "hostCall",
      method: "closeModal",
      args: [{ modalId: this._modalId }]
    });
    this.onClose();
  }
  onOpen() {
  }
  onClose() {
  }
};
var PluginSettingTab = class {
  constructor() {
    this.containerEl = new VirtualEl("div");
    this.name = null;
  }
  setName(name) {
    this.name = name;
    return this;
  }
  display() {
  }
  refresh({ reset = false } = {}) {
    return hostCall("refreshSettingTab", { reset });
  }
};
var Setting = class {
  constructor(containerEl) {
    this.settingEl = containerEl.createDiv({ cls: "setting-item" });
    this.infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
    this.nameEl = this.infoEl.createEl("h2", { cls: "setting-item-name" });
    this.descEl = this.infoEl.createEl("p", { cls: "setting-item-desc" });
    this.controlEl = this.settingEl.createDiv({
      cls: "setting-item-control"
    });
  }
  setName(text) {
    this.nameEl.setText(text);
    return this;
  }
  setDesc(text) {
    this.descEl.setText(text);
    return this;
  }
  addText(callback) {
    const component = new TextComponent(this.controlEl);
    callback(component);
    return this;
  }
  addTextArea(callback) {
    const component = new TextAreaComponent(this.controlEl);
    callback(component);
    return this;
  }
  addToggle(callback) {
    const component = new ToggleComponent(this.controlEl);
    callback(component);
    return this;
  }
  addDropdown(callback) {
    const component = new DropdownComponent(this.controlEl);
    callback(component);
    return this;
  }
  addButton(callback) {
    const component = new ButtonComponent(this.controlEl);
    callback(component);
    return this;
  }
};
var TextComponent = class {
  constructor(containerEl) {
    this.el = containerEl.createEl("input", {
      attr: { type: "text" },
      cls: "setting-item-text-input"
    });
  }
  setValue(value) {
    this.el.setAttr("value", value == null ? "" : String(value));
    return this;
  }
  setPlaceholder(value) {
    this.el.setAttr("placeholder", value);
    return this;
  }
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value));
    return this;
  }
};
var TextAreaComponent = class {
  constructor(containerEl) {
    this.el = containerEl.createEl("textarea", {
      cls: "setting-item-textarea"
    });
  }
  setValue(value) {
    this.el.setText(value == null ? "" : String(value));
    return this;
  }
  setPlaceholder(value) {
    this.el.setAttr("placeholder", value);
    return this;
  }
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value));
    return this;
  }
};
var ToggleComponent = class {
  constructor(containerEl) {
    this.el = containerEl.createEl("toggle-switch", {
      cls: "setting-item-toggle"
    });
  }
  setValue(value) {
    if (value) this.el.setAttr("checked", "");
    else delete this.el.attrs.checked;
    return this;
  }
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.checked));
    return this;
  }
};
var DropdownComponent = class {
  constructor(containerEl) {
    this.el = containerEl.createEl("select", {
      cls: "setting-item-dropdown"
    });
  }
  addOption(value, label) {
    this.el.createEl("option", { text: label, attr: { value } });
    return this;
  }
  addOptions(map) {
    for (const [value, label] of Object.entries(map)) {
      this.addOption(value, label);
    }
    return this;
  }
  setValue(value) {
    for (const child of this.el.children) {
      if (child.attrs?.value === value) {
        child.attrs.selected = "";
      } else if (child.attrs) {
        delete child.attrs.selected;
      }
    }
    return this;
  }
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value));
    return this;
  }
};
var ButtonComponent = class {
  constructor(containerEl) {
    this.el = containerEl.createEl("button", {
      cls: "rounded-button"
    });
  }
  setButtonText(text) {
    this.el.setText(text);
    return this;
  }
  setCta() {
    this.el.addClass("rounded-button-primary");
    return this;
  }
  onClick(callback) {
    this.el.onClick(callback);
    return this;
  }
};
var IconComponent = class {
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-icon");
  }
  setIcon(name) {
    this.el.setAttr("icon", name);
    return this;
  }
};
var ProfilesListComponent = class {
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-profiles-list");
  }
  setDids(dids) {
    const value = Array.isArray(dids) ? dids.join(",") : String(dids ?? "");
    this.el.setAttr("dids", value);
    return this;
  }
  setEmptyMessage(message) {
    this.el.setAttr("empty-message", message);
    return this;
  }
};
var PostsFeedComponent = class {
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-posts-feed");
  }
  setUris(uris) {
    const value = Array.isArray(uris) ? uris.join(",") : String(uris ?? "");
    this.el.setAttr("uris", value);
    return this;
  }
  setEmptyMessage(message) {
    this.el.setAttr("empty-message", message);
    return this;
  }
};
var VirtualEl = class _VirtualEl {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.text = null;
    this.children = [];
    this.events = {};
  }
  onClick(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.click = handlerId;
    return this;
  }
  onChange(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.change = handlerId;
    return this;
  }
  onInput(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.input = handlerId;
    return this;
  }
  setText(text) {
    this.text = text;
    this.children = [];
    return this;
  }
  empty() {
    this.text = null;
    this.children = [];
    return this;
  }
  addClass(cls) {
    this.attrs.class = this.attrs.class ? `${this.attrs.class} ${cls}` : cls;
    return this;
  }
  setAttr(name, value) {
    this.attrs[name] = value === void 0 ? "" : value;
    return this;
  }
  createEl(tag, options = {}, callback) {
    const child = new _VirtualEl(tag);
    if (options.text != null) child.text = options.text;
    if (options.cls) {
      child.attrs.class = Array.isArray(options.cls) ? options.cls.join(" ") : options.cls;
    }
    if (options.attr) Object.assign(child.attrs, options.attr);
    this.children.push(child);
    if (typeof callback === "function") callback(child);
    return child;
  }
  createDiv(options = {}, callback) {
    return this.createEl("div", options, callback);
  }
  createSpan(options = {}, callback) {
    return this.createEl("span", options, callback);
  }
  createProfilesList(callback) {
    const component = new ProfilesListComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }
  createPostsFeed(callback) {
    const component = new PostsFeedComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }
  createIcon(callback) {
    const component = new IconComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }
  _serialize() {
    return {
      tag: this.tag,
      attrs: this.attrs,
      text: this.text,
      children: this.children.map((child) => child._serialize()),
      events: this.events
    };
  }
};
self.onmessage = async (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;
  if (message.type === "call") {
    const fn = callHandlers.get(message.handlerId);
    if (!fn) {
      self.postMessage({
        type: "result",
        callId: message.callId,
        error: `unknown handler ${message.handlerId}`
      });
      return;
    }
    try {
      const value = await fn(...message.args);
      self.postMessage({ type: "result", callId: message.callId, value });
    } catch (error) {
      self.postMessage({
        type: "result",
        callId: message.callId,
        error: error.message ?? String(error)
      });
    }
    return;
  }
  if (message.type === "hostResult") {
    const pending = pendingHostCalls.get(message.hostCallId);
    if (!pending) return;
    pendingHostCalls.delete(message.hostCallId);
    if (message.error) pending.reject(new Error(message.error));
    else pending.resolve(message.value);
    return;
  }
  if (message.type === "event") {
    switch (message.event) {
      case "modalDismissed": {
        const modal = openModals.get(message.data.modalId);
        if (modal) {
          openModals.delete(message.data.modalId);
          modal.onClose();
        }
        return;
      }
    }
    return;
  }
};

// src/main.js
var POST_VIEWERS = [
  {
    key: "showBlog",
    route: "blog",
    label: "Blog",
    title: "Read this thread as a blog post",
    icon: "article-line"
  },
  {
    key: "showParallelBoard",
    route: "parallelboard",
    label: "Parallel board",
    title: "View this thread as a parallel board",
    icon: "view-columns-line"
  },
  {
    key: "showTree",
    route: "treeviewer",
    label: "Tree panel",
    title: "Open a tree in a side panel",
    icon: "sitemap-line"
  }
];
var DEFAULT_SETTINGS = {
  // Must be https:// — the host only renders https links.
  baseUrl: "https://threadviewer.app",
  // Route used by "View repo" on a profile (loads the author's full repo).
  repoRoute: "viewer2",
  showBlog: true,
  showParallelBoard: true,
  showTree: true
};
var AT_POST_RE = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/;
var PUBLIC_APPVIEW = "https://public.api.bsky.app";
var MAX_TREE_NODES = 400;
function normalizeBaseUrl(value) {
  const raw = (value ?? "").trim();
  return (raw || DEFAULT_SETTINGS.baseUrl).replace(/\/+$/, "");
}
function postUrlFromContextUri(uri) {
  if (typeof uri !== "string") return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  const match = trimmed.match(AT_POST_RE);
  if (match) {
    return `https://bsky.app/profile/${match[1]}/post/${match[2]}`;
  }
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  return null;
}
function postHrefFromAtUri(uri) {
  const match = typeof uri === "string" ? uri.match(AT_POST_RE) : null;
  return match ? `https://bsky.app/profile/${match[1]}/post/${match[2]}` : null;
}
function isThreadViewPost(value) {
  return Boolean(value?.post?.uri && value?.post?.author && value?.post?.record);
}
function highestAvailableUri(node) {
  let current = node;
  while (isThreadViewPost(current?.parent)) current = current.parent;
  return current?.post?.uri ?? null;
}
function declaredRootUri(node) {
  const uri = node?.post?.record?.reply?.root?.uri;
  return typeof uri === "string" && AT_POST_RE.test(uri) ? uri : null;
}
async function requestThread(uri, { depth, parentHeight }) {
  const params = new URLSearchParams({
    uri,
    depth: String(depth),
    parentHeight: String(parentHeight)
  });
  const response = await fetch(
    `${PUBLIC_APPVIEW}/xrpc/app.bsky.feed.getPostThread?${params}`
  );
  if (!response.ok) throw new Error(`Bluesky returned ${response.status}`);
  const payload = await response.json();
  if (!isThreadViewPost(payload?.thread)) throw new Error("Thread is unavailable");
  return payload.thread;
}
async function fetchRootThread(uri) {
  const centered = await requestThread(uri, { depth: 0, parentHeight: 100 });
  const availableUri = highestAvailableUri(centered);
  const rootUri = declaredRootUri(centered) || availableUri;
  if (!rootUri) throw new Error("Could not find the conversation root");
  try {
    return await requestThread(rootUri, { depth: 1e3, parentHeight: 0 });
  } catch (error) {
    if (!availableUri || availableUri === rootUri) throw error;
    return requestThread(availableUri, { depth: 1e3, parentHeight: 0 });
  }
}
function viewerHref(base, route, params) {
  const search = new URLSearchParams(params).toString();
  return `${base}/${route}${search ? `?${search}` : ""}`;
}
function profileActor(profile) {
  const actor = (profile?.handle || profile?.did || "").trim();
  return actor || null;
}
var RepoModal = class extends Modal {
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
      text: `View @${this.label}'s full repository \u2014 every post and self-reply thread \u2014 in Thread Viewer.`
    });
    const actions = this.contentEl.createDiv({ cls: "tv-modal-actions" });
    actions.createEl("a", {
      cls: "tv-button tv-button--primary",
      text: "Open repo viewer \u2192",
      attr: { href, title: "Open repo viewer" }
    });
    actions.createEl("button", { cls: "tv-button", text: "Close" }).onClick(() => this.close());
  }
  onClose() {
    this.titleEl.empty();
    this.contentEl.empty();
  }
};
var AboutModal = class extends Modal {
  constructor(base) {
    super();
    this.base = base;
  }
  onOpen() {
    this.titleEl.setText("Thread Viewer");
    this.contentEl.createEl("p", {
      cls: "tv-modal-text",
      text: "Thread Viewer renders Bluesky self-reply threads in alternate layouts."
    });
    const list = this.contentEl.createEl("ul", { cls: "tv-modal-list" });
    list.createEl("li", { text: "On a post: open it as a blog, parallel board, or tree." });
    list.createEl("li", { text: "On a profile: open the author's full repo." });
    const actions = this.contentEl.createDiv({ cls: "tv-modal-actions" });
    actions.createEl("a", {
      cls: "tv-button tv-button--primary",
      text: "Open Thread Viewer \u2192",
      attr: { href: this.base, title: "Open Thread Viewer" }
    });
    actions.createEl("button", { cls: "tv-button", text: "Close" }).onClick(() => this.close());
  }
  onClose() {
    this.titleEl.empty();
    this.contentEl.empty();
  }
};
var TreePanelModal = class extends Modal {
  constructor({ thread, sourceUrl, viewerUrl }) {
    super();
    this.thread = thread;
    this.sourceUrl = sourceUrl;
    this.viewerUrl = viewerUrl;
    this.renderedNodes = 0;
    this.truncated = false;
  }
  onOpen() {
    this.titleEl.setText("Thread tree");
    const panel = this.contentEl.createDiv({ cls: "tv-tree-panel" });
    const rootList = panel.createEl("ol", { cls: "tv-tree" });
    this.renderNode(rootList, this.thread);
    if (this.truncated) {
      panel.createEl("p", {
        cls: "tv-tree-panel__notice",
        text: `Showing the first ${MAX_TREE_NODES} posts.`
      });
    }
    const actions = panel.createDiv({ cls: "tv-tree-panel__actions" });
    actions.createEl("a", {
      cls: "tv-button",
      text: "Open full Tree Viewer \u2197",
      attr: { href: this.viewerUrl, title: "Open the full tree-only viewer" }
    });
    actions.createEl("button", { cls: "tv-button tv-button--primary", text: "Close" }).onClick(() => this.close());
  }
  renderNode(list, node) {
    if (!isThreadViewPost(node) || this.renderedNodes >= MAX_TREE_NODES) {
      if (isThreadViewPost(node)) this.truncated = true;
      return;
    }
    this.renderedNodes += 1;
    const post = node.post;
    const author = post.author;
    const text = typeof post.record?.text === "string" ? post.record.text.trim() : "";
    const href = postHrefFromAtUri(post.uri) || this.sourceUrl;
    const item = list.createEl("li", { cls: "tv-tree__item" });
    const card = item.createDiv({ cls: "tv-tree__card" });
    card.createSpan({
      cls: "tv-tree__avatar",
      text: (author.displayName || author.handle || "?").slice(0, 1).toUpperCase()
    });
    const body = card.createDiv({ cls: "tv-tree__body" });
    body.createEl("a", {
      cls: "tv-tree__author",
      text: author.displayName || `@${author.handle}`,
      attr: { href, title: `Open @${author.handle}'s post` }
    });
    body.createEl("p", {
      cls: "tv-tree__text",
      text: text || "Post without text"
    });
    const replies = Array.isArray(node.replies) ? node.replies.filter(isThreadViewPost) : [];
    if (replies.length === 0) return;
    const children = item.createEl("ol", { cls: "tv-tree" });
    for (const reply of replies) this.renderNode(children, reply);
  }
  onClose() {
    this.titleEl.empty();
    this.contentEl.empty();
  }
};
var ThreadViewerSettingTab = class extends PluginSettingTab {
  constructor() {
    super();
    this.setName("Thread Viewer");
  }
  display() {
    const settings = this.plugin.settings;
    new Setting(this.containerEl).setName("Thread Viewer URL").setDesc("Base URL of your Thread Viewer instance. Must be https:// for in-app links to open.").addText(
      (text) => text.setPlaceholder(DEFAULT_SETTINGS.baseUrl).setValue(settings.baseUrl).onChange((value) => this.plugin.updateSetting("baseUrl", value))
    );
    new Setting(this.containerEl).setName("Repo viewer route").setDesc('Route used by "View repo" on a profile (default: viewer2).').addText(
      (text) => text.setPlaceholder(DEFAULT_SETTINGS.repoRoute).setValue(settings.repoRoute).onChange((value) => this.plugin.updateSetting("repoRoute", value))
    );
    for (const viewer of POST_VIEWERS) {
      new Setting(this.containerEl).setName(`Show "${viewer.label}"`).setDesc(viewer.title).addToggle(
        (toggle) => toggle.setValue(settings[viewer.key] !== false).onChange((value) => this.plugin.updateSetting(viewer.key, value))
      );
    }
  }
};
var ThreadViewerPlugin = class extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...saved ?? {} };
    this.addSettingTab(new ThreadViewerSettingTab());
    this.addSidebarItem("telescope-line", "Thread Viewer", () => {
      new AboutModal(normalizeBaseUrl(this.settings.baseUrl)).open();
    });
    this.registerSlot(
      "post-thread-view:after-main",
      (context) => this.renderPostViewerBar(context)
    );
    this.app.on("profile-context-menu", (menu, profile) => {
      const actor = profileActor(profile);
      if (!actor) return;
      menu.addItem(
        (item) => item.setTitle("View repo in Thread Viewer").setIcon("git-branch-line").onClick(() => {
          new RepoModal({
            base: normalizeBaseUrl(this.settings.baseUrl),
            route: this.settings.repoRoute || DEFAULT_SETTINGS.repoRoute,
            actor,
            label: profile?.handle || actor
          }).open();
        })
      );
    });
  }
  async updateSetting(key, value) {
    this.settings[key] = value;
    await this.saveData(this.settings);
  }
  async openTreePanel(postUrl, uri) {
    const loadingNotice = new Notice("Loading thread tree\u2026");
    try {
      const thread = await fetchRootThread(uri);
      const base = normalizeBaseUrl(this.settings.baseUrl);
      new TreePanelModal({
        thread,
        sourceUrl: postUrl,
        viewerUrl: viewerHref(base, "treeviewer", { url: postUrl, embed: "tree" })
      }).open();
    } catch (error) {
      new Notice(error?.message || "Could not load the thread tree", 5e3);
    } finally {
      loadingNotice.hide();
    }
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
      if (viewer.key === "showTree") {
        const button = group.createEl("button", {
          cls: "tv-button",
          attr: { type: "button", title: viewer.title }
        });
        button.createIcon((icon) => icon.setIcon(viewer.icon));
        button.createSpan({ text: viewer.label });
        button.onClick(() => this.openTreePanel(postUrl, context.uri));
        continue;
      }
      const link = group.createEl("a", {
        cls: "tv-button",
        attr: {
          href: viewerHref(base, viewer.route, { url: postUrl }),
          title: viewer.title
        }
      });
      link.createIcon((icon) => icon.setIcon(viewer.icon));
      link.createSpan({ text: viewer.label });
    }
    return bar;
  }
};
