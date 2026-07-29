/* ============================================================
   旅游日记 — 中国地图（边界数据来自高德/DataV，符合地图规范）
   全国(标注省会) -> 省份 -> 城市 钻取；去过区域高德式橙色高亮；景点可加照片
   ============================================================ */
(function () {
  const WB = window.WB;
  const { store, util } = WB;
  const GEO_BASE = 'https://geo.datav.aliyun.com/areas_v3/bound/';
  // 手绘风：未去过的省份统一淡米色，去过的用陶土色高亮，制造层次
  const COLOR_UNVISIT = '#ece4d6';   // 未去过的省份（统一淡米色）
  const COLOR_VISITED = '#c08a76';   // 去过的省份（陶土色高亮，像手绘涂色）
  const COLOR_BORDER = '#f7f2ea';    // 暖白描边

  // 各省会（用于全国地图标注，坐标近似，符合边界规范）
  // pcode=省 adcode，code=省会市 adcode
  const CAPITALS = {
    '北京': { c: '北京', code: '110000', pcode: '110000', coord: [116.41, 39.90] },
    '天津': { c: '天津', code: '120000', pcode: '120000', coord: [117.20, 39.13] },
    '河北': { c: '石家庄', code: '130100', pcode: '130000', coord: [114.51, 38.04] },
    '山西': { c: '太原', code: '140100', pcode: '140000', coord: [112.55, 37.87] },
    '内蒙古': { c: '呼和浩特', code: '150100', pcode: '150000', coord: [111.75, 40.84] },
    '辽宁': { c: '沈阳', code: '210100', pcode: '210000', coord: [123.43, 41.80] },
    '吉林': { c: '长春', code: '220100', pcode: '220000', coord: [125.32, 43.82] },
    '黑龙江': { c: '哈尔滨', code: '230100', pcode: '230000', coord: [126.64, 45.76] },
    '上海': { c: '上海', code: '310000', pcode: '310000', coord: [121.47, 31.23] },
    '江苏': { c: '南京', code: '320100', pcode: '320000', coord: [118.78, 32.04] },
    '浙江': { c: '杭州', code: '330100', pcode: '330000', coord: [120.15, 30.27] },
    '安徽': { c: '合肥', code: '340100', pcode: '340000', coord: [117.27, 31.86] },
    '福建': { c: '福州', code: '350100', pcode: '350000', coord: [119.30, 26.08] },
    '江西': { c: '南昌', code: '360100', pcode: '360000', coord: [115.89, 28.68] },
    '山东': { c: '济南', code: '370100', pcode: '370000', coord: [117.00, 36.65] },
    '河南': { c: '郑州', code: '410100', pcode: '410000', coord: [113.62, 34.75] },
    '湖北': { c: '武汉', code: '420100', pcode: '420000', coord: [114.30, 30.59] },
    '湖南': { c: '长沙', code: '430100', pcode: '430000', coord: [112.94, 28.23] },
    '广东': { c: '广州', code: '440100', pcode: '440000', coord: [113.26, 23.13] },
    '广西': { c: '南宁', code: '450100', pcode: '450000', coord: [108.37, 22.82] },
    '海南': { c: '海口', code: '460100', pcode: '460000', coord: [110.20, 20.04] },
    '重庆': { c: '重庆', code: '500000', pcode: '500000', coord: [106.55, 29.56] },
    '四川': { c: '成都', code: '510100', pcode: '510000', coord: [104.07, 30.67] },
    '贵州': { c: '贵阳', code: '520100', pcode: '520000', coord: [106.71, 26.57] },
    '云南': { c: '昆明', code: '530100', pcode: '530000', coord: [102.71, 25.05] },
    '西藏': { c: '拉萨', code: '540100', pcode: '540000', coord: [91.13, 29.66] },
    '陕西': { c: '西安', code: '610100', pcode: '610000', coord: [108.95, 34.27] },
    '甘肃': { c: '兰州', code: '620100', pcode: '620000', coord: [103.82, 36.06] },
    '青海': { c: '西宁', code: '630100', pcode: '630000', coord: [101.78, 36.62] },
    '宁夏': { c: '银川', code: '640100', pcode: '640000', coord: [106.27, 38.47] },
    '新疆': { c: '乌鲁木齐', code: '650100', pcode: '650000', coord: [87.62, 43.82] },
    '香港': { c: '香港', code: '810000', pcode: '810000', coord: [114.17, 22.32] },
    '澳门': { c: '澳门', code: '820000', pcode: '820000', coord: [113.55, 22.20] },
    '台湾': { c: '台北', code: '710000', pcode: '710000', coord: [121.50, 25.03] },
  };

  const geoCache = {};
  let chart = null;
  let curVisitedNames = new Set();
  const state = { level: 'country', adcode: '100000', name: '中国', provinceGeo: null, selectedCity: null };

  function fetchGeo(adcode) {
    if (geoCache[adcode]) return Promise.resolve(geoCache[adcode]);
    // 本地优先（离线可用），失败回退到高德/DataV CDN（边界符合地图规范）
    const local = `assets/vendor/geo/${adcode}_full.json`;
    return fetch(local)
      .then((r) => { if (!r.ok) throw new Error('local'); return r.json(); })
      .catch(() => fetch(GEO_BASE + adcode + '_full.json')
        .then((r) => { if (!r.ok) throw new Error('geo ' + adcode); return r.json(); }))
      .then((g) => { geoCache[adcode] = g; return g; });
  }

  function visitedProvinceSet() {
    const s = new Set();
    store.get().travel.attractions.forEach((a) => { if (a.provinceCode) s.add(a.provinceCode); });
    return s;
  }
  function visitedCitySet() {
    const s = new Set();
    store.get().travel.attractions.forEach((a) => { if (a.cityCode) s.add(a.cityCode); });
    return s;
  }

  function buildRegions(features, visitSet) {
    return features.map((f) => {
      const p = f.properties || {};
      const code = String(p.adcode);
      const visited = visitSet.has(code);
      return {
        name: p.name,
        itemStyle: {
          color: visited ? COLOR_VISITED : COLOR_UNVISIT,
          borderColor: COLOR_BORDER,
          borderWidth: 1,
          shadowBlur: visited ? 12 : 4,
          shadowColor: visited ? 'rgba(150, 86, 60, 0.35)' : 'rgba(120, 108, 96, 0.18)',
        },
      };
    });
  }

  function capitalScatter() {
    return Object.keys(CAPITALS).map((prov) => {
      const cap = CAPITALS[prov];
      return { name: cap.c, value: cap.coord, prov, pcode: cap.pcode, ccode: cap.code };
    });
  }

  function mapOption(geoName, features, visitSet, scatterData) {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          if (p.seriesType === 'scatter') return (p.data.prov ? p.data.prov + ' · ' : '') + p.name + '（点击记录景点）';
          const v = curVisitedNames.has(p.name);
          const tail = state.level === 'country' ? (v ? '（已去过）' : '（点击下钻）') : (v ? '（已去过）' : '（点击记录）');
          return p.name + tail;
        },
      },
      geo: {
        map: geoName, roam: true,
        label: { show: true, fontSize: 9, color: '#6f655b' },
        regions: buildRegions(features, visitSet),
        itemStyle: { borderColor: COLOR_BORDER, borderWidth: 1, areaColor: '#ded7c8', shadowBlur: 10, shadowColor: 'rgba(120, 108, 96, 0.12)' },
        emphasis: { label: { color: '#4f463c', fontWeight: 'bold' }, itemStyle: { color: '#b08d7e' }, focus: 'self' },
        select: { itemStyle: { color: '#b08d7e' }, label: { color: '#4f463c' } },
        selectedMode: false,
      },
      series: scatterData ? [{
        type: 'scatter', coordinateSystem: 'geo',
        data: scatterData,
        symbolSize: 6,
        label: { show: true, formatter: '{b}', position: 'right', fontSize: 9, color: '#6f655b', fontWeight: 'bold' },
        itemStyle: { color: '#8a7d6e', borderColor: '#f5f1e8', borderWidth: 1.2 },
        emphasis: { itemStyle: { color: '#c08a76', borderColor: '#fff', borderWidth: 1.5 }, label: { color: '#4f463c' } },
        z: 12,
      }] : [],
    };
  }

  function onMapClick(params) {
    if (!params) return;
    if (params.seriesType === 'scatter') {
      fillRecordForm({ provinceName: params.data.prov, cityName: params.data.name, cityCode: params.data.ccode, provinceCode: params.data.pcode });
      return;
    }
    const name = params.name;
    if (state.level === 'country') {
      const f = (geoCache['100000'].features || []).find((x) => (x.properties || {}).name === name);
      if (f) goProvince(String(f.properties.adcode), f.properties.name);
    } else if (state.level === 'province' && state.provinceGeo) {
      const f = (state.provinceGeo.features || []).find((x) => (x.properties || {}).name === name);
      if (f) fillRecordForm({ provinceName: state.name, cityName: f.properties.name, cityCode: String(f.properties.adcode), provinceCode: state.adcode });
    }
  }

  function fillRecordForm(info) {
    const prov = document.getElementById('attr-prov');
    const city = document.getElementById('attr-city');
    if (prov) prov.value = info.provinceName;
    if (city) city.value = info.cityName;
    state.selectedCity = { code: info.cityCode, name: info.cityName };
    const wrap = document.getElementById('travel-map');
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    util.toast('已选中：' + info.provinceName + ' · ' + info.cityName + '，请在右侧填写景点');
  }

  function goProvince(adcode, name) {
    state.level = 'province';
    state.adcode = adcode;
    state.name = name;
    state.selectedCity = null;
    fetchGeo(adcode).then((g) => {
      state.provinceGeo = g;
      echarts.registerMap(adcode, g);
      curVisitedNames = new Set([...visitedCitySet()].map((code) => {
        const f = g.features.find((x) => String(x.properties.adcode) === code);
        return f ? f.properties.name : null;
      }).filter(Boolean));
      if (chart) {
        chart.setOption(mapOption(adcode, g.features, visitedCitySet(),
          g.features.map((f) => ({ name: f.properties.name, value: f.properties.center, code: String(f.properties.adcode) }))), true);
        chart.off('click', onMapClick); chart.on('click', onMapClick);
      }
      updateToolbar();
      if (typeof window.__travelRefreshList === 'function') window.__travelRefreshList();
    }).catch(() => util.toast('该区域地图数据加载失败（需联网）'));
  }

  function backToCountry() {
    state.level = 'country'; state.adcode = '100000'; state.name = '中国'; state.selectedCity = null; state.provinceGeo = null;
    curVisitedNames = visitedProvinceSet();
    if (chart) {
      chart.setOption(mapOption('china', geoCache['100000'].features, visitedProvinceSet(), capitalScatter()), true);
      chart.off('click', onMapClick); chart.on('click', onMapClick);
    }
    updateToolbar();
    if (typeof window.__travelRefreshList === 'function') window.__travelRefreshList();
  }

  function updateToolbar() {
    const el = document.getElementById('map-cur');
    if (el) el.textContent = state.level === 'country' ? '全国' : state.name;
    const back = document.getElementById('map-back');
    if (back) back.style.display = state.level === 'country' ? 'none' : '';
  }

  function loadCountry() {
    if (typeof echarts === 'undefined') {
      const el = document.getElementById('travel-map');
      if (el) el.innerHTML = '<div class="empty">地图组件未加载（请检查网络后刷新）。<br>景点记录功能仍可正常使用。</div>';
      return;
    }
    fetchGeo('100000').then((g) => {
      echarts.registerMap('china', g);
      curVisitedNames = visitedProvinceSet();
      if (!chart) {
        chart = echarts.init(document.getElementById('travel-map'));
        chart.on('click', onMapClick);
      }
      if (state.level === 'province' && state.provinceGeo) {
        echarts.registerMap(state.adcode, state.provinceGeo);
        curVisitedNames = new Set([...visitedCitySet()].map((code) => {
          const f = state.provinceGeo.features.find((x) => String(x.properties.adcode) === code);
          return f ? f.properties.name : null;
        }).filter(Boolean));
        chart.setOption(mapOption(state.adcode, state.provinceGeo.features, visitedCitySet(),
          state.provinceGeo.features.map((f) => ({ name: f.properties.name, value: f.properties.center, code: String(f.properties.adcode) }))), true);
      } else {
        chart.setOption(mapOption('china', g.features, visitedProvinceSet(), capitalScatter()), true);
      }
      chart.resize();
      updateToolbar();
    }).catch(() => {
      const el = document.getElementById('travel-map');
      if (el) el.innerHTML = '<div class="empty">全国地图数据加载失败，请联网后刷新页面。</div>';
    });
  }

  function attractionListHtml() {
    const d = store.get();
    let items = d.travel.attractions.slice();
    if (state.level === 'province') items = items.filter((a) => a.provinceCode === state.adcode);
    if (!items.length) return `<div class="empty">${state.level === 'country' ? '还没有去过任何地方，点地图省会或省份去记录吧～' : '该省份还没有景点记录'}</div>`;
    // 按 省份·城市 分组，像手账的「一章」
    const groups = {};
    items.forEach((a) => {
      const key = (a.provinceName || '未填省份') + ' · ' + (a.cityName || '未填城市');
      (groups[key] = groups[key] || []).push(a);
    });
    const keys = Object.keys(groups).sort((k1, k2) => {
      const max1 = groups[k1].map((x) => x.date || '').sort().pop() || '';
      const max2 = groups[k2].map((x) => x.date || '').sort().pop() || '';
      return max2.localeCompare(max1);
    });
    const photosOf = (a) => (a.photos && a.photos.length) ? a.photos : (a.photo ? [a.photo] : []);
    const entriesOf = (arr) => arr.slice().reverse().map((a, i) => {
      const photos = photosOf(a);
      const pol = photos.map((src, pi) => {
        const r = ((i + pi) % 2 ? 1.8 : -2.2);
        return `<div class="polaroid" style="--r:${r}deg"><img src="${src}" alt=""><div class="cap">${util.escape(a.date || '')}</div></div>`;
      }).join('');
      return `
        <div class="journal-entry">
          <button class="btn ghost sm entry-del" data-del-attr="${a.id}">删除</button>
          <div class="entry-date">📅 ${util.escape(a.date || '未填日期')}</div>
          <div class="entry-title">${util.escape(a.name)}</div>
          ${a.note ? `<div class="entry-note">${util.escape(a.note)}</div>` : ''}
          ${photos.length ? `<div class="polaroids">${pol}</div>` : ''}
        </div>`;
    }).join('');
    return `<div class="journal">` + keys.map((k) => {
      const arr = groups[k];
      return `<div class="journal-chapter">
        <div class="ch-head"><span class="pin">📍</span>${util.escape(k)} <span class="cnt">· ${arr.length} 个记录</span></div>
        ${entriesOf(arr)}
      </div>`;
    }).join('') + `</div>`;
  }

  let container;
  function render(c) {
    container = c;
    const d = store.get();
    const pv = visitedProvinceSet().size;
    const cv = visitedCitySet().size;

    c.innerHTML = `
      <div class="card">
        <div class="map-toolbar">
          <button class="btn ghost sm" id="map-back" style="display:none">‹ 返回全国</button>
          <span class="cur">当前：<b id="map-cur">全国</b></span>
          <span class="spacer"></span>
          <span class="badge amber">已去 ${pv} 个省份</span>
          <span class="badge green">${cv} 个城市</span>
        </div>
        <div class="map-wrap"><div id="travel-map" style="width:100%;height:520px"></div></div>
        <div class="legend">
          <span><i style="background:${COLOR_VISITED}"></i>去过的省份 / 城市</span>
          <span><i style="background:${COLOR_UNVISIT};border:1px solid ${COLOR_BORDER}"></i>未去过</span>
          <span><i style="background:#8a7d6e;border:1px solid ${COLOR_BORDER};border-radius:50%"></i>省会（点击记录）</span>
          <span class="muted">点击省份下钻到城市 · 滚轮可缩放</span>
        </div>
      </div>

      <div class="flex-travel">
        <div class="card form-card">
          <h3><span class="dot"></span>添加景点 / 手账</h3>
          <label>所在省份</label>
          <input type="text" id="attr-prov" value="${state.level === 'province' ? util.escape(state.name) : ''}" placeholder="点地图自动填入">
          <div class="form-row">
            <div style="flex:2"><label>城市（点地图自动填）</label><input type="text" id="attr-city" placeholder="如：广州"></div>
            <div style="flex:2"><label>日期</label><input type="date" id="attr-date" value="${util.today()}"></div>
          </div>
          <label>景点名称</label><input type="text" id="attr-name" placeholder="如：广州塔">
          <label>备注</label><input type="text" id="attr-note" placeholder="当时的心情、美食、小贴士…">
          <label>图片（可多选，自动压缩）</label><input type="file" id="attr-photo" accept="image/*" multiple>
          <button class="btn" id="attr-add" style="margin-top:14px;width:100%">添加这一笔</button>
          <div class="muted" style="margin-top:8px;font-size:12px">点地图省会或城市可自动填入；同一个地方可反复添加多条记录、多张照片。</div>
        </div>
        <div class="card journal-card">
          <h3><span class="dot"></span>我的旅行手账</h3>
          <div class="muted" style="margin-bottom:8px">${state.level === 'country' ? '显示全部手账（按城市分章）' : '显示「' + util.escape(state.name) + '」的手账'}</div>
          <div id="attr-list">${attractionListHtml()}</div>
        </div>
      </div>
      <div class="muted" style="margin-top:14px;font-size:12px">地图边界数据遵循国家测绘标准（含台湾省与南海诸岛），仅用于个人行程记录，数据均保存在本地浏览器。</div>
    `;

    const $ = (s) => c.querySelector(s);
    document.getElementById('map-back').onclick = backToCountry;

    window.__travelRefreshList = () => {
      const listEl = document.getElementById('attr-list');
      if (listEl) {
        listEl.innerHTML = attractionListHtml();
        listEl.querySelectorAll('[data-del-attr]').forEach((b) => b.onclick = () => {
          d.travel.attractions = d.travel.attractions.filter((a) => a.id !== b.dataset.delAttr);
          store.save(); refreshAfterChange();
        });
      }
    };

    function refreshAfterChange() {
      if (chart) {
        if (state.level === 'country' && geoCache['100000']) {
          curVisitedNames = visitedProvinceSet();
          chart.setOption({ geo: { regions: buildRegions(geoCache['100000'].features, visitedProvinceSet()) } });
        } else if (state.level === 'province' && state.provinceGeo) {
          chart.setOption({ geo: { regions: buildRegions(state.provinceGeo.features, visitedCitySet()) } });
        }
      }
      if (typeof window.__travelRefreshList === 'function') window.__travelRefreshList();
      const pv2 = visitedProvinceSet().size, cv2 = visitedCitySet().size;
      const amber = c.querySelector('.badge.amber');
      const green = c.querySelector('.badge.green');
      if (amber) amber.textContent = '已去 ' + pv2 + ' 个省份';
      if (green) green.textContent = cv2 + ' 个城市';
    }

    $('#attr-add').onclick = () => {
      const name = $('#attr-name').value.trim();
      if (!name) return util.toast('请填写景点名称');
      const provName = $('#attr-prov').value.trim();
      const cityName = $('#attr-city').value.trim();
      const fileEl = $('#attr-photo');
      const files = fileEl.files ? Array.from(fileEl.files) : [];
      const finish = (photos) => {
        const a = {
          id: util.uid(),
          provinceCode: state.level === 'province' ? state.adcode : '',
          provinceName: provName || (state.level === 'province' ? state.name : ''),
          cityCode: (state.level === 'province' && state.selectedCity) ? state.selectedCity.code : '',
          cityName: cityName || (state.selectedCity ? state.selectedCity.name : ''),
          name, date: $('#attr-date').value, note: $('#attr-note').value.trim(),
          photos: photos || [],
        };
        d.travel.attractions.push(a);
        store.save(); util.toast('已添加这一笔 · 共 ' + photos.length + ' 张图');
        $('#attr-name').value = ''; $('#attr-note').value = ''; $('#attr-photo').value = '';
        state.selectedCity = null;
        refreshAfterChange();
      };
      if (files.length) {
        Promise.all(files.map((f) => util.compressImage(f))).then(finish).catch(() => finish([]));
      } else { finish([]); }
    };

    c.querySelectorAll('[data-del-attr]').forEach((b) => b.onclick = () => {
      d.travel.attractions = d.travel.attractions.filter((a) => a.id !== b.dataset.delAttr);
      store.save(); refreshAfterChange();
    });

    loadCountry();
  }

  function dispose() {
    if (chart) { chart.dispose(); chart = null; }
  }

  WB.sections = WB.sections || {};
  WB.sections.travel = { title: '旅游日记', render, dispose };
})();
