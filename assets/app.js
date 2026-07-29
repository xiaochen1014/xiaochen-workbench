/* ============================================================
   小陈的工作台 — 应用入口 / 路由 / 导入导出
   ============================================================ */
(function () {
  const WB = window.WB;
  const { store, util } = WB;

  const content = document.getElementById('content');
  const titleEl = document.getElementById('section-title');
  const dateEl = document.getElementById('topbar-date');
  let current = 'exam';

  function setDate() {
    const now = new Date();
    const wk = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    dateEl.textContent = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · 周${wk}`;
  }

  function show(name) {
    if (name === current && WB.sections[current]) {
      WB.sections[current].render(content);
      return;
    }
    // 离开旅游模块时释放地图实例
    if (current === 'travel' && WB.sections.travel && WB.sections.travel.dispose) {
      WB.sections.travel.dispose();
    }
    current = name;
    const sec = WB.sections[name];
    if (!sec) return;
    titleEl.textContent = sec.title;
    content.scrollTop = 0;
    sec.render(content);
  }

  // 导航
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      show(btn.dataset.section);
    });
  });

  // 导出
  function doExport() {
    const blob = new Blob([store.export()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `小陈工作台备份_${util.today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    util.toast('已导出数据');
  }

  // 导入
  const importFile = document.getElementById('import-file');
  function doImport() { importFile.click(); }
  importFile.addEventListener('change', () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        store.import(reader.result);
        util.toast('导入成功，正在刷新');
        show(current);
      } catch (e) {
        util.toast('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
    importFile.value = '';
  });

  const exBtn = document.getElementById('export-btn');
  const imBtn = document.getElementById('import-btn');
  const exTop = document.getElementById('export-btn-top');
  const imTop = document.getElementById('import-btn-top');
  if (exBtn) exBtn.addEventListener('click', doExport);
  if (exTop) exTop.addEventListener('click', doExport);
  if (imBtn) imBtn.addEventListener('click', doImport);
  if (imTop) imTop.addEventListener('click', doImport);

  // 窗口缩放时让地图自适应
  window.addEventListener('resize', () => {
    // 由各模块自行处理；此处无需操作
  });

  setDate();
  show('exam');

  // 注册 Service Worker（PWA 安装 / 离线）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
