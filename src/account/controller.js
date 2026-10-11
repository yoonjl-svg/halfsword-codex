import { cleanProfile, namespace } from './profile.js';

// Transport is injected: real Supabase in the game, deterministic fakes in tests.
export class AccountController {
  constructor({ appId, transport = null, storage, initialSettings = {}, onChange = () => {} }) {
    this.prefix = namespace(appId); this.appId = appId; this.transport = transport; this.storage = storage; this.onChange = onChange;
    this.epoch = 0; this.edit = 0; this.revision = 0; this.user = null; this.ready = !transport; this.dirty = false; this.saving = false;
    this.profile = cleanProfile({ settings: initialSettings }); this.status = transport ? 'connecting' : 'local'; this.storageOK = true; this.listeners = new Set();
    const local = this.read('device');
    if (local) this.profile = cleanProfile(local.profile);
  }
  read(key) { try { const value = JSON.parse(this.storage.getItem(this.prefix + key) || 'null'); if (value && key !== 'last-user') cleanProfile(value.profile); return value; } catch { this.storageOK = false; return null; } }
  write(key, value) { try { this.storage.setItem(this.prefix + key, JSON.stringify(value)); } catch { this.storageOK = false; } }
  snapshot() { return { profile: structuredClone(this.profile), user: this.user && { id: this.user.id, is_anonymous: this.user.is_anonymous }, status: this.status, storageOK: this.storageOK, ready: this.ready, dirty: this.dirty }; }
  emit() { const state = this.snapshot(); this.onChange(state); for (const listener of this.listeners) listener(state); }
  subscribe(listener) { this.listeners.add(listener); listener(this.snapshot()); return () => this.listeners.delete(listener); }
  persist() { this.write(this.user ? `user:${this.user.id}` : 'device', { profile: this.profile, revision: this.revision, dirty: this.dirty }); }
  start() {
    if (!this.starting) this.starting = this.startOnce().finally(() => { this.starting = null; });
    return this.starting;
  }
  async startOnce() {
    if (!this.transport) { this.persist(); this.emit(); return; }
    const epoch = this.epoch;
    try {
      let user = await this.transport.session();
      if (epoch !== this.epoch) return;
      // Do not silently make a new account when an old credential has vanished.
      if (!user && this.read('last-user')) { this.status = 'expired'; this.emit(); return; }
      const created = !user;
      if (!user) user = await this.transport.guest();
      if (epoch !== this.epoch) return;
      await this.adopt(user, created);
    } catch { if (epoch === this.epoch) { this.status = 'offline'; this.ready = true; this.emit(); } }
  }
  async adopt(user, importDevice = false) {
    if (this.user?.id === user.id) { this.user = user; this.emit(); return; }
    const epoch = ++this.epoch; this.user = user; this.ready = false; this.edit = 0; this.saving = false; this.dirty = false;
    const cache = this.read(`user:${user.id}`);
    this.profile = cleanProfile(cache?.profile || (importDevice ? this.profile : {}));
    this.revision = Number.isSafeInteger(cache?.revision) && cache.revision >= 0 ? cache.revision : 0;
    this.dirty = !!cache?.dirty || (!cache && importDevice);
    this.persist(); // Survive closing the page while the first remote load is unavailable.
    this.write('last-user', user.id); this.status = 'connecting'; this.emit();
    try {
      const remote = await this.transport.load(user.id);
      if (epoch !== this.epoch) return;
      if (remote && this.dirty && remote.revision !== this.revision) { this.status = 'conflict'; this.ready = true; this.emit(); return; }
      if (remote && !this.dirty) { this.profile = cleanProfile(remote); this.revision = remote.revision; }
      if (!remote) { this.revision = 0; this.dirty = true; }
      this.ready = true; this.status = this.dirty ? 'pending' : 'saved'; this.persist(); this.emit();
      if (this.dirty) await this.flush();
    } catch { if (epoch === this.epoch) { this.status = 'offline'; this.ready = true; this.emit(); } }
  }
  change(patch) {
    if (this.status === 'expired') return;
    this.profile = cleanProfile({ ...this.profile, ...patch }); this.edit++; this.dirty = true;
    if (this.status !== 'conflict') this.status = this.transport ? 'pending' : 'local';
    this.persist(); this.emit();
  }
  async flush() {
    if (!this.transport || !this.user || !this.ready || this.saving || this.status === 'conflict' || !this.dirty) return;
    const epoch = this.epoch; this.saving = true;
    try {
      while (this.dirty && epoch === this.epoch) {
        const edit = this.edit; const profile = structuredClone(this.profile);
        this.status = 'saving'; this.emit();
        const remote = await this.transport.save(this.revision, profile, this.user.id);
        if (epoch !== this.epoch) return;
        this.revision = remote.revision;
        if (edit === this.edit) this.dirty = false;
        this.status = this.dirty ? 'pending' : 'saved'; this.persist(); this.emit();
      }
    } catch (error) {
      if (epoch === this.epoch) { this.status = error.code === 'PT409' ? 'conflict' : 'offline'; this.persist(); this.emit(); }
    } finally { if (epoch === this.epoch) this.saving = false; }
  }
  async reloadRemote() {
    if (!this.user || this.saving) return;
    const epoch = this.epoch; const edit = this.edit;
    try {
      const remote = await this.transport.load(this.user.id);
      if (epoch !== this.epoch || edit !== this.edit) return;
      if (!remote) { this.revision = 0; this.dirty = true; this.ready = true; this.persist(); await this.flush(); return; }
      // Explicit user choice. Preserve the replaced local copy for recovery.
      this.write(`backup:${this.user.id}`, { profile: this.profile, revision: this.revision });
      this.profile = cleanProfile(remote); this.revision = remote.revision; this.dirty = false; this.status = 'saved'; this.persist(); this.emit();
    } catch { if (epoch === this.epoch) { this.status = 'offline'; this.emit(); } }
  }
  sessionEnded() {
    this.epoch++; this.user = null; this.ready = false; this.saving = false; this.dirty = false;
    this.profile = cleanProfile({}); this.status = 'expired'; this.emit();
  }
}
