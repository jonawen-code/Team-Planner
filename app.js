/* ============================================================
 * app.js —— 全部逻辑
 * i18n / 工具 / 模型 / 状态 / 渲染 / 交互 / 弹窗 / 服务 / 启动
 * ============================================================ */

/* ===================== I18N ===================== */
let currentLang = 'zh-CN';
function t(key, params){
  const dict = I18N[currentLang] || I18N['zh-CN'];
  let s = dict[key];
  if (s === undefined) s = (I18N['zh-CN'][key] !== undefined ? I18N['zh-CN'][key] : key);
  if (params){ for (const k in params){ s = String(s).replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]); } }
  return s;
}

function applyStaticTranslations(){
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.getAttribute('data-i18n-title')); });
}

function setLanguage(lang){
  if (!I18N[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  const topSel = document.getElementById('langSelect'); if (topSel) topSel.value = lang;
  const cfgSel = document.getElementById('cfgLanguage'); if (cfgSel) cfgSel.value = lang;
  applyStaticTranslations();
  if (typeof persistProjectCache === 'function'){ try { persistProjectCache(); } catch(e){} }
  if (typeof applyBranding === 'function') applyBranding();
  if (typeof updateLogoStatus === 'function') updateLogoStatus();
  if (typeof updateBoldBtnUI === 'function') updateBoldBtnUI();
  if (typeof updateWrapBtnUI === 'function') updateWrapBtnUI();
  if (typeof renderTeamToggles === 'function') renderTeamToggles();
  if (typeof renderLegend === 'function') renderLegend();
  if (typeof render === 'function') render();
  if (typeof renderRecycleBin === 'function' && document.getElementById('recycleModal').style.display === 'flex') renderRecycleBin();
  if (typeof toast === 'function') toast(t('toast_language_changed'));
}

/* ===================== 工具函数 ===================== */
const $ = id => document.getElementById(id);

function readJSONStorage(key, fallback = null){
  try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); }
  catch(e){ return fallback; }
}

function formatDate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysToPlannerDate(dateText, days){
  const parts = String(dateText || '').split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fileTimestamp(d = new Date()){
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function safeProjectFileName(value){
  return String(value || 'Team-Planner-Project').trim().replace(/[\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'Team-Planner-Project';
}

function getLunarText(yr, m, d){
  try {
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month:'numeric', day:'numeric' }).formatToParts(new Date(yr, m, d));
    const rawMonth = parts.find(p => p.type === 'month')?.value || '';
    const rawDay = parts.find(p => p.type === 'day')?.value || '';
    const digits = {'0':'〇','1':'一','2':'二','3':'三','4':'四','5':'五','6':'六','7':'七','8':'八','9':'九'};
    const monthNames = {'1':'正','2':'二','3':'三','4':'四','5':'五','6':'六','7':'七','8':'八','9':'九','10':'十','11':'十一','12':'腊'};
    const dayNames = {'1':'初一','2':'初二','3':'初三','4':'初四','5':'初五','6':'初六','7':'初七','8':'初八','9':'初九','10':'初十','11':'十一','12':'十二','13':'十三','14':'十四','15':'十五','16':'十六','17':'十七','18':'十八','19':'十九','20':'二十','21':'廿一','22':'廿二','23':'廿三','24':'廿四','25':'廿五','26':'廿六','27':'廿七','28':'廿八','29':'廿九','30':'三十'};
    const monthKey = String(parseInt(rawMonth, 10));
    const dayKey = String(parseInt(rawDay, 10));
    const cnMonth = monthNames[monthKey] || rawMonth.split('').map(x => digits[x] || x).join('');
    const cnDay = dayNames[dayKey] || rawDay.split('').map(x => digits[x] || x).join('');
    return cnMonth + '月' + cnDay;
  } catch(e){ return ''; }
}

function isColorLight(hex){
  const c = hex.substring(1);
  const rgb = parseInt(c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 180;
}

function darkenColor(hex, factor = 0.42){
  const value = (hex || '#64748b').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return '#334155';
  const r = Math.max(0, Math.round(parseInt(value.slice(0, 2), 16) * factor));
  const g = Math.max(0, Math.round(parseInt(value.slice(2, 4), 16) * factor));
  const b = Math.max(0, Math.round(parseInt(value.slice(4, 6), 16) * factor));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function normalizeTeamName(v, list = teams){
  const raw = String(v || '').trim();
  if (!raw) return '';
  const exact = (list || []).find(t => String(t.name || '').trim().toLowerCase() === raw.toLowerCase());
  if (exact) return exact.name;
  return LEGACY_TEAM_MAP[raw.toUpperCase()] || raw;
}

function migrateTeams(raw){
  const source = Array.isArray(raw) ? raw : defaultTeams;
  const seen = new Set();
  return source.map(t => {
    const sourceName = t.name || LEGACY_TEAM_MAP[String(t.id || '').toUpperCase()] || t.id;
    const name = normalizeTeamName(sourceName, defaultTeams);
    return {
      name,
      color: t.color || '#6366f1',
      light: typeof t.light === 'boolean' ? t.light : isColorLight(t.color || '#6366f1'),
      visible: t.visible !== false
    };
  }).filter(t => t.name && !seen.has(t.name.toLowerCase()) && (seen.add(t.name.toLowerCase()), true));
}

/* ===================== 项目模型 ===================== */
function buildLegacyProject(){
  const legacyTeams = migrateTeams(
    readJSONStorage(LEGACY_KEYS.teams, readJSONStorage(LEGACY_KEYS.teamsV13, defaultTeams)) || defaultTeams
  );
  const legacyEvents = (
    readJSONStorage(LEGACY_KEYS.events, readJSONStorage(LEGACY_KEYS.eventsV13, verifiedFullYearEvents)) || verifiedFullYearEvents
  ).map(e => ({ ...e, team: normalizeTeamName(e.team, legacyTeams), status: e.status === 'confirmed' ? 'confirmed' : 'planned' }));
  const legacyRecycle = (readJSONStorage(LEGACY_KEYS.recycle, []) || [])
    .map(e => ({ ...e, team: normalizeTeamName(e.team, legacyTeams) }));

  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: { projectName:'Team Planner Project', version: APP_VERSION, build: APP_BUILD, createdAt: now, modifiedAt: now },
    branding: { title:'Team Planner', subtitle:'Annual & Monthly Planning Board', logo:'', logoType:'' },
    settings: { colWidth:48, fontSize:11, isWrapMode:false, isBoldMode:true, showLunar:false, showWeekend:true, showHolidays:true, showAdjusted:true, language:'zh-CN' },
    teams: legacyTeams,
    events: legacyEvents,
    recycleBin: legacyRecycle
  };
}

function normalizeProject(raw){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const isV19 = src.schemaVersion === SCHEMA_VERSION || (src.metadata && src.branding && src.settings);
  const sourceTeams = migrateTeams(src.teams || defaultTeams);
  const sourceEvents = Array.isArray(src.events) ? src.events : [];
  const branding = isV19 ? (src.branding || {}) : { title: src.title, subtitle: src.subtitle, logo: src.logo, logoType: src.logoType };
  const settings = isV19 ? (src.settings || {}) : src;
  const now = new Date().toISOString();

  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      projectName: String(src.metadata?.projectName || branding.title || 'Team Planner Project').trim() || 'Team Planner Project',
      version: APP_VERSION,
      build: APP_BUILD,
      createdAt: src.metadata?.createdAt || now,
      modifiedAt: src.metadata?.modifiedAt || now
    },
    branding: {
      title: String(branding.title || 'Team Planner'),
      subtitle: typeof branding.subtitle === 'string' ? branding.subtitle : 'Annual & Monthly Planning Board',
      logo: typeof branding.logo === 'string' ? branding.logo : '',
      logoType: branding.logoType === 'file' ? 'file' : (branding.logo ? 'url' : '')
    },
    settings: {
      colWidth: Number.isFinite(Number(settings.colWidth)) ? Math.min(80, Math.max(34, Number(settings.colWidth))) : 48,
      fontSize: Number.isFinite(Number(settings.fontSize)) ? Math.min(14, Math.max(9, Number(settings.fontSize))) : 11,
      isWrapMode: settings.isWrapMode === true,
      isBoldMode: settings.isBoldMode !== false,
      showLunar: settings.showLunar === true,
      showWeekend: settings.showWeekend !== false,
      showHolidays: settings.showHolidays !== false,
      showAdjusted: settings.showAdjusted !== false,
      language: ['zh-CN','zh-TW','en'].includes(settings.language) ? settings.language : 'zh-CN'
    },
    teams: sourceTeams,
    events: sourceEvents.map(e => ({ ...e, team: normalizeTeamName(e.team, sourceTeams), status: e.status === 'confirmed' ? 'confirmed' : 'planned' })),
    recycleBin: (Array.isArray(src.recycleBin) ? src.recycleBin : []).map(e => ({ ...e, team: normalizeTeamName(e.team, sourceTeams) }))
  };
}

/* ===================== 状态中心 ===================== */
let currentProject = normalizeProject(readJSONStorage(PROJECT_CACHE_KEY, null) || buildLegacyProject());
let teams = currentProject.teams;
let events = currentProject.events;

const requiredTeamNames = new Set(events.map(e => e.team).filter(Boolean));
requiredTeamNames.forEach(name => {
  if (!teams.some(t => t.name === name)) {
    const base = defaultTeams.find(t => t.name === name);
    teams.push(base ? { ...base } : { name, color:'#6366f1', light:false, visible:true });
  }
});

let appTitle = currentProject.branding.title;
let appSubtitle = currentProject.branding.subtitle;
let appLogo = currentProject.branding.logo;
let appLogoType = currentProject.branding.logoType;

let currentColWidth = currentProject.settings.colWidth;
let currentFontSize = currentProject.settings.fontSize;
let isWrapMode = currentProject.settings.isWrapMode;
let isBoldMode = currentProject.settings.isBoldMode;
let showLunar = currentProject.settings.showLunar;
let showWeekend = currentProject.settings.showWeekend;
let showHolidays = currentProject.settings.showHolidays;
let showAdjusted = currentProject.settings.showAdjusted;

currentLang = currentProject.settings.language || 'zh-CN';

let view = 'month', year = 2026, currentMonth = 8, editId = null;
let recycleBin = currentProject.recycleBin;
let lastDeletedEvent = recycleBin.length ? recycleBin[recycleBin.length - 1] : null;

function syncProjectModel(){
  currentProject.schemaVersion = SCHEMA_VERSION;
  currentProject.metadata = {
    ...(currentProject.metadata || {}),
    projectName: String(currentProject.metadata?.projectName || appTitle || 'Team Planner Project').trim() || 'Team Planner Project',
    version: APP_VERSION, build: APP_BUILD,
    createdAt: currentProject.metadata?.createdAt || new Date().toISOString(),
    modifiedAt: new Date().toISOString()
  };
  currentProject.branding = { title: appTitle, subtitle: appSubtitle, logo: appLogo, logoType: appLogoType };
  currentProject.settings = { colWidth: currentColWidth, fontSize: currentFontSize, isWrapMode, isBoldMode, showLunar, showWeekend, showHolidays, showAdjusted, language: currentLang };
  currentProject.teams = teams;
  currentProject.events = events;
  currentProject.recycleBin = recycleBin;
  return currentProject;
}

function persistProjectCache(){
  syncProjectModel();
  localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify(currentProject));
}
persistProjectCache();

