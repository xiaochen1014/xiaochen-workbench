/* ============================================================
   目标 — 按年份划分，分为已完成（可勾选+加照片）与未完成
   ============================================================ */
(function () {
  const WB = window.WB;
  const { store, util } = WB;

  const state = { year: String(new Date().getFullYear()) };

  function years() {
    const d = store.get();
    const ys = Object.keys(d.goals).map(Number).sort((a, b) => b - a);
    const cur = new Date().getFullYear();
    if (!ys.includes(cur)) ys.push(cur);
    return ys.map(String);
  }

  function render(container) {
    const d = store.get();
    if (!d.goals[state.year]) d.goals[state.year] = [];
    const ys = years();
    if (!ys.includes(state.year)) state.year = ys[0];

    const list = d.goals[state.year] || [];
    const todo = list.filter((g) => !g.done);
    const done = list.filter((g) => g.done);

    const todoHtml = todo.length
      ? todo.map((g) => `
        <div class="row">
          <input type="checkbox" class="chk" data-done="${g.id}">
          <div class="grow"><div class="title">${util.escape(g.text)}</div>${g.note ? `<div class="meta">${util.escape(g.note)}</div>` : ''}</div>
          <button class="btn ghost sm" data-del-goal="${g.id}">删除</button>
        </div>`).join('')
      : `<div class="empty">这一年还没有未完成的目标 🎯</div>`;

    const doneHtml = done.length
      ? done.map((g) => `
        <div class="row">
          <input type="checkbox" class="chk" data-undone="${g.id}" checked>
          <div class="grow">
            <div class="title" style="text-decoration:line-through;color:var(--ink-faint)">${util.escape(g.text)}</div>
            ${g.note ? `<div class="meta">${util.escape(g.note)}</div>` : ''}
            ${g.photo ? `<div class="attr-photos"><img class="lg" src="${g.photo}" alt=""></div>` : ''}
          </div>
          <button class="btn ghost sm" data-photo="${g.id}">${g.photo ? '换图' : '加照片'}</button>
          <button class="btn ghost sm" data-del-goal="${g.id}">删除</button>
        </div>`).join('')
      : `<div class="empty">勾选左侧目标即可归入「已完成」并添加照片 📷</div>`;

    container.innerHTML = `
      <div class="tabs" id="goal-tabs">
        ${ys.map((y) => `<button class="tab ${y === state.year ? 'active' : ''}" data-year="${y}">${y} 年</button>`).join('')}
      </div>

      <div class="grid grid-2">
        <div class="card">
          <h3><span class="dot" style="background:var(--ink-faint)"></span>${state.year} 年 · 未完成（${todo.length}）</h3>
          <div class="list">${todoHtml}</div>
        </div>
        <div class="card">
          <h3><span class="dot" style="background:var(--green)"></span>${state.year} 年 · 已完成（${done.length}）</h3>
          <div class="list">${doneHtml}</div>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <h3><span class="dot"></span>添加目标</h3>
        <div class="form-row">
          <div style="flex:0 0 120px"><input type="number" id="goal-year" value="${state.year}" min="2000" max="2100"></div>
          <div style="flex:3"><input type="text" id="goal-text" placeholder="例如：通过考研 / 存够 5 万 / 读完 12 本书"></div>
          <div style="flex:2"><input type="text" id="goal-note" placeholder="备注（可选）"></div>
          <div style="flex:0 0 auto"><button class="btn" id="goal-add">添加</button></div>
        </div>
      </div>
      <input type="file" id="goal-photo-input" accept="image/*" hidden>
    `;

    const $ = (s) => container.querySelector(s);
    const $$ = (s) => container.querySelectorAll(s);

    $$('#goal-tabs .tab').forEach((t) => t.onclick = () => {
      state.year = t.dataset.year; render(container);
    });

    $('#goal-add').onclick = () => {
      const y = $('#goal-year').value.trim();
      const text = $('#goal-text').value.trim();
      if (!y || !text) return util.toast('请填写年份和目标');
      if (!d.goals[y]) d.goals[y] = [];
      d.goals[y].push({ id: util.uid(), text, done: false, note: $('#goal-note').value.trim(), photo: '' });
      store.save(); util.toast('已添加'); render(container);
    };

    $$('[data-done]').forEach((c) => c.onchange = () => {
      const g = list.find((x) => x.id === c.dataset.done); if (g) g.done = true;
      store.save(); render(container);
    });
    $$('[data-undone]').forEach((c) => c.onchange = () => {
      const g = list.find((x) => x.id === c.dataset.undone); if (g) g.done = false;
      store.save(); render(container);
    });
    $$('[data-del-goal]').forEach((b) => b.onclick = () => {
      d.goals[state.year] = list.filter((x) => x.id !== b.dataset.delGoal);
      store.save(); render(container);
    });

    // 照片
    let pendingGoalId = null;
    const photoInput = $('#goal-photo-input');
    $$('[data-photo]').forEach((b) => b.onclick = () => {
      pendingGoalId = b.dataset.photo;
      photoInput.click();
    });
    photoInput.onchange = () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file || !pendingGoalId) { photoInput.value = ''; return; }
      const g = list.find((x) => x.id === pendingGoalId);
      util.compressImage(file).then((dataUrl) => {
        if (g) g.photo = dataUrl;
        store.save(); util.toast('照片已保存'); render(container);
      });
      photoInput.value = '';
    };
  }

  WB.sections = WB.sections || {};
  WB.sections.goals = { title: '目标', render };
})();
