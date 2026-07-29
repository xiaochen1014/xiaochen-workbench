/* ============================================================
   小陈的工作台 — 全局存储与工具
   ============================================================ */
(function () {
  const WB = (window.WB = window.WB || {});

  const STORE_KEY = 'xc_workbench_v1';

  // ---------- 数据层（localStorage 持久化，全部为本地私有数据） ----------
  const store = {
    _data: null,
    load() {
      if (this._data) return this._data;
      let d = {};
      try { d = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { d = {}; }
      // 默认值
      d.exam = d.exam || { exams: [], dailyTasks: [], dailyLog: {}, records: [] };
      d.health = d.health || { sleep: {}, drinks: [], periods: [], periodDays: {}, exercise: [] };
      d.savings = d.savings || [];
      d.travel = d.travel || { attractions: [] };
      d.goals = d.goals || {}; // { '2026': [ {id,text,done,photo,note} ] }
      d.review = d.review || {}; // { '2026-W30': 'reflection text' }
      this._data = d;
      return d;
    },
    save() {
      this.load();
      localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
      window.dispatchEvent(new CustomEvent('wb:update'));
    },
    get() { return this.load(); },
    reset() {
      this._data = null;
      localStorage.removeItem(STORE_KEY);
    },
    export() { return JSON.stringify(this.load(), null, 2); },
    import(json) {
      const d = JSON.parse(json);
      this._data = d;
      this.save();
    },
  };
  WB.store = store;

  // ---------- 工具 ----------
  const util = {
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

    today() {
      const d = new Date();
      return this.fmt(d);
    },
    fmt(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    },
    // 解析 "YYYY-MM-DD" 为本地 Date
    parseDate(s) {
      if (!s) return null;
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    },
    // 周几（0=周日）
    dow(d) { return d.getDay(); },
    // 返回某日期所在周的周一
    mondayOf(dateStr) {
      const d = this.parseDate(dateStr) || new Date();
      const day = (d.getDay() + 6) % 7; // 周一=0
      d.setDate(d.getDate() - day);
      return this.fmt(d);
    },
    // 在某个 YYYY-MM-DD 上加 n 天
    addDays(dateStr, n) {
      const d = this.parseDate(dateStr);
      d.setDate(d.getDate() + n);
      return this.fmt(d);
    },
    // 年-周 标签
    weekKey(mondayStr) {
      const d = this.parseDate(mondayStr);
      const year = d.getFullYear();
      const oneJan = new Date(year, 0, 1);
      const week = Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
      return `${year}-W${week}`;
    },
    // 睡眠颜色判定：十二点(午夜)前睡=绿，十二点~十二点半=浅绿，十二点半后=红
    // 约定用户输入真实钟点：23:30 表示 23:30 入睡(午夜前)→绿；00:15→浅绿；01:00→红
    sleepClass(time) {
      if (!time) return '';
      const [h, m] = time.split(':').map(Number);
      if (h === 0) return m <= 30 ? 'lgreen' : 'red'; // 00:00~00:30 浅绿，之后红
      if (h >= 1 && h <= 11) return 'red';            // 凌晨均算 12:30 后
      return 'green';                                 // 12:00~23:59 视为午夜前
    },
    sleepBadge(time) {
      const c = this.sleepClass(time);
      if (c === 'green') return { cls: 'green', text: '优（12点前）' };
      if (c === 'lgreen') return { cls: 'lgreen', text: '良（12-12:30）' };
      if (c === 'red') return { cls: 'red', text: '差（12:30后）' };
      return { cls: 'gray', text: '未记录' };
    },
    escape(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },
    // 图片压缩：读取文件 -> 压缩为 800px 宽 JPEG -> dataURL
    compressImage(file, maxW = 800, quality = 0.72) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            let { width, height } = img;
            if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.onerror = reject;
          img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },
    toast(msg) {
      const el = document.getElementById('toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(this._t);
      this._t = setTimeout(() => el.classList.remove('show'), 1800);
    },
    // 通用弹窗：返回 { overlay, close, body }
    openModal(title, bodyHtml) {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML =
        `<div class="modal">
           <div class="modal-head"><span>${this.escape(title)}</span><button class="modal-x" type="button">×</button></div>
           <div class="modal-body">${bodyHtml}</div>
         </div>`;
      document.body.appendChild(overlay);
      const close = () => overlay.remove();
      overlay.querySelector('.modal-x').onclick = close;
      overlay.onclick = (e) => { if (e.target === overlay) close(); };
      return { overlay, close, body: overlay.querySelector('.modal-body') };
    },
  };
  WB.util = util;
})();