/* ===================== 拖拽 / 选择状态 ===================== */
let isDraggingEvent = false, draggedEventId = null, dragOriginStartDay = null, dragSpanDays = null, dragHoverDay = null, dragHoverTeam = null;
let isCellMouseDown = false, selectTeam = null, selectStartDay = null, selectEndDay = null;
let hasMovedDuringDrag = false;

/* ===================== 启动 ===================== */
function init() {
  document.documentElement.lang = currentLang;
  $('yearSelect').innerHTML = Array.from({ length: 11 }, (_, i) => `<option value="${2023 + i}">${2023 + i}</option>`).join('');
  $('yearSelect').value = year;
  const topSel = $('langSelect'); if (topSel) topSel.value = currentLang;
  applyBranding();
  applyStaticTranslations();
  updateMonthLabel();
  applyColWidth(currentColWidth);
  applyFontSize(currentFontSize);
  updateWrapBtnUI();
  updateBoldBtnUI();
  renderTeamToggles();
  renderLegend();
  render();
  bindGlobalInteractions();
  updateRecycleCount();
}

/* ===================== 显示控件 ===================== */
function updateMonthLabel(){ $('monthLabel').textContent = t('month_unit', { m: currentMonth + 1 }); }

function adjustColWidth(delta){
  currentColWidth = Math.min(80, Math.max(34, currentColWidth + delta));
  applyColWidth(currentColWidth); persistProjectCache();
}
function applyColWidth(w){
  document.documentElement.style.setProperty('--col-w', `${w}px`);
  $('colWidthDisplay').textContent = `${w}px`;
}
function adjustFontSize(delta){
  currentFontSize = Math.min(14, Math.max(9, currentFontSize + delta));
  applyFontSize(currentFontSize); persistProjectCache();
}
function applyFontSize(size){
  document.documentElement.style.setProperty('--item-font-size', `${size}px`);
  $('fontSizeDisplay').textContent = `${size}px`;
}
function toggleBoldMode(){
  isBoldMode = !isBoldMode; persistProjectCache(); updateBoldBtnUI(); render();
  toast(t('toast_bold', { mode: isBoldMode ? t('bold_mode_on') : t('bold_mode_off') }));
}
function updateBoldBtnUI(){
  const btn = $('boldToggleBtn');
  btn.textContent = isBoldMode ? t('bold_on') : t('bold_off');
  btn.classList.toggle('active', isBoldMode);
}
function toggleWrapMode(){
  isWrapMode = !isWrapMode; persistProjectCache(); updateWrapBtnUI(); render();
  toast(t('toast_wrap', { mode: isWrapMode ? t('wrap_mode_on') : t('wrap_mode_off') }));
}
function updateWrapBtnUI(){
  const btn = $('wrapToggleBtn');
  btn.textContent = isWrapMode ? t('wrap_on') : t('wrap_off');
  btn.classList.toggle('active', isWrapMode);
}

/* ===================== 团队开关 & 图例 ===================== */
function renderTeamToggles(){
  const bar = $('teamTogglesBar');
  bar.innerHTML = `<span class="toggle-title">${t('team_toggles_title')}</span>`;
  teams.forEach(tm => {
    const isVis = tm.visible !== false;
    const btn = document.createElement('button');
    btn.className = `team-pill-btn ${isVis ? 'active' : ''}`;
    if (isVis) { btn.style.backgroundColor = tm.color; if (tm.light) btn.style.color = '#1e293b'; }
    btn.innerHTML = `<span class="check-icon">${isVis ? '✓' : '○'}</span> ${tm.name}`;
    btn.onclick = () => { tm.visible = !isVis; saveTeamsToLocal(); renderTeamToggles(); renderLegend(); render(); };
    bar.appendChild(btn);
  });
}

function renderLegend(){
  const leg = $('legend');
  leg.innerHTML = '';
  teams.filter(tm => tm.visible !== false).forEach(tm => {
    leg.insertAdjacentHTML('beforeend', `<span class="legend-item"><i class="dot" style="background:${tm.color}"></i>${tm.name}</span>`);
  });
  leg.insertAdjacentHTML('beforeend', `
    <span class="legend-item"><i class="dot" style="background:var(--holiday-bg)"></i>${t('legend_holiday')}</span>
    <span class="legend-item"><i class="dot" style="background:var(--adjusted-workday);border:1px solid #d97706"></i>${t('legend_adjusted')}</span>
    <span class="status-legend-item"><span class="status-box" style="border-left:3px solid #475569"></span>${t('legend_confirmed')}</span>
    <span class="status-legend-item"><span class="status-box" style="border-left:4px solid transparent"></span>${t('legend_planned')}</span>
    <span class="hint">${t('legend_hint')}</span>
  `);
}

/* ===================== 渲染入口 ===================== */
function filtered(){
  const q = $('search').value.trim().toLowerCase();
  const visibleTeamNames = new Set(teams.filter(tm => tm.visible !== false).map(tm => tm.name));
  return events.filter(e => {
    if (!visibleTeamNames.has(e.team)) return false;
    const matchYear = new Date(e.start).getFullYear() === year || new Date(e.end).getFullYear() === year;
    const matchQ = !q || [e.title, e.owner, e.location, e.status, e.notes].join(' ').toLowerCase().includes(q);
    return matchYear && matchQ;
  });
}

function render(){
  $('yearSelect').value = year;
  updateMonthLabel();
  $('viewTitle').textContent = view === 'year' ? t('year_view_title', { year }) : t('month_view_title', { year, month: currentMonth + 1 });
  const list = filtered();
  $('countText').textContent = t('items_count', { n: list.length });
  view === 'year' ? renderYear(list) : renderMonth(list);
}

