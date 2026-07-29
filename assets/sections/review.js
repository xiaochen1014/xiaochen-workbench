/* ============================================================
   每周复盘 — 表格 + 日历形式呈现本周各项完成情况
   含「饮品与睡眠关联分析」：总结几点喝奶茶/咖啡可能导致睡眠不足
   ============================================================ */
(function () {
  const WB = window.WB;
  const { store, util } = WB;
  const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

  const state = { weekMonday: util.mondayOf(util.today()) };

  function weekDays() {
    const arr = [];
    for (let i = 0; i < 7; i++) arr.push(util.addDays(state.weekMonday, i));
    return arr;
  }

  function monthMatrix(anchor) {
    const [y, m] = anchor.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const startDow = (first.getDay() + 6) % 7;
    const days = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    return { cells, label: anchor.slice(0, 7) };
  }

  // 饮品与睡眠关联分析
  function drinkSleepAnalysis() {
    const d = store.get();
    const sleep = d.health.sleep, drinks = d.health.drinks;
    const dates = [...new Set(drinks.map((x) => x.date))].filter((dt) => sleep[dt]);
    if (!dates.length) {
      return { empty: true, html: '<div class="muted">暂无同时包含「喝奶茶/咖啡」与「睡眠记录」的日期，多记录几天后即可分析。</div>' };
    }
    // 按饮用小时分桶
    const buckets = {};
    const dayRows = dates.map((dt) => {
      const cls = util.sleepClass(sleep[dt]);
      const poor = cls !== 'green'; // 睡眠不足（非12点前）
      const dayDrinks = drinks.filter((x) => x.date === dt);
      dayDrinks.forEach((x) => {
        const h = Number((x.time || '0:0').split(':')[0]);
        const b = (buckets[h] = buckets[h] || { n: 0, poor: 0 });
        b.n++; if (poor) b.poor++;
      });
      return { dt, poor, drinks: dayDrinks };
    });

    // 找出高风险时段（该小时饮用且睡眠不足概率 >= 50%，且样本 >= 2）
    const risk = Object.keys(buckets).map(Number).sort((a, b) => a - b).map((h) => {
      const b = buckets[h];
      return { h, n: b.n, poor: b.poor, rate: Math.round((b.poor / b.n) * 100) };
    }).filter((r) => r.n >= 2 && r.rate >= 50);

    let summary = '';
    if (risk.length) {
      const top = risk[risk.length - 1];
      const list = risk.map((r) => `${r.h}:00`).join('、');
      summary = `数据显示：在 <b>${list}</b> 之后饮用奶茶/咖啡的日子里，有 <span class="warn">${top.rate}%</span> 出现了睡眠不足（入睡晚于 12 点）。建议这类饮品尽量安排在 <b>${risk[0].h}:00</b> 之前。`;
    } else {
      const anyPoor = dayRows.filter((r) => r.poor).length;
      summary = anyPoor
        ? '目前样本里，喝奶茶/咖啡与当晚睡眠不足的关联尚不明显（可能饮用时间较早或样本较少）。继续记录后分析会更准。'
        : '目前有同时记录的日子里，睡眠都还算早，暂未发现饮品导致睡眠不足的明显规律 🎉';
    }

    const tableRows = Object.keys(buckets).map(Number).sort((a, b) => a - b).map((h) => {
      const r = buckets[h];
      const danger = r.n >= 2 && r.rate >= 50;
      return `<tr style="${danger ? 'background:#f0ddd9' : ''}">
        <td>${h}:00 时段</td>
        <td>${r.n} 次</td>
        <td>${r.poor} 次</td>
        <td><b class="${danger ? 'warn' : ''}">${r.rate}%</b></td>
      </tr>`;
    }).join('');

    const dayList = dayRows.map((r) => {
      const times = r.drinks.map((x) => `${(x.type === 'coffee' ? '☕' : '🧋')}${x.time || ''}`).join('、');
      const sleepT = sleep[r.dt];
      const sc = util.sleepClass(sleepT);
      const cls = sc === 'green' ? 'green' : sc === 'lgreen' ? 'lgreen' : 'red';
      const txt = sc === 'green' ? '睡眠优' : sc === 'lgreen' ? '睡眠良' : '睡眠不足';
      return `<div class="episode">${r.dt}：喝 ${times} → <span class="badge ${cls}">${txt}（${sleepT}）</span></div>`;
    }).join('');

    const html = `
      <div class="insight">${summary}</div>
      <div class="divider"></div>
      <h3 style="font-size:14px"><span class="dot" style="background:var(--orange)"></span>按饮用时段统计（睡眠不足率）</h3>
      <table class="tbl">
        <thead><tr><th>饮用时段</th><th>饮用次数</th><th>其中睡眠不足</th><th>不足率</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div class="divider"></div>
      <h3 style="font-size:14px"><span class="dot" style="background:var(--ink-faint)"></span>明细（喝饮品当晚的睡眠）</h3>
      <div class="episode-list">${dayList}</div>
    `;
    return { empty: false, html };
  }

  function render(container) {
    const d = store.get();
    const days = weekDays();
    const wk = util.weekKey(state.weekMonday);
    const prev = util.addDays(state.weekMonday, -7);
    const next = util.addDays(state.weekMonday, 7);

    let taskDone = 0, taskTotal = 0, exCount = 0, drinkCount = 0, sleepGood = 0;
    const rows = days.map((date) => {
      const log = d.exam.dailyLog[date];
      const sleepT = d.health.sleep[date];
      const sleepB = util.sleepBadge(sleepT);
      const exN = d.health.exercise.filter((x) => x.date === date).length;
      const drN = d.health.drinks.filter((x) => x.date === date).length;
      const rate = log && log.total ? Math.round((log.done / log.total) * 100) : 0;
      if (log) { taskDone += log.done; taskTotal += log.total; }
      exCount += exN; drinkCount += drN;
      if (sleepB.cls === 'green' || sleepB.cls === 'lgreen') sleepGood++;
      const isToday = date === util.today();
      return `<tr style="${isToday ? 'background:#efe7df' : ''}">
        <td>${date.slice(5)} ${isToday ? '·今' : ''}</td>
        <td>${log ? `${rate}% (${log.done}/${log.total})` : '<span class="muted">—</span>'}</td>
        <td><span class="badge ${sleepB.cls}">${sleepB.text}</span></td>
        <td>${exN ? `<b>${exN}</b> 次` : '<span class="muted">—</span>'}</td>
        <td>${drN ? `<b>${drN}</b> 杯` : '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('');

    const taskRate = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0;

    const mon = monthMatrix(state.weekMonday);
    const calCells = mon.cells.map((ds) => {
      if (!ds) return `<div class="cal-cell empty"></div>`;
      const t = d.health.sleep[ds];
      const cls = t ? util.sleepClass(t) : '';
      const exN = d.health.exercise.filter((x) => x.date === ds).length;
      const drN = d.health.drinks.filter((x) => x.date === ds).length;
      const dots = (exN ? '🏃' : '') + (drN ? '🧋' : '');
      const inWeek = days.includes(ds);
      return `<div class="cal-cell ${cls}" style="${inWeek ? 'outline:2px solid var(--brand);outline-offset:-2px' : ''}">
        <div class="d">${Number(ds.slice(8))}</div>
        <div class="t">${dots}</div>
      </div>`;
    }).join('');

    const reflection = d.review[wk] || '';
    const analysis = drinkSleepAnalysis();

    container.innerHTML = `
      <div class="grid grid-2">
        <div class="card" style="grid-column: span 2">
          <div class="section-head">
            <h3 style="margin:0"><span class="dot"></span>本周复盘 · ${wk}</h3>
            <div class="flex">
              <button class="btn ghost sm" id="wk-prev">‹ 上周</button>
              <button class="btn ghost sm" id="wk-this">本周</button>
              <button class="btn ghost sm" id="wk-next">下周 ›</button>
            </div>
          </div>
          <div class="grid grid-3" style="margin-top:10px">
            <div class="card" style="padding:14px"><div class="muted">任务完成率</div><div class="countdown"><span class="num" style="font-size:30px">${taskRate}%</span></div></div>
            <div class="card" style="padding:14px"><div class="muted">锻炼次数</div><div class="countdown"><span class="num" style="font-size:30px;color:var(--green)">${exCount}</span><span class="unit">次</span></div></div>
            <div class="card" style="padding:14px"><div class="muted">奶茶/咖啡</div><div class="countdown"><span class="num" style="font-size:30px;color:var(--orange)">${drinkCount}</span><span class="unit">杯</span></div></div>
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:18px">
        <div class="card">
          <h3><span class="dot"></span>每日完成情况（表格）</h3>
          <table class="tbl">
            <thead><tr><th>日期</th><th>任务</th><th>睡眠</th><th>锻炼</th><th>奶茶</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="card">
          <h3><span class="dot"></span>本月日历（${mon.label}）</h3>
          <div class="cal">
            ${WEEK.map((w) => `<div class="cal-head">${w}</div>`).join('')}
            ${calCells}
          </div>
          <div class="legend">
            <span><i style="background:var(--green)"></i>睡眠优</span>
            <span><i style="background:var(--lgreen)"></i>睡眠良</span>
            <span><i style="background:var(--red)"></i>睡眠差</span>
            <span>🏃 锻炼 · 🧋 奶茶</span>
            <span><i style="background:#fff;border:2px solid var(--brand)"></i>本周</span>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <h3><span class="dot" style="background:var(--orange)"></span>饮品与睡眠关联分析</h3>
        <div class="card-sub">根据「喝奶茶/咖啡的时间」与「当晚入睡时间」，推断几点喝容易导致睡眠不足</div>
        ${analysis.html}
      </div>

      <div class="card" style="margin-top:18px">
        <h3><span class="dot"></span>本周复盘小结</h3>
        <textarea id="refl" placeholder="记录这周的收获、不足与下周计划…">${util.escape(reflection)}</textarea>
        <button class="btn" id="refl-save" style="margin-top:12px">保存小结</button>
      </div>
    `;

    const $ = (s) => container.querySelector(s);
    $('#wk-prev').onclick = () => { state.weekMonday = prev; render(container); };
    $('#wk-next').onclick = () => { state.weekMonday = next; render(container); };
    $('#wk-this').onclick = () => { state.weekMonday = util.mondayOf(util.today()); render(container); };
    $('#refl-save').onclick = () => {
      d.review[wk] = $('#refl').value;
      store.save(); util.toast('已保存本周小结');
    };
  }

  WB.sections = WB.sections || {};
  WB.sections.review = { title: '每周复盘', render };
})();
