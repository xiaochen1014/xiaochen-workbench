/* ============================================================
   存钱计划
   ============================================================ */
(function () {
  const WB = window.WB;
  const { store, util } = WB;

  function render(container) {
    const d = store.get();
    const list = d.savings;

    const cards = list.length
      ? list.map((g) => {
          const saved = g.saved || 0;
          const pct = g.target > 0 ? Math.min(100, Math.round((saved / g.target) * 100)) : 0;
          const left = Math.max(0, g.target - saved);
          const done = saved >= g.target && g.target > 0;
          const today = util.today();
          let dl = '';
          if (g.deadline) {
            const diff = Math.round((util.parseDate(g.deadline) - util.parseDate(today)) / 86400000);
            dl = diff >= 0
              ? `<span class="badge ${diff <= 30 ? 'amber' : 'gray'}">还剩 ${diff} 天</span>`
              : `<span class="badge red">已过期</span>`;
          }
          return `
          <div class="card">
            <div class="section-head">
              <h3 style="margin:0"><span class="dot" style="background:${done ? 'var(--green)' : 'var(--brand)'}"></span>${util.escape(g.name)}</h3>
              ${done ? '<span class="badge green">已达成 🎉</span>' : dl}
            </div>
            <div class="flex wrap" style="margin:6px 0 10px">
              <div class="grow">已存 <b>¥${saved}</b> / 目标 ¥${g.target}</div>
              <div class="muted">${util.escape(g.deadline || '无截止日期')}</div>
            </div>
            <div class="progress ${done ? 'done' : ''}"><span style="width:${pct}%"></span></div>
            <div class="muted" style="margin-top:6px">进度 ${pct}% · 还差 ¥${left}</div>
            <div class="form-row" style="margin-top:12px">
              <div style="flex:2"><input type="number" min="0" step="1" placeholder="存入金额" data-save-input="${g.id}"></div>
              <button class="btn sm" data-save-add="${g.id}">存入</button>
              <button class="btn ghost sm" data-reset="${g.id}">清零</button>
              <button class="btn danger sm" data-del="${g.id}">删除</button>
            </div>
          </div>`;
        }).join('')
      : `<div class="card"><div class="empty">还没有存钱目标，在右侧添加第一个吧～</div></div>`;

    container.innerHTML = `
      <div class="grid grid-2">
        <div>${cards}</div>
        <div class="card" style="align-self:start">
          <h3><span class="dot"></span>新增存钱目标</h3>
          <label>目标名称（存钱目的）</label>
          <input type="text" id="sv-name" placeholder="例如：旅行基金 / 新电脑 / 应急金">
          <label>目标金额（¥）</label>
          <input type="number" id="sv-target" min="0" step="1" placeholder="10000">
          <label>什么时候需要用</label>
          <input type="date" id="sv-deadline">
          <button class="btn" id="sv-add" style="margin-top:14px;width:100%">添加目标</button>
          <div class="muted" style="margin-top:12px">提示：可随时点击「存入」追加金额，进度条会自动更新。</div>
        </div>
      </div>
    `;

    const $ = (s) => container.querySelector(s);
    const $$ = (s) => container.querySelectorAll(s);

    $('#sv-add').onclick = () => {
      const name = $('#sv-name').value.trim();
      const target = Number($('#sv-target').value);
      if (!name) return util.toast('请填写目标名称');
      if (!(target > 0)) return util.toast('请填写有效的目标金额');
      list.push({ id: util.uid(), name, target, deadline: $('#sv-deadline').value, saved: 0 });
      store.save(); util.toast('已添加目标'); render(container);
    };

    $$('[data-save-add]').forEach((b) => b.onclick = () => {
      const g = list.find((x) => x.id === b.dataset.saveAdd);
      const inp = container.querySelector(`[data-save-input="${g.id}"]`);
      const amt = Number(inp.value);
      if (!(amt > 0)) return util.toast('请输入存入金额');
      g.saved = (g.saved || 0) + amt;
      store.save(); util.toast('已存入'); render(container);
    });
    $$('[data-reset]').forEach((b) => b.onclick = () => {
      const g = list.find((x) => x.id === b.dataset.reset); g.saved = 0; store.save(); render(container);
    });
    $$('[data-del]').forEach((b) => b.onclick = () => {
      if (!confirm('确定删除该存钱目标？')) return;
      d.savings = d.savings.filter((x) => x.id !== b.dataset.del); store.save(); render(container);
    });
  }

  WB.sections = WB.sections || {};
  WB.sections.savings = { title: '存钱计划', render };
})();