/* ===================== 年度视图 ===================== */
function renderYear(list){
  let h = `<div class="scroll"><div class="year-grid"><div class="cell headcell">${t('lbl_corner')}</div>` +
    Array.from({ length: 12 }, (_, i) => `<div class="cell headcell">${t('month_unit', { m: i + 1 })}</div>`).join('');
  teams.filter(tm => tm.visible !== false).forEach(tm => {
    h += `<div class="cell teamcell"><i class="dot" style="background:${tm.color}"></i>${tm.name}</div>`;
    for (let m = 0; m < 12; m++) {
      const es = list.filter(e => {
        if (e.team !== tm.name) return false;
        const s = new Date(e.start), en = new Date(e.end);
        return (s.getFullYear() === year && s.getMonth() <= m) && (en.getFullYear() === year && en.getMonth() >= m);
      });
      h += `<div class="cell">${es.map(e => `
        <div class="event-pill ${tm.light ? 'light' : ''} status-${e.status || 'confirmed'} ${isBoldMode ? 'font-bold-mode' : 'font-normal-mode'}"
             style="background:${tm.color};--confirmed-border:${darkenColor(tm.color, 0.42)}"
             onclick="editEvent(${e.id})" onmouseenter="showHoverCard(event, ${e.id})" onmouseleave="hideHoverCard()">
          ${e.title}
        </div>`).join('')}</div>`;
    }
  });
  h += '</div></div>';
  $('board').innerHTML = h;
}

/* ===================== 月度视图 ===================== */
function splitIntoTracks(eventsInMonth, days, m, yr){
  const monthEvts = eventsInMonth.filter(e => {
    const s = new Date(e.start), en = new Date(e.end);
    const sMatch = (s.getFullYear() < yr) || (s.getFullYear() === yr && s.getMonth() <= m);
    const eMatch = (en.getFullYear() > yr) || (en.getFullYear() === yr && en.getMonth() >= m);
    return sMatch && eMatch;
  });
  const processed = monthEvts.map(e => {
    const s = new Date(e.start), en = new Date(e.end);
    const startDay = (s.getFullYear() < yr || s.getMonth() < m) ? 1 : s.getDate();
    const endDay = (en.getFullYear() > yr || en.getMonth() > m) ? days : en.getDate();
    return { ...e, startDay, endDay };
  }).sort((a, b) => a.startDay - b.startDay);
  const tracks = [];
  processed.forEach(e => {
    let placed = false;
    for (let track of tracks) {
      const last = track[track.length - 1];
      if (last.endDay < e.startDay) { track.push(e); placed = true; break; }
    }
    if (!placed) tracks.push([e]);
  });
  return tracks.length > 0 ? tracks : [];
}

function getDayClass(day, m, yr){
  const dateStr = `${yr}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const hDict = getHolidaysForYear(yr), aDict = getAdjustedForYear(yr);
  if (showHolidays && Boolean(hDict[dateStr])) return 'holiday';
  if (showAdjusted && Boolean(aDict[dateStr])) return 'workday-adjusted';
  const wd = new Date(yr, m, day).getDay();
  if (showWeekend && (wd === 0 || wd === 6)) return 'weekend';
  return '';
}

function renderMonth(list){
  const m = currentMonth, yr = year;
  const days = new Date(yr, m + 1, 0).getDate();
  const monthEvents = list.filter(e => {
    const s = new Date(e.start), en = new Date(e.end);
    const sMatch = (s.getFullYear() < yr) || (s.getFullYear() === yr && s.getMonth() <= m);
    const eMatch = (en.getFullYear() > yr) || (en.getFullYear() === yr && en.getMonth() >= m);
    return sMatch && eMatch;
  });
  const visibleTeams = teams.filter(tm => tm.visible !== false);
  const teamTracksMap = {};
  visibleTeams.forEach(tm => { teamTracksMap[tm.name] = splitIntoTracks(monthEvents.filter(e => e.team === tm.name), days, m, yr); });
  let totalRows = 0; visibleTeams.forEach(tm => { totalRows += Math.max(1, teamTracksMap[tm.name].length); });

  let h = `<div class="month-wrap"><div class="grid-calendar" style="--total-days: ${days}; grid-template-rows: 76px repeat(${totalRows}, minmax(46px, auto));">`;
  h += `<div class="g-cell g-corner">${t('lbl_corner')}</div>`;

  const weekNames = [t('week_sun'), t('week_mon'), t('week_tue'), t('week_wed'), t('week_thu'), t('week_fri'), t('week_sat')];
  for (let d = 1; d <= days; d++) {
    const dateStr = `${yr}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hDict = getHolidaysForYear(yr), aDict = getAdjustedForYear(yr);
    const holidayName = hDict[dateStr], adjustedText = aDict[dateStr];
    const wd = new Date(yr, m, d).getDay();
    const isWk = (wd === 0 || wd === 6);
    let cls = '', badge = '';
    if (holidayName && showHolidays) { cls = 'holiday'; badge = `<span class="day-badge">${holidayName}</span>`; }
    else if (adjustedText && showAdjusted) { cls = 'workday-adjusted'; badge = `<span class="day-badge">${t('lbl_shift_class')}</span>`; }
    else if (isWk && showWeekend) { cls = 'weekend'; }
    h += `<div class="g-cell g-day-th ${cls}" style="grid-column: ${d + 1}; grid-row: 1;">
      <b>${d}</b><span>${weekNames[wd]}</span>${badge}
      ${showLunar ? `<span class="lunar-label">${getLunarText(yr, m, d)}</span>` : ''}
    </div>`;
  }

  let currentRow = 2;
  visibleTeams.forEach(tm => {
    const tracks = teamTracksMap[tm.name];
    const teamRowCount = Math.max(1, tracks.length);
    const startRow = currentRow, endRow = currentRow + teamRowCount;
    h += `<div class="g-cell g-team-label" style="grid-column: 1; grid-row: ${startRow} / ${endRow};"><i class="dot" style="background:${tm.color}"></i><span>${tm.name}</span></div>`;
    for (let d = 1; d <= days; d++) {
      const cls = getDayClass(d, m, yr);
      for (let r = 0; r < teamRowCount; r++) {
        h += `<div class="g-cell g-day-bg ${cls}" style="grid-column: ${d + 1}; grid-row: ${startRow + r};" data-team="${tm.name}" data-day="${d}"></div>`;
      }
    }
    tracks.forEach((trackEvents, rIdx) => {
      const rNum = startRow + rIdx;
      trackEvents.forEach(item => {
        const gridColStart = item.startDay + 1, gridColEnd = item.endDay + 2;
        const statusClass = `status-${item.status || 'confirmed'}`;
        const boldClass = isBoldMode ? 'font-bold-mode' : 'font-normal-mode';
        h += `<div class="g-event-card ${tm.light ? 'light' : ''} ${statusClass} ${boldClass}"
               style="background: ${tm.color}; --confirmed-border:${darkenColor(tm.color, 0.42)}; grid-column: ${gridColStart} / ${gridColEnd}; grid-row: ${rNum};"
               onclick="onCardClick(event, ${item.id})" onmouseenter="showHoverCard(event, ${item.id})" onmouseleave="hideHoverCard()"
               data-event-id="${item.id}"
               onmousedown="startDragEventMove(event, ${item.id}, encodeURIComponent('${tm.name}'), ${item.startDay}, ${item.endDay - item.startDay + 1})">
            <div class="event-text ${isWrapMode ? 'wrap-mode' : 'ellipsis-mode'}">${item.title}</div>
          </div>`;
      });
    });
    currentRow = endRow;
  });

  h += `</div></div>`;
  $('board').innerHTML = h;
}

