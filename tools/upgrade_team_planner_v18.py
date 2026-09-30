from pathlib import Path
import re
import shutil
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('index.html')
if not path.exists():
    raise SystemExit(f'未找到文件: {path.resolve()}')

text = path.read_text(encoding='utf-8')
backup = path.with_name(path.stem + '.before-v18' + path.suffix)
shutil.copy2(path, backup)

# 1) Header: restore a safe title element and add configurable logo slots.
header_pattern = re.compile(r'<header>\s*<div class="logo-box">.*?</div>\s*<div class="spacer"></div>', re.S)
header_replacement = '''<header>
  <div class="logo-box" id="appLogoBox">
    <img id="appLogoImage" alt="Planner Logo" style="display:none" />
    <span id="appLogoFallback" style="background:#2563eb;color:white;font-weight:800;padding:6px 12px;border-radius:4px">TP</span>
  </div>
  <div class="header-title-box">
    <div class="title" id="appMainTitle">Team Planner</div>
    <div class="subtitle" id="appSubtitle">Annual & Monthly Planning Board</div>
  </div>
  <div class="spacer"></div>'''
text, n = header_pattern.subn(header_replacement, text, count=1)
if n != 1:
    raise SystemExit('升级停止：未能定位 header 区域，原文件未被覆盖。')

# 2) Add branding fields under title setting.
old_title_field = '''<div class="field full">
        <label>系统看板标题</label>
        <input id="cfgAppTitle" value="Team Planner" />
      </div>'''
new_title_field = '''<div class="field full">
        <label>系统看板标题</label>
        <input id="cfgAppTitle" value="Team Planner" placeholder="例如 Team Planner" />
      </div>
      <div class="field full">
        <label>副标题</label>
        <input id="cfgAppSubtitle" value="Annual & Monthly Planning Board" placeholder="可留空" />
      </div>
      <div class="field full">
        <label>Logo 外部图片链接</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="cfgLogoUrl" type="url" placeholder="https://example.com/logo.png" style="flex:1" />
          <button type="button" onclick="applyLogoUrlFromSettings()">应用链接</button>
        </div>
      </div>
      <div class="field full">
        <label>或上传本地 Logo（PNG / JPG / SVG / WebP，最大 1 MB）</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button type="button" onclick="openLogoFilePicker()">选择本地图片</button>
          <button type="button" onclick="clearCustomLogo()">恢复默认 Logo</button>
          <span id="logoStatus" style="font-size:12px;color:var(--muted)">当前使用默认 Logo</span>
          <input id="logoFileInput" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none" onchange="handleLogoFile(event)" />
        </div>
      </div>'''
if old_title_field not in text:
    raise SystemExit('升级停止：未能定位基础配置标题字段，原文件未被覆盖。')
text = text.replace(old_title_field, new_title_field, 1)

# 3) Add reset buttons to data maintenance.
old_data_buttons = '''<button onclick="openRecycleBin()">回收站 <span id="recycleCount"></span></button>
        <input id="jsonFileInput" type="file" accept="application/json,.json" style="display:none" onchange="importJSONFile(event)" />'''
new_data_buttons = '''<button onclick="openRecycleBin()">回收站 <span id="recycleCount"></span></button>
        <button class="danger" onclick="clearAllPlannerData()">全面清除数据 / 恢复初始状态</button>
        <input id="jsonFileInput" type="file" accept="application/json,.json" style="display:none" onchange="importJSONFile(event)" />'''
if old_data_buttons not in text:
    raise SystemExit('升级停止：未能定位数据维护按钮，原文件未被覆盖。')
text = text.replace(old_data_buttons, new_data_buttons, 1)

