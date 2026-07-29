/* ============================================================
   健康生活：睡眠 / 奶茶咖啡 / 月经 / 锻炼
   每个模块都有可点击的日历，点日期弹窗录入；下方含统计与记录
   ============================================================ */
(function () {
  const WB = window.WB;
  const { store, util } = WB;
  const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

  const state = { tab: 'sleep', month: util.today().slice(0, 7) };

  function monthMeta(ym) {
    const [y, m] = ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const startDow = (first.getDay() + 6) % 7;
    const days = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    return cells;
  }

  function weekDates() {
    const m = util.mondayOf(util.today());
    return Array.from({ length: 7 }, (_, i) => util.addDays(m, i));
  }
  function monthDates(ym) {
    return monthMeta(ym).filter(Boolean);
  }

  // 日期区间内的匹配计数
  function inRange(arr, dates, pred) {
    const set = new Set(dates);
    return arr.filter((x) => set.has(x.date) && (!pred || pred(x))).length;
  }

  // 月经经期：把连续的 periodDays 合并为一次经期
  function periodEpisodes(pd) {
    const dates = Object.keys(pd).sort();
    const eps = []; let cur = null;
    for (const dt of dates) {
      if (cur && util.addDays(cur.end, 1) === dt) cur.end = dt;
      else { cur = { start: dt, end: dt }; eps.push(cur); }
    }
    return eps;
  }

  // 渲染一个月份日历，decorate(dateStr) -> {cls, t, emoji}
  function calendar(decorate, onClick) {
    const cells = monthMeta(state.month);
    const body = cells.map((ds) => {
      if (!ds) return `<div class="cal-cell empty"></div>`;
      const dec = decorate(ds) || {};
      const cls = ['cal-cell', dec.cls || ''].join(' ').trim();
      return `<div class="${cls}" data-day="${ds}" style="position:relative">
        <div class="d">${Number(ds.slice(8))}</div>
        <div class="t">${dec.t || ''}</div>
        ${dec.emoji ? `<div class="cell-emoji">${dec.emoji}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="cal">
      ${WEEK.map((w) => `<div class="cal-head">${w}</div>`).join('')}
      ${body}
    </div>`;
  }

  function monthNav() {
    const [sy, sm] = state.month.split('-').map(Number);
    const prev = sm === 1 ? `${sy - 1}-12` : `${sy}-${String(sm - 1).padStart(2, '0')}`;
    const next = sm === 12 ? `${sy + 1}-01` : `${sy}-${String(sm + 1).padStart(2, '0')}`;
    return `<div class="flex" style="margin-bottom:10px">
      <button class="btn ghost sm" data-mprev="${prev}">‹</button>
      <span class="pill" style="font-size:13px">${state.month}</span>
      <button class="btn ghost sm" data-mnext="${next}">›</button>
      <span class="spacer"></span>
      <button class="btn ghost sm" data-mtoday>回到本月</button>
    </div>`;
  }

  // ---------- 睡眠 ----------
  function sleepDecorate(ds) {
    const t = store.get().health.sleep[ds];
    if (!t) return null;
    return { cls: util.sleepClass(t), t };
  }
  function openSleepModal(date) {
    const cur = store.get().health.sleep[date] || '';
    const m = util.openModal(`记录入睡时间 · ${date}`, `
      <label>日期</label><input type="date" value="${date}" disabled>
      <label>入睡时间</label><input type="time" id="m-sleep-time" value="${cur}">
      <div class="legend" style="margin:12px 0">
        <span><i style="background:var(--green)"></i>12点前（优）</span>
        <span><i style="background:var(--lgreen)"></i>12:00-12:30（良）</span>
        <span><i style="background:var(--red)"></i>12:30后（差）</span>
      </div>
      <div class="form-row">
        <button class="btn" id="m-sleep-save" style="flex:2">保存</button>
        <button class="btn ghost" id="m-sleep-clear" style="flex:1">清除</button>
      </div>`);
    m.body.querySelector('#m-sleep-save').onclick = () => {
      const t = m.body.querySelector('#m-sleep-time').value;
      if (!t) return util.toast('请填写入睡时间');
      store.get().health.sleep[date] = t; store.save(); m.close(); render(container);
    };
    m.body.querySelector('#m-sleep-clear').onclick = () => {
      delete store.get().health.sleep[date]; store.save(); m.close(); render(container);
    };
  }

  // ---------- 奶茶 / 咖啡 ----------
  function drinkDecorate(ds) {
    const list = store.get().health.drinks.filter((x) => x.date === ds);
    if (!list.length) return null;
    const tea = list.some((x) => (x.type || 'milktea') === 'milktea');
    const cof = list.some((x) => x.type === 'coffee');
    let emoji = '';
    if (tea && cof) emoji = '🧋☕';
    else if (tea) emoji = '🧋';
    else emoji = '☕';
    return { cls: 'dk', t: list.length + '杯', emoji };
  }
  function openDrinkModal(date) {
    const d = store.get();
    const listRows = d.health.drinks.filter((x) => x.date === date).map((x) => `
      <div class="row" style="padding:6px 8px">
        <div class="grow"><div class="title" style="font-size:13px">${(x.type === 'coffee' ? '☕' : '🧋')} ${util.escape(x.brand || '')} ${util.escape(x.name)}</div>
        <div class="meta">${util.escape(x.time || '')}</div></div>
        <button class="btn ghost sm" data-dkdel="${x.id}">删</button>
      </div>`).join('') || '<div class="muted">当天还没有记录</div>';
    const m = util.openModal(`记录奶茶 / 咖啡 · ${date}`, `
      <div class="form-row">
        <div style="flex:1"><label>类型</label>
          <select id="m-dk-type"><option value="milktea">奶茶</option><option value="coffee">咖啡</option></select></div>
        <div style="flex:1"><label>时间</label><input type="time" id="m-dk-time"></div>
      </div>
      <label>品牌</label><input type="text" id="m-dk-brand" placeholder="如：喜茶 / 瑞幸 / 星巴克">
      <label>名称</label><input type="text" id="m-dk-name" placeholder="如：多肉葡萄 / 生椰拿铁">
      <button class="btn" id="m-dk-save" style="margin-top:12px;width:100%">添加这一杯</button>
      <div class="divider"></div>
      <div class="muted">当天已记录：</div>
      <div id="m-dk-list" style="margin-top:6px">${listRows}</div>`);
    const save = () => {
      const type = m.body.querySelector('#m-dk-type').value;
      const brand = m.body.querySelector('#m-dk-brand').value.trim();
      const name = m.body.querySelector('#m-dk-name').value.trim();
      const time = m.body.querySelector('#m-dk-time').value;
      if (!name) return util.toast('请填写名称');
      d.health.drinks.push({ id: util.uid(), date, type, brand, name, time });
      store.save(); m.close(); render(container);
    };
    m.body.querySelector('#m-dk-save').onclick = save;
    m.body.querySelectorAll('[data-dkdel]').forEach((b) => b.onclick = () => {
      d.health.drinks = d.health.drinks.filter((x) => x.id !== b.dataset.dkdel);
      store.save(); m.close(); openDrinkModal(date);
    });
  }

  // ---------- 月经 ----------
  function periodDecorate(ds) {
    const rec = store.get().health.periodDays[ds];
    if (!rec) return null;
    const map = { light: 'p1', mid: 'p2', heavy: 'p3' };
    return { cls: map[rec.flow] || 'p2', emoji: rec.cramp ? '😣' : '' };
  }
  function openPeriodModal(date) {
    const d = store.get();
    const rec = d.health.periodDays[date] || {};
    const m = util.openModal(`记录经期 · ${date}`, `
      <label>流量</label>
      <div class="form-row">
        <label style="flex:1"><input type="radio" name="flow" value="light" ${rec.flow === 'light' ? 'checked' : ''}> 量少（浅红）</label>
        <label style="flex:1"><input type="radio" name="flow" value="mid" ${rec.flow === 'mid' || !rec.flow ? 'checked' : ''}> 适中（正红）</label>
        <label style="flex:1"><input type="radio" name="flow" value="heavy" ${rec.flow === 'heavy' ? 'checked' : ''}> 量多（深红）</label>
      </div>
      <label style="margin-top:12px">是否痛经</label>
      <label style="display:flex;align-items:center;gap:8px;font-weight:500">
        <input type="checkbox" class="chk" id="m-pd-cramp" ${rec.cramp ? 'checked' : ''}> 痛经（当天显示 😣）
      </label>
      <div class="form-row" style="margin-top:14px">
        <button class="btn" id="m-pd-save" style="flex:2">保存</button>
        <button class="btn ghost" id="m-pd-clear" style="flex:1">清除</button>
      </div>`);
    m.body.querySelector('#m-pd-save').onclick = () => {
      const flow = m.body.querySelector('input[name=flow]:checked').value;
      const cramp = m.body.querySelector('#m-pd-cramp').checked;
      d.health.periodDays[date] = { flow, cramp };
      store.save(); m.close(); render(container);
    };
    m.body.querySelector('#m-pd-clear').onclick = () => {
      delete d.health.periodDays[date]; store.save(); m.close(); render(container);
    };
  }

  // ---------- 锻炼 ----------
  function exerciseDecorate(ds) {
    const list = store.get().health.exercise.filter((x) => x.date === ds);
    if (!list.length) return null;
    return { cls: 'ex', t: '🏃' + (list.length > 1 ? list.length : '') };
  }
  function openExerciseModal(date) {
    const d = store.get();
    const listRows = d.health.exercise.filter((x) => x.date === date).map((x) => `
      <div class="row" style="padding:6px 8px">
        <div class="grow"><div class="title" style="font-size:13px">${util.escape(x.type)}</div></div>
        <button class="btn ghost sm" data-exdel="${x.id}">删</button>
      </div>`).join('') || '<div class="muted">当天还没有记录</div>';
    const m = util.openModal(`记录锻炼 · ${date}`, `
      <label>锻炼内容</label><input type="text" id="m-ex-type" placeholder="如：跑步5km / 瑜伽30min">
      <button class="btn" id="m-ex-save" style="margin-top:12px;width:100%">添加</button>
      <div class="divider"></div>
      <div class="muted">当天已记录：</div>
      <div id="m-ex-list" style="margin-top:6px">${listRows}</div>`);
    m.body.querySelector('#m-ex-save').onclick = () => {
      const type = m.body.querySelector('#m-ex-type').value.trim();
      if (!type) return util.toast('请填写锻炼内容');
      d.health.exercise.push({ id: util.uid(), date, type });
      store.save(); m.close(); render(container);
    };
    m.body.querySelectorAll('[data-exdel]').forEach((b) => b.onclick = () => {
      d.health.exercise = d.health.exercise.filter((x) => x.id !== b.dataset.exdel);
      store.save(); m.close(); openExerciseModal(date);
    });
  }

  // ---------- 主渲染 ----------
  let container;
  function render(c) {
    container = c;
    const d = store.get();
    const h = d.health;

    // 统计
    const wd = weekDates(), md = monthDates(state.month);
    const teaW = inRange(h.drinks, wd, (x) => (x.type || 'milktea') === 'milktea');
    const cofW = inRange(h.drinks, wd, (x) => x.type === 'coffee');
    const teaM = inRange(h.drinks, md, (x) => (x.type || 'milktea') === 'milktea');
    const cofM = inRange(h.drinks, md, (x) => x.type === 'coffee');
    const exM = inRange(h.exercise, md);
    const sleepGood = md.filter((ds) => util.sleepClass(h.sleep[ds]) === 'green').length;
    const sleepBad = md.filter((ds) => util.sleepClass(h.sleep[ds]) === 'red').length;

    // 经期记录（按年月分组）
    const eps = periodEpisodes(h.periodDays);
    const byMonth = {};
    eps.forEach((e) => {
      const key = e.start.slice(0, 7);
      (byMonth[key] = byMonth[key] || []).push(e);
    });
    const episodeHtml = eps.length
      ? Object.keys(byMonth).sort().reverse().map((k) => {
          const [y, m] = k.split('-');
          const items = byMonth[k].map((e) => {
            const n = Math.round((util.parseDate(e.end) - util.parseDate(e.start)) / 86400000) + 1;
            return `<div class="episode">${y}年${Number(m)}月：${e.start} → ${e.end}（共 ${n} 天）</div>`;
          }).join('');
          return items;
        }).join('')
      : '<div class="muted">还没有经期记录</div>';

    const panels = {
      sleep: `
        <div class="card">
          <h3><span class="dot"></span>睡眠日历</h3>
          <div class="muted" style="margin-bottom:6px">点击任意日期记录 / 修改入睡时间</div>
          ${monthNav()}
          ${calendar(sleepDecorate)}
          <div class="legend">
            <span><i style="background:var(--green)"></i>12点前（优）</span>
            <span><i style="background:var(--lgreen)"></i>12:00-12:30（良）</span>
            <span><i style="background:var(--red)"></i>12:30后（差）</span>
          </div>
          <div class="summary-line">
            <span class="chip">本月早睡(优) <b>${sleepGood}</b> 天</span>
            <span class="chip">本月熬夜(差) <b>${sleepBad}</b> 天</span>
          </div>
        </div>`,
      drink: `
        <div class="card">
          <h3><span class="dot"></span>奶茶 / 咖啡 日历</h3>
          <div class="muted" style="margin-bottom:6px">点击日期 → 选择奶茶或咖啡，填品牌/名称/时间</div>
          ${monthNav()}
          ${calendar(drinkDecorate)}
          <div class="legend"><span><i style="background:#f6ece0;border:1px solid #e2cdb4"></i>当天有记录（🧋奶茶 ☕咖啡）</span></div>
          <div class="summary-line">
            <span class="chip">本周奶茶 <b>${teaW}</b> 杯</span>
            <span class="chip">本周咖啡 <b>${cofW}</b> 杯</span>
            <span class="chip">本月(${state.month})奶茶 <b>${teaM}</b> 杯</span>
            <span class="chip">本月咖啡 <b>${cofM}</b> 杯</span>
          </div>
        </div>`,
      period: `
        <div class="card">
          <h3><span class="dot"></span>经期日历</h3>
          <div class="muted" style="margin-bottom:6px">点击日期记录流量与是否痛经</div>
          ${monthNav()}
          ${calendar(periodDecorate)}
          <div class="legend">
            <span><i style="background:#f9c9c2"></i>量少</span>
            <span><i style="background:#ef6b5e"></i>适中</span>
            <span><i style="background:#b83227"></i>量多</span>
            <span>😣 痛经</span>
          </div>
          <div class="divider"></div>
          <h3 style="font-size:14px"><span class="dot" style="background:var(--red)"></span>每次经期记录</h3>
          <div class="episode-list">${episodeHtml}</div>
        </div>`,
      exercise: `
        <div class="card">
          <h3><span class="dot"></span>锻炼日历</h3>
          <div class="muted" style="margin-bottom:6px">点击日期添加锻炼，有锻炼的日子变黄</div>
          ${monthNav()}
          ${calendar(exerciseDecorate)}
          <div class="legend"><span><i style="background:#fff3bf;border:1px solid #f2cd3a"></i>当天有锻炼</span></div>
          <div class="summary-line"><span class="chip">本月锻炼 <b>${exM}</b> 次</span></div>
        </div>`,
    };

    c.innerHTML = `
      <div class="tabs" id="health-tabs">
        <button class="tab ${state.tab === 'sleep' ? 'active' : ''}" data-tab="sleep">😴 睡眠</button>
        <button class="tab ${state.tab === 'drink' ? 'active' : ''}" data-tab="drink">🧋 奶茶咖啡</button>
        <button class="tab ${state.tab === 'period' ? 'active' : ''}" data-tab="period">🌸 月经</button>
        <button class="tab ${state.tab === 'exercise' ? 'active' : ''}" data-tab="exercise">🏃 锻炼</button>
      </div>
      ${panels[state.tab]}
    `;

    const $ = (s) => c.querySelector(s);
    const $$ = (s) => c.querySelectorAll(s);

    $$('#health-tabs .tab').forEach((t) => t.onclick = () => { state.tab = t.dataset.tab; render(c); });

    $$('[data-mprev]').forEach((b) => b.onclick = () => { state.month = b.dataset.mprev; render(c); });
    $$('[data-mnext]').forEach((b) => b.onclick = () => { state.month = b.dataset.mnext; render(c); });
    const mt = $('[data-mtoday]'); if (mt) mt.onclick = () => { state.month = util.today().slice(0, 7); render(c); };

    // 日历点击 -> 弹窗
    $$('.cal-cell[data-day]').forEach((cell) => {
      cell.onclick = () => {
        const ds = cell.dataset.day;
        if (state.tab === 'sleep') openSleepModal(ds);
        else if (state.tab === 'drink') openDrinkModal(ds);
        else if (state.tab === 'period') openPeriodModal(ds);
        else if (state.tab === 'exercise') openExerciseModal(ds);
      };
    });
  }

  WB.sections = WB.sections || {};
  WB.sections.health = { title: '健康生活', render };
})();