/* ===================== 悬浮卡 ===================== */
const popover = $('hoverPopover');
function showHoverCard(e, eventId){
  if (isDraggingEvent || isCellMouseDown) return;
  const item = events.find(x => x.id === eventId);
  if (!item) return;
  const tm = teams.find(x => x.name === item.team) || { name: item.team, color: '#d50022' };
  $('popTitle').textContent = item.title;
  $('popTeam').innerHTML = `<b>${t('pop_team')}</b> ${tm.name}`;
  $('popDate').innerHTML = `<b>${t('pop_date')}</b> ${item.start} → ${item.end}`;
  $('popOwner').innerHTML = `<b>${t('pop_owner')}</b> ${item.owner || t('pop_unassigned')}`;
  $('popLocation').innerHTML = `<b>${t('pop_location')}</b> ${item.location || t('pop_tbd')}`;
  const tag = $('popTag');
  tag.textContent = item.status === 'confirmed' ? t('status_confirmed_label') : t('status_planned_label');
  tag.style.backgroundColor = tm.color;
  tag.style.color = tm.light ? '#1e293b' : '#ffffff';
  popover.style.borderLeftColor = tm.color;
  popover.style.display = 'block';
  const rect = popover.getBoundingClientRect();
  let left = e.clientX + 14, top = e.clientY - rect.height - 12;
  if (top < 10) top = e.clientY + 20;
  if (left + rect.width > window.innerWidth - 15) left = window.innerWidth - rect.width - 20;
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  requestAnimationFrame(() => { popover.classList.add('show'); });
}
function hideHoverCard(){
  popover.classList.remove('show');
  setTimeout(() => { if (!popover.classList.contains('show')) popover.style.display = 'none'; }, 100);
}
function onCardClick(ev, id){ if (hasMovedDuringDrag) return; editEvent(id); }
function startDragEventMove(ev, id, teamName, startDay, span){
  if (ev.button !== 0) return;
  ev.stopPropagation(); hideHoverCard();
  isDraggingEvent = true; draggedEventId = id; dragOriginStartDay = startDay; dragSpanDays = span;
  dragHoverDay = startDay; dragHoverTeam = decodeURIComponent(teamName); hasMovedDuringDrag = false;
}

/* ===================== 全局交互 ===================== */
function bindGlobalInteractions(){
  document.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const bg = e.target.closest('.g-day-bg'); if (!bg) return;
    isCellMouseDown = true; selectTeam = bg.getAttribute('data-team');
    selectStartDay = +bg.getAttribute('data-day'); selectEndDay = selectStartDay;
    highlightSelectCells();
  });
  document.addEventListener('mouseover', e => {
    if (isDraggingEvent) {
      hasMovedDuringDrag = true;
      const bg = e.target.closest('.g-day-bg') || e.target.closest('.g-event-card');
      if (bg) { dragHoverDay = +bg.getAttribute('data-day') || dragHoverDay; dragHoverTeam = bg.getAttribute('data-team') || dragHoverTeam; highlightDragTargetCells(); }
      return;
    }
    if (isCellMouseDown) {
      const bg = e.target.closest('.g-day-bg');
      if (bg && bg.getAttribute('data-team') === selectTeam) { selectEndDay = +bg.getAttribute('data-day'); highlightSelectCells(); }
    }
  });
  document.addEventListener('mouseup', () => {
    if (isDraggingEvent) {
      clearDragTargetHighlights();
      const deltaDays = dragHoverDay - dragOriginStartDay;
      isDraggingEvent = false;
      if (hasMovedDuringDrag && deltaDays !== 0) applyEventShift(draggedEventId, deltaDays, dragHoverTeam);
      return;
    }
    if (isCellMouseDown) {
      isCellMouseDown = false; clearSelectHighlights();
      const sDay = Math.min(selectStartDay, selectEndDay), eDay = Math.max(selectStartDay, selectEndDay);
      const sDate = `${year}-${String(currentMonth + 1).padStart(2, '0')}-${String(sDay).padStart(2, '0')}`;
      const eDate = `${year}-${String(currentMonth + 1).padStart(2, '0')}-${String(eDay).padStart(2, '0')}`;
      openModal({ team: selectTeam, start: sDate, end: eDate });
    }
  });
}
function highlightDragTargetCells(){
  clearDragTargetHighlights(); if (!dragHoverDay || !dragHoverTeam) return;
  const targetStart = dragHoverDay, targetEnd = dragHoverDay + dragSpanDays - 1;
  document.querySelectorAll(`.g-day-bg[data-team="${dragHoverTeam}"]`).forEach(bg => {
    const d = +bg.getAttribute('data-day');
    if (d >= targetStart && d <= targetEnd) bg.classList.add('drag-target-hover');
  });
}
function clearDragTargetHighlights(){ document.querySelectorAll('.g-day-bg.drag-target-hover').forEach(bg => bg.classList.remove('drag-target-hover')); }
function applyEventShift(eventId, deltaDays, newTeam){
  const item = events.find(x => x.id === eventId); if (!item) return;
  const sDate = new Date(item.start), eDate = new Date(item.end);
  sDate.setDate(sDate.getDate() + deltaDays); eDate.setDate(eDate.getDate() + deltaDays);
  item.start = formatDate(sDate); item.end = formatDate(eDate); if (newTeam) item.team = newTeam;
  persistEvents(); render();
  toast(t('toast_shift', { title:item.title, start:item.start, end:item.end }));
}
function highlightSelectCells(){
  clearSelectHighlights();
  const sDay = Math.min(selectStartDay, selectEndDay), eDay = Math.max(selectStartDay, selectEndDay);
  document.querySelectorAll(`.g-day-bg[data-team="${selectTeam}"]`).forEach(bg => {
    const d = +bg.getAttribute('data-day');
    if (d >= sDay && d <= eDay) bg.classList.add('drag-selecting');
  });
}
function clearSelectHighlights(){ document.querySelectorAll('.g-day-bg.drag-selecting').forEach(bg => bg.classList.remove('drag-selecting')); }

/* ===================== 视图切换 ===================== */
function setView(v){ view = v; $('yearBtn').classList.toggle('active', v === 'year'); $('monthBtn').classList.toggle('active', v === 'month'); render(); }
function changeYearFromSelect(){ year = +$('yearSelect').value; render(); }
function changeMonth(delta){
  currentMonth += delta;
  if (currentMonth < 0) { currentMonth = 11; year -= 1; }
  if (currentMonth > 11) { currentMonth = 0; year += 1; }
  if (![...$('yearSelect').options].some(o => +o.value === year)) {
    const opt = document.createElement('option'); opt.value = year; opt.textContent = year;
    $('yearSelect').appendChild(opt);
  }
  $('yearSelect').value = year; updateMonthLabel(); render();
}

/* ===================== 新建 / 编辑弹窗 ===================== */
function buildEventModal(){
  $('modalBack').innerHTML = `
  <div class="modal">
    <h3 id="modalTitle" data-i18n="new_event_title">新建排期</h3>
    <div class="form-grid">
      <div class="field full"><label data-i18n="f_title">事项名称 *</label><input id="fTitle" /></div>
      <div class="field"><label data-i18n="f_team">职能团队 *</label><select id="fTeam"></select></div>
      <div class="field"><label data-i18n="f_owner">负责人 / 协同人员</label><input id="fOwner" /></div>
      <div class="field"><label data-i18n="f_start">开始日期 *</label><input id="fStart" type="date" /></div>
      <div class="field"><label data-i18n="f_end">结束日期 *</label><input id="fEnd" type="date" /></div>
      <div class="field"><label data-i18n="f_status">状态</label>
        <select id="fStatus">
          <option value="planned" data-i18n="status_planned">Planned</option>
          <option value="confirmed" data-i18n="status_confirmed">Confirmed</option>
        </select>
      </div>
      <div class="field"><label data-i18n="f_location">地点 / 形式</label><input id="fLocation" /></div>
      <div class="field full"><label data-i18n="f_notes">备注详细</label><textarea id="fNotes" rows="3"></textarea></div>
    </div>
    <div class="actions">
      <button id="deleteBtn" class="danger" onclick="deleteEvent()" style="margin-right:auto;display:none" data-i18n="delete_event">删除此排期</button>
      <button id="outlookBtn" onclick="addCurrentEventToOutlook()" style="display:none" data-i18n="add_outlook">📅 添加到 Outlook</button>
      <button onclick="closeModal()" data-i18n="btn_cancel">取消</button>
      <button class="primary" onclick="saveEvent()" data-i18n="btn_save">保存</button>
    </div>
  </div>`;
}