# 4) Branding state.
old_title_var = "let appTitle = localStorage.getItem('hr_planner_title_global') || localStorage.getItem('hr_planner_title_v13') || 'Team Planner';"
new_title_var = """let appTitle = localStorage.getItem('hr_planner_title_global') || localStorage.getItem('hr_planner_title_v13') || 'Team Planner';
let appSubtitle = localStorage.getItem('hr_planner_subtitle_global') || 'Annual & Monthly Planning Board';
let appLogo = localStorage.getItem('hr_planner_logo_global') || '';
let appLogoType = localStorage.getItem('hr_planner_logo_type_global') || '';"""
if old_title_var not in text:
    raise SystemExit('升级停止：未能定位 appTitle，原文件未被覆盖。')
text = text.replace(old_title_var, new_title_var, 1)

# 5) Fix null error at startup and apply branding.
text = text.replace("  $('appMainTitle').textContent = appTitle;", "  applyBranding();", 1)

# 6) Settings open fields.
old_open_settings = """function openSettings() {
  $('cfgAppTitle').value = appTitle;
  $('cfgShowLunar').checked = showLunar;"""
new_open_settings = """function openSettings() {
  $('cfgAppTitle').value = appTitle;
  $('cfgAppSubtitle').value = appSubtitle;
  $('cfgLogoUrl').value = appLogoType === 'url' ? appLogo : '';
  updateLogoStatus();
  $('cfgShowLunar').checked = showLunar;"""
if old_open_settings not in text:
    raise SystemExit('升级停止：未能定位 openSettings，原文件未被覆盖。')
text = text.replace(old_open_settings, new_open_settings, 1)

# 7) Save settings safely and persist branding.
old_save_start = """function saveSettings() {
  appTitle=$('cfgAppTitle').value.trim()||'Team Planner';$('appMainTitle').textContent=appTitle;
  showLunar=$('cfgShowLunar').checked;"""
new_save_start = """function saveSettings() {
  appTitle=$('cfgAppTitle').value.trim()||'Team Planner';
  appSubtitle=$('cfgAppSubtitle').value.trim();
  applyBranding();
  showLunar=$('cfgShowLunar').checked;"""
if old_save_start not in text:
    raise SystemExit('升级停止：未能定位 saveSettings 开头，原文件未被覆盖。')
text = text.replace(old_save_start, new_save_start, 1)

old_persist_line = "localStorage.setItem('hr_planner_title_global',appTitle);localStorage.setItem('hr_planner_show_lunar_global',showLunar);"
new_persist_line = "localStorage.setItem('hr_planner_title_global',appTitle);localStorage.setItem('hr_planner_subtitle_global',appSubtitle);localStorage.setItem('hr_planner_logo_global',appLogo);localStorage.setItem('hr_planner_logo_type_global',appLogoType);localStorage.setItem('hr_planner_show_lunar_global',showLunar);"
if old_persist_line not in text:
    raise SystemExit('升级停止：未能定位设置持久化代码，原文件未被覆盖。')
text = text.replace(old_persist_line, new_persist_line, 1)

# 8) Export branding data.
old_export = "title:appTitle,teams:teams.map"
new_export = "title:appTitle,subtitle:appSubtitle,logo:appLogo,logoType:appLogoType,teams:teams.map"
if old_export not in text:
    raise SystemExit('升级停止：未能定位导出数据结构，原文件未被覆盖。')
text = text.replace(old_export, new_export, 1)

