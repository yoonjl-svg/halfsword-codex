import { GROWTH_APP, emptyGrowth, checkedGrowth } from './growth-model.js';

export class GrowthController {
  constructor({ rpc, storage, onChange = () => {}, uuid = () => crypto.randomUUID() }) {
    this.rpc = rpc; this.storage = storage; this.onChange = onChange; this.uuid = uuid;
    this.identity = null; this.epoch = 0; this.state = emptyGrowth(); this.ready = false; this.running = false; this.status = '계정 연결 중'; this.error = ''; this.round = null;
    this.roundTail = Promise.resolve(); this.flushing = null;
  }
  prefix() { return `stillness-growth:v1:${GROWTH_APP}:${this.identity}:`; }
  emit() { this.onChange({ state: structuredClone(this.state), ready: this.ready, busy: this.running, status: this.status, error: this.error, identity: this.identity }); }
  pending() {
    const rows = []; const prefix = this.prefix() + 'pending:';
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(prefix)) { const value = JSON.parse(this.storage.getItem(key)); if (value) rows.push({ key, ...value }); }
    }
    return rows.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
  }
  accept(snapshot) {
    const value = checkedGrowth(snapshot);
    if (value.revision >= this.state.revision) this.state = value;
    this.storage.setItem(this.prefix() + 'snapshot', JSON.stringify(this.state));
  }
  async identify(identity) {
    if (identity === this.identity) return;
    clearTimeout(this.retryTimer);
    this.identity = identity; const epoch = ++this.epoch; this.ready = false; this.running = false; this.round = null; this.state = emptyGrowth(); this.error = ''; this.status = identity ? '성장 기록 불러오는 중' : '계정 연결 필요'; this.emit();
    this.roundTail = Promise.resolve(); this.flushing = null;
    if (!identity) return;
    try {
      const cached = this.storage.getItem(this.prefix() + 'snapshot');
      if (cached) this.state = checkedGrowth(JSON.parse(cached));
    } catch { this.error = '기기에 저장된 기록을 읽지 못했습니다.'; }
    this.emit();
    try {
      const state = await this.rpc('snapshot', { p_app_id: GROWTH_APP }, identity);
      if (epoch !== this.epoch) return;
      this.accept(state); this.ready = true; this.status = '저장됨'; this.emit(); await this.flush();
    } catch { if (epoch === this.epoch) { this.status = '연결 대기 · 성장 변경 보류'; this.emit(); } }
  }
  async refresh() {
    if (!this.identity || this.running) return;
    const epoch = this.epoch;
    try {
      const state = await this.rpc('snapshot', { p_app_id: GROWTH_APP }, this.identity);
      if (epoch !== this.epoch) return;
      this.accept(state); this.ready = true; this.status = '저장됨'; this.error = ''; this.emit(); await this.flush();
    } catch { if (epoch === this.epoch) { this.status = '연결 대기 · 성장 변경 보류'; this.emit(); } }
  }
  async begin() {
    this.cancel();
    if (!this.identity || !this.ready) { this.status = '이번 판은 연습 · 성장 연결 전'; this.emit(); return; }
    const handle = { epoch: this.epoch, identity: this.identity, active: true, id: this.uuid() }; this.round = handle;
    handle.ticket = this.roundTail.catch(() => {}).then(async () => {
      await this.flush(); // Settle the previous result before replacing the server's active ticket.
      if (!handle.active || handle.epoch !== this.epoch || this.pending().length) return null;
      const result = await this.rpc('begin_round', { p_app_id: GROWTH_APP, p_request_id: handle.id }, handle.identity);
      return result.round_id;
    }).catch(() => null);
    this.roundTail = handle.ticket;
    const roundId = await handle.ticket;
    if (handle.epoch !== this.epoch || !handle.active) return;
    if (!roundId) { this.status = '이번 판은 연습 · 경기 등록 실패'; this.emit(); }
  }
  cancel() { if (this.round) this.round.active = false; this.round = null; }
  async finish(win) {
    const handle = this.round; this.round = null;
    if (!handle?.active) return;
    // Publish the barrier BEFORE awaiting registration: a new fight cannot abandon
    // a completed fight whose begin response is still in transit.
    const completion = this.roundTail.catch(() => {}).then(async () => {
      const roundId = await handle.ticket;
      handle.active = false;
      if (handle.epoch !== this.epoch || handle.identity !== this.identity) return;
      if (!roundId) { this.status = '경기 등록 전 결과 · 보상 없음'; this.emit(); return; }
      return this.enqueue('finish_round', { p_round_id: roundId, p_win: win }, roundId);
    });
    this.roundTail = completion.catch(() => {});
    return completion;
  }
  enqueue(method, fields, requestId = this.uuid()) {
    if (!this.identity || !this.ready) return Promise.resolve();
    const args = { p_app_id: GROWTH_APP, ...fields, ...(method === 'finish_round' ? {} : { p_request_id: requestId }) };
    try {
      // One key per operation: concurrent tabs cannot overwrite each other's queue.
      const key = this.prefix() + 'pending:' + requestId;
      const current = this.storage.getItem(key);
      if (current && JSON.stringify(JSON.parse(current).args) !== JSON.stringify(args)) throw Error('Request ID reuse');
      if (!current) this.storage.setItem(key, JSON.stringify({ method, args, at: Date.now() }));
      this.status = '처리 대기'; this.error = ''; this.emit();
    } catch { this.error = '기기 저장에 실패해 요청을 보내지 않았습니다.'; this.emit(); return Promise.resolve(); }
    return this.flush();
  }
  flush() {
    if (this.running) return this.flushing;
    this.flushing = this.runFlush();
    return this.flushing;
  }
  async runFlush() {
    if (this.running || !this.identity || !this.ready) return;
    this.running = true; const epoch = this.epoch; this.emit();
    try {
      for (let count = 0; count < 64; count++) {
        const op = this.pending()[0]; if (!op) break;
        if (epoch !== this.epoch) return;
        try {
          const result = await this.rpc(op.method, op.args, this.identity);
          if (epoch !== this.epoch) return;
          this.accept(result); this.storage.removeItem(op.key); this.status = '저장됨';
        } catch (error) {
          if (epoch !== this.epoch) return;
          if (error.code === 'PT425') {
            this.status = '보상 확인 대기'; clearTimeout(this.retryTimer);
            this.retryTimer = setTimeout(() => { if (epoch === this.epoch) void this.flush(); }, 3500);
            this.retryTimer.unref?.(); break;
          } else if (['PT400', 'PT403', 'PT409', 'PT410'].includes(error.code)) {
            this.storage.removeItem(op.key); this.error = '처리하지 못했습니다. 잔액·보유 상태 또는 허용된 작업을 확인해주세요.';
          } else { this.status = '미전송 기록 보관 중 · 다시 연결'; break; }
        }
      }
    } catch { this.error = '저장 기록을 읽거나 갱신하지 못했습니다.'; }
    finally { if (epoch === this.epoch) { this.running = false; this.emit(); } }
  }
}