function openModal(pref = {}){
  editId = null;
  $('modalTitle').textContent = t('new_event_title');
  $('deleteBtn').style.display = 'none';
  if ($('outlookBtn')) $('outlookBtn').style.display = 'none';
  ['Title','Owner','Location','Notes'].forEach(x => $('f' + x).value = '');
  $('fTeam').innerHTML = teams.map(tm => `<option value="${tm.name}">${tm.name}</option>`).join('');
  $('fTeam').value = pref.team || (teams[0] ? teams[0].name : 'L&D');
  $('fStatus').value = 'planned';
  const defaultDate = `${year}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  $('fStart').value = pref.start || defaultDate;
  $('fEnd').value = pref.end || pref.start || defaultDate;
  $('modalBack').style.display = 'flex';
}
function closeModal(){ $('modalBack').style.display = 'none'; }
function editEvent(id){
  hideHoverCard();
  const e = events.find(x => x.id === id); if (!e) return;
  editId = id;
  $('modalTitle').textContent = t('edit_event_title');
  $('deleteBtn').style.display = 'block';
  if ($('outlookBtn')) $('outlookBtn').style.display = 'inline-flex';
  $('fTeam').innerHTML = teams.map(tm => `<option value="${tm.name}">${tm.name}</option>`).join('');
  $('fTitle').value = e.title; $('fTeam').value = e.team; $('fOwner').value = e.owner || '';
  $('fStart').value = e.start; $('fEnd').value = e.end;
  $('fStatus').value = e.status === 'confirmed' ? 'confirmed' : 'planned';
  $('fLocation').value = e.location || ''; $('fNotes').value = e.notes || '';
  $('modalBack').style.display = 'flex';
}
function saveEvent(){
  const title = $('fTitle').value.trim(), start = $('fStart').value, end = $('fEnd').value;
  if (!title || !start || !end) return toast(t('toast_need_title_dates'));
  if (end < start) return toast(t('toast_end_before_start'));
  const obj = { id: editId || Date.now(), title, team: $('fTeam').value, owner: $('fOwner').value.trim(), start, end, status: $('fStatus').value, location: $('fLocation').value.trim(), notes: $('fNotes').value.trim() };
  if (editId) events = events.map(e => e.id === editId ? obj : e); else events.push(obj);
  persistEvents(); closeModal(); render(); toast(t('toast_saved'));
}
function deleteEvent(){
  const target = events.find(e => e.id === editId); if (!target) return;
  if (!confirm(t('confirm_delete', { title: target.title }))) return;
  const deleted = { ...JSON.parse(JSON.stringify(target)), deletedAt: new Date().toISOString() };
  recycleBin.push(deleted); lastDeletedEvent = deleted; persistProjectCache();
  events = events.filter(e => e.id !== editId); persistEvents(); closeModal();
  $('undoDeleteBtn').style.display = 'inline-flex'; updateRecycleCount(); render();
  toast(t('toast_deleted'));
}
function undoDelete(){
  if (!lastDeletedEvent) return toast(t('toast_no_undo'));
  const restored = { ...lastDeletedEvent }; delete restored.deletedAt;
  if (events.some(e => String(e.id) === String(restored.id))) restored.id = Date.now();
  events.push(restored);
  recycleBin = recycleBin.filter(e => !(String(e.id) === String(lastDeletedEvent.id) && e.deletedAt === lastDeletedEvent.deletedAt));
  lastDeletedEvent = recycleBin.length ? recycleBin[recycleBin.length - 1] : null;
  persistProjectCache();
  $('undoDeleteBtn').style.display = lastDeletedEvent ? 'inline-flex' : 'none';
  persistEvents(); updateRecycleCount(); render(); toast(t('toast_restored'));
}

/* ===================== 回收站 ===================== */
function updateRecycleCount(){ const el = $('recycleCount'); if (el) el.textContent = recycleBin.length ? '(' + recycleBin.length + ')' : ''; }
function openRecycleBin(){ renderRecycleBin(); $('recycleModal').style.display = 'flex'; }
function closeRecycleBin(){ $('recycleModal').style.display = 'none'; }
function renderRecycleBin(){
  const box = $('recycleList');
  if (!recycleBin.length) { box.innerHTML = `<div class="recycle-empty">${t('recycle_empty')}</div>`; return; }
  box.innerHTML = recycleBin.slice().reverse().map((e, i) => {
    const idx = recycleBin.length - 1 - i;
    return `<div class="recycle-row"><div class="recycle-title" title="${e.title}">${e.title}</div><div>${e.start || ''}</div><div>${e.team || ''}</div><button onclick="restoreFromRecycle(${idx})">${t('recycle_restore')}</button></div>`;
  }).join('');
}
function restoreFromRecycle(i){
  const src = recycleBin[i]; if (!src) return;
  const restored = { ...src }; delete restored.deletedAt;
  if (events.some(e => String(e.id) === String(restored.id))) restored.id = Date.now();
  events.push(restored); recycleBin.splice(i, 1); persistProjectCache();
  lastDeletedEvent = recycleBin.length ? recycleBin[recycleBin.length - 1] : null;
  persistEvents(); updateRecycleCount(); renderRecycleBin(); render(); toast(t('toast_restored'));
}
function emptyRecycleBin(){
  if (!recycleBin.length) return;
  if (!confirm(t('confirm_empty_recycle'))) return;
  recycleBin = []; lastDeletedEvent = null; persistProjectCache();
  $('undoDeleteBtn').style.display = 'none'; updateRecycleCount(); renderRecycleBin();
  toast(t('toast_recycle_emptied'));
}

/* ===================== 设置弹窗 ===================== */
function buildSettingsModal(){
  $('settingsModal').innerHTML = `
  <div class="modal settings-modal">
    <h3 data-i18n="settings_title">⚙️ 系统设置中心</h3>
    <div class="settings-layout">
      <nav class="settings-nav">
        <button type="button" class="settings-tab active" data-tab="basic" onclick="switchSettingsTab('basic')" data-i18n="tab_basic">基础配置</button>
        <button type="button" class="settings-tab" data-tab="calendar" onclick="switchSettingsTab('calendar')" data-i18n="tab_calendar">日历增强</button>
        <button type="button" class="settings-tab" data-tab="teams" onclick="switchSettingsTab('teams')" data-i18n="tab_teams">职能团队</button>
        <button type="button" class="settings-tab" data-tab="data" onclick="switchSettingsTab('data')" data-i18n="tab_data">数据维护</button>
        <button type="button" class="settings-tab" data-tab="about" onclick="switchSettingsTab('about')" data-i18n="tab_about">版本更新</button>
      </nav>
      <div class="settings-content">
        <section class="settings-pane active" data-pane="basic">
          <div class="settings-title" data-i18n="tab_basic">基础配置</div>
          <div class="field full">
            <label data-i18n="cfg_app_title">系统看板标题</label>
            <input id="cfgAppTitle" value="Team Planner" />
          </div>
          <div class="field full" style="margin-top:12px">
            <label data-i18n="cfg_app_subtitle">副标题</label>
            <input id="cfgAppSubtitle" value="Annual & Monthly Planning Board" />
          </div>
          <div class="field full" style="margin-top:12px">
            <label data-i18n="cfg_logo_url">Logo 外部图片链接</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input id="cfgLogoUrl" type="url" placeholder="https://example.com/logo.png" style="flex:1" />
              <button type="button" onclick="applyLogoUrlFromSettings()" data-i18n="cfg_apply_logo_url">应用链接</button>
            </div>
          </div>
          <div class="field full" style="margin-top:12px">
            <label data-i18n="cfg_logo_upload">或上传本地 Logo（PNG / JPG / SVG / WebP，最大 1 MB）</label>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <button type="button" onclick="openLogoFilePicker()" data-i18n="cfg_pick_logo">选择本地图片</button>
              <button type="button" onclick="clearCustomLogo()" data-i18n="cfg_reset_logo">恢复默认 Logo</button>
              <span id="logoStatus" style="font-size:12px;color:var(--muted)" data-i18n="logo_status_default">当前使用默认 Logo</span>
              <input id="logoFileInput" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none" onchange="handleLogoFile(event)" />
            </div>
          </div>
          <div class="field full" style="margin-top:12px">
            <label data-i18n="cfg_language">界面语言</label>
            <select id="cfgLanguage" style="max-width:220px">
              <option value="zh-CN">简体中文</option>
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </section>
        <section class="settings-pane" data-pane="calendar">
          <div class="settings-title" data-i18n="tab_calendar">日历增强配置</div>
          <label class="setting-check-row"><span data-i18n="cfg_show_lunar">显示农历（月度视图）</span><input id="cfgShowLunar" type="checkbox" /></label>
          <label class="setting-check-row"><span data-i18n="cfg_show_weekend">显示周末灰色背景</span><input id="cfgShowWeekend" type="checkbox" /></label>
          <label class="setting-check-row"><span data-i18n="cfg_show_holidays">显示中国法定假日</span><input id="cfgShowHolidays" type="checkbox" /></label>
          <label class="setting-check-row"><span data-i18n="cfg_show_adjusted">显示调休工作日</span><input id="cfgShowAdjusted" type="checkbox" /></label>
        </section>
        <section class="settings-pane" data-pane="teams">
          <div class="settings-title" data-i18n="tab_teams_desc">职能团队管理（可重命名团队、调整色彩）</div>
          <div id="teamConfigList"></div>
          <button onclick="addNewTeamConfig()" style="margin-top:8px;font-size:12px" data-i18n="cfg_add_team">＋ 添加新职能团队</button>
        </section>
        <section class="settings-pane" data-pane="data">
          <div class="settings-title" data-i18n="tab_data">数据维护</div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button onclick="exportData()" data-i18n="btn_export">导出项目 (.tplanner.json)</button>
            <button onclick="openImportFilePicker()" data-i18n="btn_import">导入项目 (.json / .tplanner.json)</button>
            <button onclick="openRecycleBin()" data-i18n="btn_recycle">回收站</button>
            <button class="danger" onclick="clearAllPlannerData()" data-i18n="btn_reset_all">全面清除数据 / 恢复初始状态</button>
            <input id="jsonFileInput" type="file" accept="application/json,.json,.tplanner.json" style="display:none" onchange="importJSONFile(event)" />
          </div>
        </section>
        <section class="settings-pane" data-pane="about">
          <div class="settings-title" data-i18n="tab_about">版本更新</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.7" data-i18n-html="about_text">
            <b>v1.2</b>：支持简体中文 / 繁体中文 / English 三种界面语言切换。
          </div>
        </section>
      </div>
    </div>
    <div class="actions">
      <button onclick="closeSettings()" data-i18n="btn_cancel">取消</button>
      <button class="primary" onclick="saveSettings()" data-i18n="btn_save_apply">保存并生效</button>
    </div>
  </div>`;
}

function switchSettingsTab(name){
  document.querySelectorAll('.settings-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.settings-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === name));
}
function openSettings(){
  $('cfgAppTitle').value = appTitle;
  $('cfgAppSubtitle').value = appSubtitle;
  $('cfgLogoUrl').value = appLogoType === 'url' ? appLogo : '';
  const cfgLang = $('cfgLanguage'); if (cfgLang) cfgLang.value = currentLang;
  updateLogoStatus();
  $('cfgShowLunar').checked = showLunar; $('cfgShowWeekend').checked = showWeekend;
  $('cfgShowHolidays').checked = showHolidays; $('cfgShowAdjusted').checked = showAdjusted;
  renderTeamConfigList();
  switchSettingsTab('basic');
  $('settingsModal').style.display = 'flex';
}
function closeSettings(){ $('settingsModal').style.display = 'none'; }
function renderTeamConfigList(){
  const container = $('teamConfigList');
  container.innerHTML = teams.map((tm, idx) => `
    <div class="team-config-row">
      <input type="text" id="cfgTeamName_${idx}" value="${tm.name}" />
      <div class="color-picker-wrapper"><input type="color" id="cfgTeamColor_${idx}" value="${tm.color}" /></div>
      <button class="danger" onclick="deleteTeamConfig(${idx})" style="padding:4px 8px">✕</button>
    </div>`).join('');
}
function addNewTeamConfig(){
  const input = prompt(t('prompt_new_team')); if (!input) return;
  const name = input.trim(); if (!name) return;
  if (teams.some(tm => tm.name.toLowerCase() === name.toLowerCase())) return alert(t('alert_team_exists'));
  teams.push({ name, color:'#6366f1', light:false, visible:true }); renderTeamConfigList();
}
function deleteTeamConfig(idx){
  const name = teams[idx].name;
  if (events.some(e => e.team === name) || recycleBin.some(e => e.team === name)) return alert(t('alert_team_in_use'));
  if (confirm(t('confirm_delete_team', { name }))) { teams.splice(idx, 1); renderTeamConfigList(); }
}
function saveSettings(){
  appTitle = $('cfgAppTitle').value.trim() || 'Team Planner';
  appSubtitle = $('cfgAppSubtitle').value.trim();
  const newLang = $('cfgLanguage') ? $('cfgLanguage').value : currentLang;
  const langChanged = newLang !== currentLang;
  currentLang = newLang;
  const topSel = $('langSelect'); if (topSel) topSel.value = currentLang;
  document.documentElement.lang = currentLang;
  showLunar = $('cfgShowLunar').checked; showWeekend = $('cfgShowWeekend').checked;
  showHolidays = $('cfgShowHolidays').checked; showAdjusted = $('cfgShowAdjusted').checked;
  const proposed = teams.map((tm, idx) => {
    const ni = $('cfgTeamName_' + idx), ci = $('cfgTeamColor_' + idx);
    return { ...tm, oldName: tm.name, name: (ni ? ni.value.trim() : '') || tm.name, color: ci ? ci.value : tm.color };
  });
  const keys = proposed.map(tm => tm.name.toLowerCase());
  if (new Set(keys).size !== keys.length) return alert(t('alert_team_dup'));
  proposed.forEach(tm => { if (tm.oldName !== tm.name) { events.forEach(e => { if (e.team === tm.oldName) e.team = tm.name; }); recycleBin.forEach(e => { if (e.team === tm.oldName) e.team = tm.name; }); } });
  teams = proposed.map(({ oldName, ...tm }) => ({ ...tm, light: isColorLight(tm.color) }));
  applyStaticTranslations(); applyBranding(); updateBoldBtnUI(); updateWrapBtnUI(); updateLogoStatus();
  persistProjectCache(); saveTeamsToLocal(); persistEvents();
  closeSettings(); renderTeamToggles(); renderLegend(); render();
  if (langChanged) toast(t('toast_language_changed')); else toast(t('toast_settings_saved'));
}

/* ===================== 品牌 / Logo ===================== */
function applyBranding(){
  const titleEl = $('appMainTitle'), subtitleEl = $('appSubtitle'), imageEl = $('appLogoImage'), fallbackEl = $('appLogoFallback');
  if (titleEl) titleEl.textContent = appTitle || t('app_title_default');
  if (subtitleEl) { subtitleEl.textContent = appSubtitle || ''; subtitleEl.style.display = appSubtitle ? 'block' : 'none'; }
  document.title = (appTitle || 'Team Planner') + ' v1.19 Build 01E';
  if (!imageEl || !fallbackEl) return;
  if (appLogo) {
    imageEl.onload = () => { imageEl.style.display = 'block'; fallbackEl.style.display = 'none'; };
    imageEl.onerror = () => { imageEl.style.display = 'none'; fallbackEl.style.display = 'inline-block'; };
    imageEl.src = appLogo;
  } else { imageEl.removeAttribute('src'); imageEl.style.display = 'none'; fallbackEl.style.display = 'inline-block'; }
}
function updateLogoStatus(){
  const el = $('logoStatus'); if (!el) return;
  el.textContent = !appLogo ? t('logo_status_default') : (appLogoType === 'file' ? t('logo_status_file') : t('logo_status_url'));
}
function openLogoFilePicker(){ const input = $('logoFileInput'); input.value = ''; input.click(); }
function handleLogoFile(ev){
  const file = ev.target.files && ev.target.files[0]; if (!file) return;
  const allowed = ['image/png','image/jpeg','image/svg+xml','image/webp'];
  if (!allowed.includes(file.type)) return alert(t('alert_logo_type'));
  if (file.size > 1024 * 1024) return alert(t('alert_logo_size'));
  const reader = new FileReader();
  reader.onload = () => { appLogo = String(reader.result || ''); appLogoType = 'file'; $('cfgLogoUrl').value = ''; persistBranding(); applyBranding(); updateLogoStatus(); toast(t('toast_logo_file')); };
  reader.onerror = () => alert(t('alert_logo_read_fail'));
  reader.readAsDataURL(file);
}
function applyLogoUrlFromSettings(){
  const raw = $('cfgLogoUrl').value.trim();
  if (!raw) { clearCustomLogo(); return; }
  let parsed; try { parsed = new URL(raw); } catch(e){ return alert(t('alert_logo_url_bad')); }
  if (!['http:','https:'].includes(parsed.protocol)) return alert(t('alert_logo_url_proto'));
  appLogo = raw; appLogoType = 'url'; persistBranding(); applyBranding(); updateLogoStatus(); toast(t('toast_logo_url'));
}
function clearCustomLogo(){ appLogo = ''; appLogoType = ''; if ($('cfgLogoUrl')) $('cfgLogoUrl').value = ''; persistBranding(); applyBranding(); updateLogoStatus(); toast(t('toast_logo_reset')); }
function persistBranding(){ persistProjectCache(); }
function persistAllSettings(){ persistProjectCache(); }

function clearAllPlannerData(){
  if (!confirm(t('confirm_reset_all'))) return;
  const typed = prompt(t('prompt_reset'));
  if (typed !== 'RESET') return alert(t('alert_reset_wrong'));
  Object.keys(localStorage).filter(k => k.startsWith('hr_planner_')).forEach(k => localStorage.removeItem(k));
  location.reload();
}

/* ===================== 持久化旧接口 ===================== */
function saveTeamsToLocal(){ localStorage.setItem(LEGACY_KEYS.teams, JSON.stringify(teams)); }
function persistEvents(){ localStorage.setItem(LEGACY_KEYS.events, JSON.stringify(events)); }

/* ===================== 导出 / 导入 ===================== */
function exportData(){
  persistProjectCache();
  const payload = JSON.parse(JSON.stringify(currentProject));
  payload.metadata.exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = safeProjectFileName(payload.metadata.projectName || appTitle) + '_' + fileTimestamp() + '.tplanner.json';
  a.click(); URL.revokeObjectURL(a.href); toast(t('toast_exported'));
}
function openImportFilePicker(){ const input = $('jsonFileInput'); input.value = ''; input.click(); }
function validateImportedData(data){
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('root must be object');
  const source = data.schemaVersion === SCHEMA_VERSION || data.metadata ? data : { ...data, branding: { title: data.title, subtitle: data.subtitle, logo: data.logo, logoType: data.logoType }, settings: data };
  if (!Array.isArray(source.events)) throw new Error('missing events array');
  if (source.teams !== undefined && !Array.isArray(source.teams)) throw new Error('teams must be array');
  const target = migrateTeams(source.teams || teams), names = new Set(target.map(tm => tm.name.toLowerCase())), ids = new Set();
  source.events.forEach((e, i) => {
    const row = i + 1;
    if (!e || typeof e !== 'object') throw new Error(`item ${row} not object`);
    if (e.id === undefined || e.id === null || e.id === '') throw new Error(`item ${row} missing id`);
    if (ids.has(String(e.id))) throw new Error(`duplicate id ${e.id}`);
    ids.add(String(e.id));
    if (typeof e.title !== 'string' || !e.title.trim()) throw new Error(`item ${row} missing title`);
    const tm = normalizeTeamName(e.team, target);
    if (!names.has(tm.toLowerCase())) throw new Error(`item ${row} team ${e.team || '(empty)'} not found`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(e.end || '')) throw new Error(`item ${row} date format must be YYYY-MM-DD`);
    if (e.end < e.start) throw new Error(`item ${row} end before start`);
  });
  return true;
}
async function importJSONFile(ev){
  const file = ev.target.files && ev.target.files[0]; if (!file) return;
  const lower = file.name.toLowerCase();
  if (!(lower.endsWith('.json') || lower.endsWith('.tplanner.json'))) return alert(t('alert_import_type'));
  if (file.size > 5 * 1024 * 1024) return alert(t('alert_import_size'));
  const backup = JSON.parse(JSON.stringify(currentProject));
  try {
    const raw = JSON.parse(await file.text());
    validateImportedData(raw);
    const imported = normalizeProject(raw);
    validateImportedData(imported);
    currentProject = imported; teams = currentProject.teams; events = currentProject.events;
    recycleBin = currentProject.recycleBin; lastDeletedEvent = recycleBin.length ? recycleBin[recycleBin.length - 1] : null;
    appTitle = currentProject.branding.title; appSubtitle = currentProject.branding.subtitle;
    appLogo = currentProject.branding.logo; appLogoType = currentProject.branding.logoType;
    currentColWidth = currentProject.settings.colWidth; currentFontSize = currentProject.settings.fontSize;
    isWrapMode = currentProject.settings.isWrapMode; isBoldMode = currentProject.settings.isBoldMode;
    showLunar = currentProject.settings.showLunar; showWeekend = currentProject.settings.showWeekend;
    showHolidays = currentProject.settings.showHolidays; showAdjusted = currentProject.settings.showAdjusted;
    currentLang = currentProject.settings.language || 'zh-CN';
    document.documentElement.lang = currentLang;
    const topSel = $('langSelect'); if (topSel) topSel.value = currentLang;
    persistProjectCache(); applyBranding(); applyStaticTranslations();
    applyColWidth(currentColWidth); applyFontSize(currentFontSize);
    updateWrapBtnUI(); updateBoldBtnUI(); updateRecycleCount(); closeSettings();
    renderTeamToggles(); renderLegend(); render();
    toast(t('toast_import_ok', { n: events.length }));
  } catch(err) {
    currentProject = normalizeProject(backup); teams = currentProject.teams; events = currentProject.events;
    recycleBin = currentProject.recycleBin; appTitle = currentProject.branding.title;
    appSubtitle = currentProject.branding.subtitle; appLogo = currentProject.branding.logo;
    appLogoType = currentProject.branding.logoType;
    alert(t('alert_import_fail', { msg: err.message || 'invalid project' }));
  }
}

/* ===================== Outlook ===================== */
function addCurrentEventToOutlook(){
  const item = events.find(e => e.id === editId); if (!item) return toast(t('toast_need_title_dates'));
  const endExclusive = addDaysToPlannerDate(item.end, 1);
  const body = ['Source: Team Planner', 'Team: ' + (item.team || ''), 'Status: ' + (item.status === 'confirmed' ? 'Confirmed' : 'Planned'), 'Owner: ' + (item.owner || ''), item.notes ? 'Notes: ' + item.notes : ''].filter(Boolean).join('\n');
  const params = new URLSearchParams({ path:'/calendar/action/compose', rru:'addevent', subject:item.title, startdt:item.start + 'T00:00:00', enddt:endExclusive + 'T00:00:00', allday:'true', body, location:item.location || '' });
  const url = 'https://outlook.office.com/calendar/deeplink/compose?' + params.toString();
  const popup = window.open(url, '_blank', 'noopener,noreferrer'); if (!popup) location.href = url;
  toast(t('toast_outlook'));
}

/* ===================== Toast ===================== */
function toast(msg){ const el = $('toast'); el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); }

/* ===================== 弹窗背景点击关闭 ===================== */
function bindModalBackdrops(){
  $('modalBack').addEventListener('click', e => { if (e.target === $('modalBack')) closeModal(); });
  $('settingsModal').addEventListener('click', e => { if (e.target === $('settingsModal')) closeSettings(); });
  $('recycleModal').addEventListener('click', e => { if (e.target === $('recycleModal')) closeRecycleBin(); });
}

/* ===================== RECOVERY_MANAGER_BUILD_01E ===================== */
let recoverySaveTimer = null, recoveryDirty = false, recoveryChangeCount = 0, lastSnapshotAt = 0, suppressRecoveryTracking = false;

function recoveryNow(){ return new Date().toISOString(); }
function recoveryClone(value){ return JSON.parse(JSON.stringify(value)); }
function recoveryMeta(){ try { return JSON.parse(localStorage.getItem(RECOVERY_META_KEY) || '{}') || {}; } catch(e){ return {}; } }
function writeRecoveryMeta(patch){ const next = { ...recoveryMeta(), ...patch }; localStorage.setItem(RECOVERY_META_KEY, JSON.stringify(next)); return next; }
function recoveryProjectName(project = currentProject){ return project?.metadata?.projectName || project?.branding?.title || 'Team Planner Project'; }
function recoveryTimeText(value){ if (!value) return '--'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(currentLang, { hour12:false }); }
function updateRecoveryStatus(mode = 'saved', text){
  const dot = document.getElementById('recoveryDot');
  const label = document.getElementById('recoveryStatusText');
  if (dot) dot.className = 'recovery-dot' + (mode === 'dirty' ? ' dirty' : mode === 'warning' ? ' warning' : '');
  if (label) label.textContent = text || t('recovery_saved');
}
function buildRecoveryEnvelope(reason = 'change'){ syncProjectModel(); return { format:'TeamPlannerRecovery/1.19', savedAt:recoveryNow(), reason, project:recoveryClone(currentProject) }; }
function writeRecoveryCache(reason = 'change'){
  if (suppressRecoveryTracking) return;
  try {
    const envelope = buildRecoveryEnvelope(reason);
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(envelope));
    localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify(envelope.project));
    recoveryDirty = false;
    writeRecoveryMeta({ lastRecoveryAt:envelope.savedAt, changeCount:recoveryChangeCount });
    updateRecoveryStatus('saved', t('recovery_saved'));
    maybeCreateSnapshot(envelope); evaluateBackupReminder();
  } catch(err) { updateRecoveryStatus('warning', t('recovery_cache_broken')); console.error('Recovery save failed', err); }
}
function scheduleRecoverySave(reason = 'change'){
  if (suppressRecoveryTracking) return;
  recoveryDirty = true; recoveryChangeCount += 1; updateRecoveryStatus('dirty', '...');
  clearTimeout(recoverySaveTimer);
  recoverySaveTimer = setTimeout(() => writeRecoveryCache(reason), RECOVERY_DEBOUNCE_MS);
}
function createSnapshot(envelope = buildRecoveryEnvelope('snapshot')){
  const snapshots = loadSnapshots();
  const entry = { format:'TeamPlannerSnapshot/1.19', savedAt:envelope.savedAt || recoveryNow(), project:recoveryClone(envelope.project) };
  snapshots.unshift(entry);
  snapshots.slice(0, SNAPSHOT_COUNT).forEach((item, index) => localStorage.setItem(SNAPSHOT_PREFIX + (index + 1), JSON.stringify(item)));
  for (let i = snapshots.length + 1; i <= SNAPSHOT_COUNT; i++) localStorage.removeItem(SNAPSHOT_PREFIX + i);
  lastSnapshotAt = Date.now(); writeRecoveryMeta({ lastSnapshotAt:entry.savedAt });
}
function maybeCreateSnapshot(envelope){
  const meta = recoveryMeta();
  const previous = Date.parse(meta.lastSnapshotAt || 0) || lastSnapshotAt || 0;
  if (Date.now() - previous >= SNAPSHOT_INTERVAL_MS) createSnapshot(envelope);
}
function loadSnapshots(){
  const list = [];
  for (let i = 1; i <= SNAPSHOT_COUNT; i++) {
    try { const value = JSON.parse(localStorage.getItem(SNAPSHOT_PREFIX + i) || 'null'); if (value?.project) list.push(value); } catch(e){}
  }
  return list.sort((a, b) => Date.parse(b.savedAt || 0) - Date.parse(a.savedAt || 0));
}
function readRecoveryEnvelope(){
  const raw = localStorage.getItem(RECOVERY_KEY);
  if (!raw) return { state:'missing' };
  try {
    const value = JSON.parse(raw);
    if (!value?.project) throw new Error('no project');
    validateImportedData(value.project);
    return { state:'valid', value };
  } catch(error){ return { state:'corrupt', error }; }
}
function applyRecoveredProject(project, sourceLabel){
  suppressRecoveryTracking = true;
  try {
    const restored = normalizeProject(recoveryClone(project));
    validateImportedData(restored);
    currentProject = restored; teams = restored.teams; events = restored.events; recycleBin = restored.recycleBin || [];
    lastDeletedEvent = recycleBin.length ? recycleBin[recycleBin.length - 1] : null;
    appTitle = restored.branding.title; appSubtitle = restored.branding.subtitle; appLogo = restored.branding.logo; appLogoType = restored.branding.logoType;
    currentColWidth = restored.settings.colWidth; currentFontSize = restored.settings.fontSize;
    isWrapMode = restored.settings.isWrapMode; isBoldMode = restored.settings.isBoldMode;
    showLunar = restored.settings.showLunar; showWeekend = restored.settings.showWeekend;
    showHolidays = restored.settings.showHolidays; showAdjusted = restored.settings.showAdjusted;
    currentLang = restored.settings.language || 'zh-CN'; document.documentElement.lang = currentLang;
    const topSel = document.getElementById('langSelect'); if (topSel) topSel.value = currentLang;
    applyBranding(); applyStaticTranslations(); applyColWidth(currentColWidth); applyFontSize(currentFontSize);
    updateWrapBtnUI(); updateBoldBtnUI(); updateRecycleCount(); renderTeamToggles(); renderLegend(); render();
    localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify(currentProject));
  } finally { suppressRecoveryTracking = false; }
  writeRecoveryCache('restored'); closeRecoveryPanel(); toast(t('recovery_from', { src: sourceLabel }));
}
function openRecoveryPanel(title, message, items){
  document.getElementById('recoveryPanelTitle').textContent = title;
  document.getElementById('recoveryPanelMessage').textContent = message;
  const list = document.getElementById('recoveryList'); list.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('div'); row.className = 'recovery-item';
    const main = document.createElement('div'); main.className = 'recovery-item-main';
    main.innerHTML = '<div class="recovery-item-title"></div><div class="recovery-item-meta"></div>';
    main.querySelector('.recovery-item-title').textContent = item.title;
    main.querySelector('.recovery-item-meta').textContent = item.meta;
    const button = document.createElement('button'); button.className = 'primary'; button.textContent = t('recycle_restore'); button.onclick = item.onRestore;
    row.append(main, button); list.appendChild(row);
  });
  document.getElementById('recoveryPanel').style.display = 'flex';
}
function closeRecoveryPanel(){ document.getElementById('recoveryPanel').style.display = 'none'; }
function detectRecoveryAtStartup(){
  const recovery = readRecoveryEnvelope();
  const snapshots = loadSnapshots();
  const currentModified = Date.parse(currentProject?.metadata?.modifiedAt || 0) || 0;
  if (recovery.state === 'valid') {
    const recoveryModified = Date.parse(recovery.value.project?.metadata?.modifiedAt || recovery.value.savedAt || 0) || 0;
    if (recoveryModified > currentModified + 1000) {
      openRecoveryPanel(t('recovery_new_found'), t('recovery_new_desc'), [{ title:recoveryProjectName(recovery.value.project), meta:t('recovery_saved_at', { time:recoveryTimeText(recovery.value.savedAt) }), onRestore:() => applyRecoveredProject(recovery.value.project, t('recovery_point')) }]);
      return;
    }
  }
  if (recovery.state === 'corrupt' && snapshots.length) {
    openRecoveryPanel(t('recovery_corrupt'), t('recovery_corrupt_desc'), snapshots.map((s, i) => ({ title:recoveryProjectName(s.project), meta:t('recovery_snapshot') + ' ' + (i + 1) + ' · ' + t('recovery_saved_at', { time:recoveryTimeText(s.savedAt) }), onRestore:() => applyRecoveredProject(s.project, t('recovery_snapshot')) })));
  } else if (recovery.state === 'corrupt') {
    updateRecoveryStatus('warning', t('recovery_cache_broken'));
  }
}
function evaluateBackupReminder(){
  const meta = recoveryMeta();
  const lastExport = Date.parse(meta.lastExportAt || 0) || 0;
  const dueByChanges = recoveryChangeCount >= EXPORT_REMINDER_CHANGES;
  const dueByTime = !lastExport || Date.now() - lastExport >= EXPORT_REMINDER_MS;
  const dismissedUntil = Date.parse(meta.reminderDismissedUntil || 0) || 0;
  const banner = document.getElementById('backupReminderBanner'); if (!banner) return;
  const shouldShow = (dueByChanges || dueByTime) && Date.now() > dismissedUntil;
  banner.classList.toggle('show', shouldShow);
  if (shouldShow) {
    document.getElementById('backupReminderText').textContent = dueByChanges ? t('backup_due_changes') : t('backup_due_time');
  }
}
function dismissBackupReminder(){
  writeRecoveryMeta({ reminderDismissedUntil: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() });
  document.getElementById('backupReminderBanner')?.classList.remove('show');
}
function recordSuccessfulExport(){
  recoveryChangeCount = 0;
  writeRecoveryMeta({ lastExportAt:recoveryNow(), changeCount:0, reminderDismissedUntil:null });
  document.getElementById('backupReminderBanner')?.classList.remove('show');
}
function flushRecoveryBeforeExit(){ if (recoveryDirty) { clearTimeout(recoverySaveTimer); writeRecoveryCache('page-exit'); } }

/* ---- 拦截持久化以记录恢复点 ---- */
const originalPersistProjectCache = persistProjectCache;
persistProjectCache = function(){ scheduleRecoverySave('project-change'); };
saveTeamsToLocal = function(){ scheduleRecoverySave('team-change'); };
persistEvents = function(){ scheduleRecoverySave('event-change'); };
persistBranding = function(){ scheduleRecoverySave('branding-change'); };
persistAllSettings = function(){ scheduleRecoverySave('settings-change'); };
const originalExportData = exportData;
exportData = function(){ flushRecoveryBeforeExit(); originalExportData(); recordSuccessfulExport(); };
window.addEventListener('beforeunload', flushRecoveryBeforeExit);
setInterval(() => { if (recoveryDirty) writeRecoveryCache('interval'); else maybeCreateSnapshot(buildRecoveryEnvelope('scheduled-snapshot')); }, SNAPSHOT_INTERVAL_MS);
setTimeout(() => {
  const meta = recoveryMeta();
  recoveryChangeCount = Number(meta.changeCount) || 0;
  detectRecoveryAtStartup();
  evaluateBackupReminder();
  if (!localStorage.getItem(RECOVERY_KEY)) writeRecoveryCache('initial');
}, 0);

/* ===================== 启动 ===================== */
buildEventModal();
buildSettingsModal();
bindModalBackdrops();
init();