# 9) Fix import transaction and null title. Also import visual settings when present.
old_import_backup = "const backup={events:JSON.parse(JSON.stringify(events)),teams:JSON.parse(JSON.stringify(teams)),title:appTitle};try{events=normalizedEvents;teams=targetTeams;if(typeof data.title==='string'&&data.title.trim())appTitle=data.title.trim();persistEvents();saveTeamsToLocal();localStorage.setItem('hr_planner_title_global',appTitle);$('appMainTitle').textContent=appTitle;closeSettings();renderTeamToggles();renderLegend();render();toast(`JSON导入成功：${events.length}项排期`);}catch(err){events=backup.events;teams=backup.teams;appTitle=backup.title;persistEvents();saveTeamsToLocal();throw err;}"
new_import_backup = """const backup={events:JSON.parse(JSON.stringify(events)),teams:JSON.parse(JSON.stringify(teams)),title:appTitle,subtitle:appSubtitle,logo:appLogo,logoType:appLogoType};try{
      events=normalizedEvents;teams=targetTeams;
      if(typeof data.title==='string'&&data.title.trim())appTitle=data.title.trim();
      if(typeof data.subtitle==='string')appSubtitle=data.subtitle.trim();
      if(typeof data.logo==='string'){appLogo=data.logo;appLogoType=data.logoType==='file'?'file':(data.logo?'url':'');}
      if(Number.isFinite(Number(data.colWidth)))currentColWidth=Math.min(80,Math.max(34,Number(data.colWidth)));
      if(Number.isFinite(Number(data.fontSize)))currentFontSize=Math.min(14,Math.max(9,Number(data.fontSize)));
      if(typeof data.isWrapMode==='boolean')isWrapMode=data.isWrapMode;
      if(typeof data.isBoldMode==='boolean')isBoldMode=data.isBoldMode;
      if(typeof data.showLunar==='boolean')showLunar=data.showLunar;
      if(typeof data.showWeekend==='boolean')showWeekend=data.showWeekend;
      if(typeof data.showHolidays==='boolean')showHolidays=data.showHolidays;
      if(typeof data.showAdjusted==='boolean')showAdjusted=data.showAdjusted;
      persistEvents();saveTeamsToLocal();persistAllSettings();applyBranding();applyColWidth(currentColWidth);applyFontSize(currentFontSize);updateWrapBtnUI();updateBoldBtnUI();closeSettings();renderTeamToggles();renderLegend();render();toast(`JSON导入成功：${events.length}项排期`);
    }catch(err){events=backup.events;teams=backup.teams;appTitle=backup.title;appSubtitle=backup.subtitle;appLogo=backup.logo;appLogoType=backup.logoType;persistEvents();saveTeamsToLocal();applyBranding();throw err;}"""
if old_import_backup not in text:
    raise SystemExit('升级停止：未能定位 JSON 导入事务代码，原文件未被覆盖。')
text = text.replace(old_import_backup, new_import_backup, 1)

