/**
 * 播放器面板样式 —— 从 PlayerPanel.tsx 拆分。
 */

export const CSS = `
.dshm-panel {
  position: fixed; right: 18px; bottom: 70px; z-index: 2147483000;
  width: 340px; max-height: calc(100vh - 100px);
  display: flex; flex-direction: column;
  border-radius: 16px; overflow: hidden;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(15,17,27,.88);
  backdrop-filter: blur(18px) saturate(1.35);
  color: #eef1ff; font-size: 13px;
  box-shadow: 0 16px 48px rgba(0,0,0,.5);
  font-family: inherit;
}
.dshm-head { display:flex; align-items:center; gap:8px; padding:12px 14px 8px; }
.dshm-logo { color:#7c5cff; font-size:16px; }
.dshm-title { font-weight:700; letter-spacing:.5px; flex:1; }
.dshm-x { background:none; border:none; color:#9aa3c7; font-size:18px; cursor:pointer; }
.dshm-tabs { display:flex; gap:4px; padding:0 14px; border-bottom:1px solid rgba(255,255,255,.08); }
.dshm-tab { background:none; border:none; color:#9aa3c7; padding:6px 10px; cursor:pointer; font-size:12px; border-radius:8px 8px 0 0; }
.dshm-tab-on { color:#fff; background:rgba(124,92,255,.22); }
.dshm-body { flex:1; overflow-y:auto; padding:10px 12px; display:flex; flex-direction:column; gap:8px; scrollbar-width:thin; }
.dshm-search-row { display:flex; gap:6px; }
.dshm-input { flex:1; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); border-radius:10px; padding:7px 10px; color:#fff; outline:none; font-size:13px; }
.dshm-input:focus { border-color:#7c5cff; }
.dshm-go { width:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#7c5cff,#38bdf8); color:#fff; cursor:pointer; font-weight:700; }
.dshm-list { display:flex; flex-direction:column; gap:2px; }
.dshm-item { display:flex; align-items:center; gap:4px; border-radius:10px; }
.dshm-item:hover { background:rgba(255,255,255,.06); }
.dshm-item-active .dshm-item-name { color:#8be9fd; }
.dshm-item-main { flex:1; display:flex; align-items:center; gap:8px; padding:6px 8px; background:none; border:none; color:inherit; text-align:left; cursor:pointer; min-width:0; }
.dshm-badge { flex:none; width:18px; height:18px; border-radius:5px; font-size:11px; display:flex; align-items:center; justify-content:center; color:#fff; }
.dshm-badge-netease { background:#ec4141; }
.dshm-badge-qq { background:#31c27c; }
.dshm-item-texts { flex:1; min-width:0; display:flex; flex-direction:column; }
.dshm-item-name { font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dshm-item-sub { font-size:11px; color:#9aa3c7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dshm-vip { font-style:normal; margin-left:6px; font-size:9px; padding:1px 4px; border-radius:4px; background:linear-gradient(135deg,#f5a623,#f76b1c); color:#fff; vertical-align:1px; }
.dshm-dur { font-size:11px; color:#9aa3c7; }
.dshm-icon { background:none; border:none; color:#9aa3c7; cursor:pointer; font-size:12px; padding:4px 6px; border-radius:8px; }
.dshm-icon:hover { color:#fff; background:rgba(255,255,255,.08); }
.dshm-empty { text-align:center; color:#9aa3c7; font-size:12px; padding:26px 0; line-height:1.9; }
.dshm-err { font-size:11.5px; color:#ff9b9b; padding:4px 2px; }
.dshm-note { font-size:11.5px; color:#8be9fd; }
.dshm-playall-row { display:flex; gap:6px; }
.dshm-mini { background:none; border:1px solid rgba(255,255,255,.16); color:#cdd4f5; border-radius:8px; padding:3px 10px; cursor:pointer; font-size:11.5px; }
.dshm-mini:hover { border-color:#7c5cff; color:#fff; }
.dshm-now { border-top:1px solid rgba(255,255,255,.09); padding:10px 14px 12px; background:rgba(10,11,20,.55); }
.dshm-now-top { display:flex; align-items:center; gap:10px; }
.dshm-cover { width:40px; height:40px; border-radius:9px; object-fit:cover; }
.dshm-cover-empty { display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#7c5cff33,#38bdf833); color:#aab; font-size:18px; }
.dshm-now-meta { flex:1; min-width:0; }
.dshm-now-name { font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dshm-now-sub { font-size:11px; color:#9aa3c7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
.dshm-spin { color:#7c5cff; animation:dshm-rotate 1.2s linear infinite; }
.dshm-karaoke { width:100%; height:34px; display:block; margin-top:4px; }
@keyframes dshm-rotate { to { transform:rotate(360deg); } }
.dshm-range { width:100%; accent-color:#7c5cff; height:4px; cursor:pointer; }
.dshm-times { display:flex; justify-content:space-between; font-size:10.5px; color:#9aa3c7; margin:-2px 0 2px; }
.dshm-controls { display:flex; align-items:center; gap:6px; }
.dshm-playbtn { width:36px; height:36px; border:none; border-radius:50%; background:linear-gradient(135deg,#7c5cff,#38bdf8); color:#fff; font-size:14px; cursor:pointer; }
.dshm-vol { flex:1; }
.dshm-auth { display:flex; flex-direction:column; gap:14px; }
.dshm-auth-block { display:flex; flex-direction:column; gap:8px; }
.dshm-auth-name { display:flex; align-items:center; gap:8px; font-weight:600; font-size:12.5px; }
.dshm-chip { font-style:normal; font-size:10.5px; padding:2px 8px; border-radius:999px; background:rgba(255,255,255,.08); color:#9aa3c7; font-weight:400; }
.dshm-chip-ok { background:rgba(110,231,168,.16); color:#6ee7a8; }
.dshm-qr { display:flex; flex-direction:column; align-items:center; gap:6px; }
.dshm-qr img { border-radius:10px; background:#fff; padding:6px; }
.dshm-textarea { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:10px; color:#cdd4f5; padding:8px; font-size:11px; resize:vertical; outline:none; }
.dshm-textarea:focus { border-color:#31c27c; }
.dshm-btn { align-self:flex-start; border:none; border-radius:9px; padding:7px 16px; background:linear-gradient(135deg,#7c5cff,#38bdf8); color:#fff; cursor:pointer; font-size:12.5px; }
.dshm-gh { display:flex; align-items:center; color:#9aa3c7; }
.dshm-gh:hover { color:#fff; }
.dshm-gear-on { color:#7c5cff !important; transform:rotate(45deg); }
.dshm-x { transition:transform .15s ease, color .15s ease; }
.dshm-settings { display:flex; flex-direction:column; gap:10px; padding-bottom:6px; }
.dshm-set-title { font-weight:700; font-size:12.5px; display:flex; align-items:center; gap:8px; margin-top:4px; }
.dshm-set-state { font-weight:400; font-size:11px; color:#9aa3c7; }
.dshm-select { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); border-radius:8px; color:#eef1ff; padding:5px 8px; font-size:12px; outline:none; }
.dshm-select option { color:#111; }
.dshm-num { width:70px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); border-radius:8px; color:#eef1ff; padding:5px 8px; font-size:12px; outline:none; }
.dshm-check-row { display:flex; align-items:center; gap:8px; font-size:12.5px; cursor:pointer; }
.dshm-check-row input { accent-color:#7c5cff; }
.dshm-set-row { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12.5px; }
.dshm-note-ok { color:#6ee7a8; }
.dshm-heart { background:none; border:none; cursor:pointer; font-size:13px; padding:4px 4px; color:#5b6488; }
.dshm-heart:hover { color:#ff6b81; }
.dshm-heart-on { color:#ff5c74 !important; }
.dshm-history { display:flex; flex-wrap:wrap; gap:4px; }
.dshm-chip-hist { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); border-radius:999px; color:#cdd4f5; font-size:11px; padding:3px 9px; cursor:pointer; }
.dshm-chip-hist:hover { border-color:#7c5cff; color:#fff; }
.dshm-chip-on { background:rgba(124,92,255,.28); border-color:#7c5cff; color:#fff; }
.dshm-chip-clear { opacity:.55; }
.dshm-lyrbtn { flex:none; width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,.2); background:none; color:#9aa3c7; font-size:11px; cursor:pointer; }
.dshm-lyrbtn-on { color:#fff; border-color:#38bdf8; background:rgba(56,189,248,.18); }
.dshm-karaoke-off { height:auto; padding:2px 0 4px; }
.dshm-libchips { display:flex; flex-wrap:wrap; gap:4px; }
.dshm-newlist { display:flex; gap:4px; align-items:center; margin-left:auto; }
.dshm-lucky { width:100%; border:1px solid rgba(124,92,255,.45); border-radius:10px; padding:8px 0; background:linear-gradient(135deg,rgba(124,92,255,.22),rgba(56,189,248,.18)); color:#eef1ff; font-size:13px; cursor:pointer; letter-spacing:.5px; }
.dshm-lucky:hover { filter:brightness(1.2); }
.dshm-lucky:disabled { opacity:.55; cursor:default; }
.dshm-file-hidden { display:none; }
.dshm-sec-head { display:flex; align-items:center; gap:6px; }
.dshm-alarm-list { display:flex; flex-direction:column; gap:2px; }
.dshm-alarm-row { display:flex; align-items:center; gap:8px; font-size:12px; padding:2px 0; }
.dshm-alarm-time { color:#8be9fd; font-weight:600; min-width:38px; }
.dshm-alarm-kw { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#cdd4f5; }
`