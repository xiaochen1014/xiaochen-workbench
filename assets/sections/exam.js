/* ============================================================
   备考指南（支持多个命名考试的倒计时）
   ============================================================ */
(function () {
  const WB = window.WB;
  const { store, util } = WB;
  let showDoneTasks = false; // 是否展开「已完成」任务以便撤销

  function ensureDailyReset() {
    const d = store.get();
    const today = util.today();
    let changed = false;
    d.exam.dailyTasks.forEach((t) => {
      if (t.lastReset !== today) { t.done = false; t.lastReset = today; changed = true; }
    });
    if (changed) store.save();
    const total = d.exam.dailyTasks.length;
    const done = d.exam.dailyTasks.filter((t) => t.done).length;
    d.exam.dailyLog[today] = { done, total };
    return d.exam.dailyLog[today];
  }

  function daysLeft(dateStr) {
    const target = util.parseDate(dateStr);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((target - now) / 86400000);
  }

  function render(container) {
    const d = store.get();
    const today = util.today();
    const exam = d.exam;
    ensureDailyReset();

    // 命名考试倒计时（按剩余天数升序）
    const exams = (exam.exams || []).slice().sort((a, b) => daysLeft(a.date) - daysLeft(b.date));
    const cdHtml = exams.length
      ? exams.map((e) => {
          const left = daysLeft(e.date);
          const urgent = left <= 30;
          return `
          <div class="row" style="align-items:flex-start">
            <div class="grow">
              <div class="title">${util.escape(e.name)}</div>
              <div class="countdown ${urgent ? 'urgent' : ''}" style="margin-top:2px">
                <span class="num" style="font-size:30px">${left >= 0 ? left : 0}</span>
                <span class="unit">天后 · ${util.escape(e.date)}${left < 0 ? '（已结束）' : ''}</span>
              </div>
            </div>
            <button class="btn danger sm" data-del-exam="${e.id}">删除</button>
          </div>`;
        }).join('')
      : `<div class="empty">还没有添加考试，在下方添加你的备考目标吧～</div>`;

    // 今日清单：完成的任务默认隐去（做完了就没有），可展开查看/撤销
    const tasks = exam.dailyTasks;
    const activeTasks = tasks.filter((t) => !t.done);
    const doneTasks = tasks.filter((t) => t.done);
    const taskRowHtml = (t) => `
      <div class="row">
        <input type="checkbox" class="chk" data-task="${t.id}" ${t.done ? 'checked' : ''}>
        <div class="grow">
          <div class="title" style="${t.done ? 'text-decoration:line-through;color:var(--ink-faint)' : ''}">${util.escape(t.text)}</div>
        </div>
        <button class="btn ghost sm" data-del-task="${t.id}">删除</button>
      </div>`;
    const taskRows = activeTasks.length
      ? activeTasks.map(taskRowHtml).join('')
      : `<div class="empty">${doneTasks.length ? '今日任务都完成啦 🎉' : '还没有今日任务，添加一条吧～'}</div>`;
    const doneRows = (showDoneTasks && doneTasks.length)
      ? doneTasks.map(taskRowHtml).join('')
      : '';

    const todayLog = exam.dailyLog[today] || { done: 0, total: tasks.length };
    const rate = todayLog.total ? Math.round((todayLog.done / todayLog.total) * 100) : 0;

    // 考试记录
    const recRows = exam.records.length
      ? exam.records.slice().reverse().map((r) => `
        <tr>
          <td>${util.escape(r.date || '—')}</td>
          <td><b>${util.escape(r.score)}</b></td>
          <td>${util.escape(r.note || '')}</td>
          <td class="right"><button class="btn ghost sm" data-del-rec="${r.id}">删除</button></td>
        </tr>`).join('')
      : `<tr><td colspan="4" class="empty">暂无考试记录</td></tr>`;

    container.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <h3><span class="dot"></span>考试倒计时</h3>
          <div class="list">${cdHtml}</div>
          <div class="divider"></div>
          <h3 style="font-size:14px"><span class="dot" style="background:var(--green)"></span>添加考试</h3>
          <div class="form-row">
            <div style="flex:2"><label>考试名称</label><input type="text" id="exam-name" placeholder="如：考研 / 教资笔试"></div>
            <div style="flex:1"><label>考试日期</label><input type="date" id="exam-date"></div>
            <div style="flex:0 0 auto;align-self:flex-end"><button class="btn" id="exam-add">添加</button></div>
          </div>
        </div>

        <div class="card">
          <h3><span class="dot"></span>今日任务完成度</h3>
          <div class="countdown"><span class="num" style="font-size:34px;color:var(--green)">${rate}%</span><span class="unit">(${todayLog.done}/${todayLog.total})</span></div>
          <div class="progress" style="margin-top:8px"><span style="width:${rate}%"></span></div>
          <div class="muted" style="margin-top:8px">每日 0 点自动重置打卡状态</div>
          <div class="divider"></div>
          <div class="muted">即将到来的考试</div>
          <div style="margin-top:6px">${exams.length ? `<b>${util.escape(exams[0].name)}</b> · 还有 <b style="color:${daysLeft(exams[0].date) <= 30 ? 'var(--red)' : 'var(--brand)'}">${Math.max(0, daysLeft(exams[0].date))}</b> 天` : '暂无'}</div>
        </div>
      </div>

      <div class="grid" style="margin-top:18px">
        <div class="card">
          <div class="section-head">
            <h3 style="margin:0"><span class="dot"></span>今日清单</h3>
            ${doneTasks.length ? `<button class="btn ghost sm" id="toggle-done">${showDoneTasks ? '隐藏已完成' : '显示已完成 (' + doneTasks.length + ')'}</button>` : ''}
          </div>
          <div class="list" style="margin-top:6px">${taskRows}</div>
          ${doneRows ? `<div class="list" style="margin-top:8px;opacity:.85">${doneRows}</div>` : ''}
          <div class="form-row" style="margin-top:14px">
            <div style="flex:3"><input type="text" id="task-input" placeholder="例如：背单词 30 个 / 做一套真题"></div>
            <div style="flex:0 0 auto"><button class="btn" id="task-add">添加任务</button></div>
          </div>
        </div>

        <div class="card">
          <h3><span class="dot"></span>考试记录</h3>
          <div class="card-sub">记录每次模考 / 正式考试的时间、分数与备注</div>
          <table class="tbl">
            <thead><tr><th>时间</th><th>分数</th><th>备注</th><th></th></tr></thead>
            <tbody>${recRows}</tbody>
          </table>
          <div class="form-row" style="margin-top:14px">
            <div><label>时间</label><input type="date" id="rec-date" value="${today}"></div>
            <div><label>分数</label><input type="text" id="rec-score" placeholder="例如 128"></div>
            <div style="flex:2"><label>备注</label><input type="text" id="rec-note" placeholder="可选"></div>
            <div style="flex:0 0 auto;align-self:flex-end"><button class="btn" id="rec-add">添加</button></div>
          </div>
        </div>
      </div>
    `;

    const $ = (s) => container.querySelector(s);
    const $$ = (s) => container.querySelectorAll(s);

    $('#exam-add').onclick = () => {
      const name = $('#exam-name').value.trim();
      const date = $('#exam-date').value;
      if (!name) return util.toast('请填写考试名称');
      if (!date) return util.toast('请选择考试日期');
      exam.exams.push({ id: util.uid(), name, date });
      store.save(); util.toast('已添加考试'); render(container);
    };
    $$('[data-del-exam]').forEach((b) => b.onclick = () => {
      exam.exams = exam.exams.filter((x) => x.id !== b.dataset.delExam);
      store.save(); render(container);
    });

    $('#task-add').onclick = () => {
      const v = $('#task-input').value.trim();
      if (!v) return util.toast('请输入任务内容');
      exam.dailyTasks.push({ id: util.uid(), text: v, done: false, lastReset: util.today() });
      store.save(); render(container);
    };
    $$('[data-del-task]').forEach((b) => b.onclick = () => {
      exam.dailyTasks = exam.dailyTasks.filter((t) => t.id !== b.dataset.delTask);
      store.save(); render(container);
    });
    const toggleBtn = $('#toggle-done');
    if (toggleBtn) toggleBtn.onclick = () => { showDoneTasks = !showDoneTasks; render(container); };
    $$('[data-task]').forEach((c) => c.onchange = () => {
      const t = exam.dailyTasks.find((x) => x.id === c.dataset.task);
      if (t) { t.done = c.checked; }
      const total = exam.dailyTasks.length;
      const done = exam.dailyTasks.filter((x) => x.done).length;
      exam.dailyLog[util.today()] = { done, total };
      store.save(); render(container);
    });

    $('#rec-add').onclick = () => {
      const date = $('#rec-date').value;
      const score = $('#rec-score').value.trim();
      if (!date || !score) return util.toast('请填写时间和分数');
      exam.records.push({ id: util.uid(), date, score, note: $('#rec-note').value.trim() });
      store.save(); util.toast('已添加记录'); render(container);
    };
    $$('[data-del-rec]').forEach((b) => b.onclick = () => {
      exam.records = exam.records.filter((r) => r.id !== b.dataset.delRec);
      store.save(); render(container);
    });
  }

  WB.sections = WB.sections || {};
  WB.sections.exam = { title: '备考指南', render };
})();