# 10) Insert helper functions before isColorLight.
marker = "function isColorLight(hex) {"
helpers = r'''function applyBranding() {
  const titleEl = $('appMainTitle');
  const subtitleEl = $('appSubtitle');
  const imageEl = $('appLogoImage');
  const fallbackEl = $('appLogoFallback');
  if (titleEl) titleEl.textContent = appTitle || 'Team Planner';
  if (subtitleEl) {
    subtitleEl.textContent = appSubtitle || '';
    subtitleEl.style.display = appSubtitle ? 'block' : 'none';
  }
  document.title = (appTitle || 'Team Planner') + ' V18';
  if (!imageEl || !fallbackEl) return;
  if (appLogo) {
    imageEl.onload = () => { imageEl.style.display='block'; fallbackEl.style.display='none'; };
    imageEl.onerror = () => { imageEl.style.display='none'; fallbackEl.style.display='inline-block'; };
    imageEl.src = appLogo;
  } else {
    imageEl.removeAttribute('src');
    imageEl.style.display='none';
    fallbackEl.style.display='inline-block';
  }
}
function updateLogoStatus() {
  const el=$('logoStatus'); if(!el)return;
  el.textContent=!appLogo?'当前使用默认 Logo':(appLogoType==='file'?'当前使用本地上传 Logo':'当前使用外部链接 Logo');
}
function openLogoFilePicker(){const input=$('logoFileInput');input.value='';input.click();}
function handleLogoFile(ev){
  const file=ev.target.files&&ev.target.files[0];if(!file)return;
  const allowed=['image/png','image/jpeg','image/svg+xml','image/webp'];
  if(!allowed.includes(file.type))return alert('仅支持 PNG、JPG、SVG 或 WebP 图片。');
  if(file.size>1024*1024)return alert('Logo 文件不能超过 1 MB。');
  const reader=new FileReader();
  reader.onload=()=>{appLogo=String(reader.result||'');appLogoType='file';$('cfgLogoUrl').value='';persistBranding();applyBranding();updateLogoStatus();toast('本地 Logo 已应用');};
  reader.onerror=()=>alert('Logo 读取失败，请重新选择图片。');
  reader.readAsDataURL(file);
}
function applyLogoUrlFromSettings(){
  const raw=$('cfgLogoUrl').value.trim();
  if(!raw){clearCustomLogo();return;}
  let parsed;try{parsed=new URL(raw);}catch(e){return alert('请输入有效的图片链接。');}
  if(!['http:','https:'].includes(parsed.protocol))return alert('Logo 链接仅支持 http 或 https。');
  appLogo=raw;appLogoType='url';persistBranding();applyBranding();updateLogoStatus();toast('外部 Logo 链接已应用');
}
function clearCustomLogo(){appLogo='';appLogoType='';if($('cfgLogoUrl'))$('cfgLogoUrl').value='';persistBranding();applyBranding();updateLogoStatus();toast('已恢复默认 Logo');}
function persistBranding(){
  localStorage.setItem('hr_planner_title_global',appTitle);
  localStorage.setItem('hr_planner_subtitle_global',appSubtitle);
  localStorage.setItem('hr_planner_logo_global',appLogo);
  localStorage.setItem('hr_planner_logo_type_global',appLogoType);
}
function persistAllSettings(){
  persistBranding();
  localStorage.setItem('hr_planner_colwidth_global',String(currentColWidth));
  localStorage.setItem('hr_planner_fontsize_global',String(currentFontSize));
  localStorage.setItem('hr_planner_wrapmode_global',String(isWrapMode));
  localStorage.setItem('hr_planner_boldmode_global',String(isBoldMode));
  localStorage.setItem('hr_planner_show_lunar_global',String(showLunar));
  localStorage.setItem('hr_planner_show_weekend_global',String(showWeekend));
  localStorage.setItem('hr_planner_show_holidays_global',String(showHolidays));
  localStorage.setItem('hr_planner_show_adjusted_global',String(showAdjusted));
}
function clearAllPlannerData(){
  const first=confirm('此操作将永久清除全部排期、团队设置、回收站、标题、Logo 和显示偏好。是否继续？');
  if(!first)return;
  const typed=prompt('请输入 RESET 确认全面清除：');
  if(typed!=='RESET')return alert('输入不正确，未清除任何数据。');
  Object.keys(localStorage).filter(k=>k.startsWith('hr_planner_')).forEach(k=>localStorage.removeItem(k));
  location.reload();
}

'''
if marker not in text:
    raise SystemExit('升级停止：未能定位辅助函数插入点，原文件未被覆盖。')
text = text.replace(marker, helpers + marker, 1)

# Update version labels.
text = text.replace('<title>Team Planner V17</title>', '<title>Team Planner V18</title>', 1)
text = text.replace('<b>V17 Outlook</b>：保留 V17 Fixed UI，增加单个排期预填到 Outlook 日历功能。', '<b>V18</b>：修复 JSON 导入；增加全面重置；支持标题、副标题及本地/外部 Logo。', 1)
text = text.replace("schemaVersion:'HRPlannerFullConfig/17.0'", "schemaVersion:'TeamPlannerFullConfig/18.0'", 1)
text = text.replace("version:'17.0'", "version:'18.0'", 1)
text = text.replace("toast('已导出V17全量配置')", "toast('已导出 V18 全量配置')", 1)

path.write_text(text, encoding='utf-8', newline='\n')
print(f'[OK] 已升级: {path.resolve()}')
print(f'[OK] 已备份: {backup.resolve()}')
