from pathlib import Path
import re
import shutil
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('index.html')
if not path.exists():
    raise SystemExit(f'未找到文件: {path.resolve()}')

text = path.read_text(encoding='utf-8')
if 'Team Planner V18' not in text and "V18</b>" not in text:
    raise SystemExit('当前文件不像已验证的 V18，已停止修改。')

backup = path.with_name(path.stem + '.before-v1.19-build01' + path.suffix)
shutil.copy2(path, backup)

# Version labels
text = text.replace('<title>Team Planner V18</title>', '<title>Team Planner v1.19 Build 01</title>', 1)
text = text.replace("document.title = (appTitle || 'Team Planner') + ' V18';", "document.title = (appTitle || 'Team Planner') + ' v1.19';", 1)
text = text.replace('<b>V18</b>：修复 JSON 导入；增加全面重置；支持标题、副标题及本地/外部 Logo。', '<b>v1.19 Build 01</b>：项目数据与程序分离；支持新建、打开、保存和另存项目文件。', 1)

# Header project status and direct project actions
old_header_buttons = '''<button id="undoDeleteBtn" class="icon-btn" onclick="undoDelete()" style="display:none">↩ 撤销删除</button>
  <button class="icon-btn" onclick="openSettings()"><span style="font-size:14px">⚙️</span> 系统设置</button>
  <button class="primary" onclick="openModal()">＋ 新建计划</button>'''
new_header_buttons = '''<div id="projectFileStatus" style="font-size:12px;color:var(--muted);text-align:right;line-height:1.35">
    <div id="projectFileName">未关联项目文件</div>
    <div id="projectDirtyStatus">● 当前为空项目</div>
  </div>
  <button id="undoDeleteBtn" class="icon-btn" onclick="undoDelete()" style="display:none">↩ 撤销删除</button>
  <button class="icon-btn" onclick="openProjectFilePicker()">📂 打开项目</button>
  <button class="icon-btn" onclick="saveProject()">💾 保存项目</button>
  <button class="icon-btn" onclick="openSettings()"><span style="font-size:14px">⚙️</span> 系统设置</button>
  <button class="primary" onclick="openModal()">＋ 新建计划</button>'''
if old_header_buttons not in text:
    raise SystemExit('未找到页眉按钮区域，未修改原文件。')
text = text.replace(old_header_buttons, new_header_buttons, 1)

# Replace data maintenance area with project management actions
old_data = '''<button onclick="exportData()">导出全量配置与排期 (JSON)</button>
        <button onclick="openImportFilePicker()">导入排期文件 (JSON)</button>
        <button onclick="openRecycleBin()">回收站 <span id="recycleCount"></span></button>
        <button class="danger" onclick="clearAllPlannerData()">全面清除数据 / 恢复初始状态</button>
        <input id="jsonFileInput" type="file" accept="application/json,.json" style="display:none" onchange="importJSONFile(event)" />'''
new_data = '''<button onclick="newProject()">新建空白项目</button>
        <button onclick="openProjectFilePicker()">打开项目文件</button>
        <button onclick="saveProject()">保存项目</button>
        <button onclick="saveProjectAs()">另存项目</button>
        <button onclick="openRecycleBin()">回收站 <span id="recycleCount"></span></button>
        <button class="danger" onclick="clearAllPlannerData()">全面清除当前项目</button>
        <input id="jsonFileInput" type="file" accept="application/json,.json,.tplanner" style="display:none" onchange="importJSONFile(event)" />'''
if old_data not in text:
    raise SystemExit('未找到 V18 数据维护区域，未修改原文件。')
text = text.replace(old_data, new_data, 1)

# Replace state initialization: no browser storage as source of truth.
start = text.find("let teams=migrateTeams(")
end_marker = "const $ = id => document.getElementById(id);"
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('未找到 V18 状态初始化区域，未修改原文件。')
replacement = '''let teams=migrateTeams(defaultTeams);
let events=[];
let appTitle='Team Planner';
let appSubtitle='Annual & Monthly Planning Board';
let appLogo='';
let appLogoType='';
let currentColWidth=48;
let currentFontSize=11;
let isWrapMode=false;
let isBoldMode=true;
let showLunar=false;
let showWeekend=true;
let showHolidays=true;
let showAdjusted=true;
let view='month', year=new Date().getFullYear(), currentMonth=new Date().getMonth(), editId=null;
let recycleBin=[];
let lastDeletedEvent=null;
let currentProjectHandle=null;
let currentProjectFileName='';
let projectDirty=false;
let projectCreatedAt=new Date().toISOString();
let projectUpdatedAt=projectCreatedAt;
const $ = id => document.getElementById(id);'''
text = text[:start] + replacement + text[end + len(end_marker):]

# Enhance init status.
text = text.replace('  updateRecycleCount();\n}', '  updateRecycleCount();\n  updateProjectStatus();\n}', 1)

# Replace persistence functions and export/import block completely.
block_start = text.find('function saveTeamsToLocal() {')
block_end = text.find('function addDaysToPlannerDate(', block_start)
if block_start < 0 or block_end < 0:
    raise SystemExit('未找到 V18 数据读写函数区域，未修改原文件。')

project_code = r'''function markProjectDirty(){
  projectDirty=true;
  projectUpdatedAt=new Date().toISOString();
  updateProjectStatus();
}
function updateProjectStatus(){
  const nameEl=$('projectFileName'),statusEl=$('projectDirtyStatus');
  if(nameEl)nameEl.textContent=currentProjectFileName||'未关联项目文件';
  if(statusEl){statusEl.textContent=projectDirty?'● 有未保存修改':'● 已保存';statusEl.style.color=projectDirty?'#b45309':'#15803d';}
}
function saveTeamsToLocal(){markProjectDirty();}
function persistEvents(){markProjectDirty();}
function persistBranding(){markProjectDirty();}
function persistAllSettings(){markProjectDirty();}
function buildProjectPayload(){
  return {
    schemaVersion:'TeamPlannerProject/1.19',
    metadata:{
      projectName:(currentProjectFileName||appTitle||'Team Planner').replace(/\.tplanner\.json$/i,''),
      createdAt:projectCreatedAt,
      updatedAt:new Date().toISOString(),
      applicationVersion:'1.19 Build 01'
    },
    branding:{title:appTitle,subtitle:appSubtitle,logo:appLogo,logoType:appLogoType},
    settings:{colWidth:currentColWidth,fontSize:currentFontSize,isWrapMode,isBoldMode,showLunar,showWeekend,showHolidays,showAdjusted,year,currentMonth,view},
    teams:teams.map(({name,color,light,visible})=>({name,color,light,visible})),
    events:events.map(e=>({...e,team:normalizeTeamName(e.team,teams)})),
    recycleBin:recycleBin.map(e=>({...e,team:normalizeTeamName(e.team,teams)}))
  };
}
function validateImportedData(data){
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('文件根节点必须是 JSON 对象');
  const source=data.schemaVersion&&String(data.schemaVersion).startsWith('TeamPlannerProject/')?data:{
    schemaVersion:'TeamPlannerProject/1.19',
    metadata:{projectName:data.title||'Imported Project',createdAt:data.exportedAt||new Date().toISOString(),updatedAt:new Date().toISOString()},
    branding:{title:data.title,subtitle:data.subtitle,logo:data.logo,logoType:data.logoType},
    settings:{colWidth:data.colWidth,fontSize:data.fontSize,isWrapMode:data.isWrapMode,isBoldMode:data.isBoldMode,showLunar:data.showLunar,showWeekend:data.showWeekend,showHolidays:data.showHolidays,showAdjusted:data.showAdjusted},
    teams:data.teams,events:data.events,recycleBin:data.recycleBin||[]
  };
  if(!Array.isArray(source.events))throw new Error('缺少 events 数组');
  if(!Array.isArray(source.teams)||!source.teams.length)throw new Error('缺少有效 teams 数组');
  const target=migrateTeams(source.teams),names=new Set(target.map(t=>t.name.toLowerCase())),ids=new Set();
  source.events.forEach((e,i)=>{
    const row=i+1;
    if(!e||typeof e!=='object')throw new Error(`第 ${row} 项排期不是对象`);
    if(e.id===undefined||e.id===null||e.id==='')throw new Error(`第 ${row} 项缺少 id`);
    if(ids.has(String(e.id)))throw new Error(`发现重复 id：${e.id}`);ids.add(String(e.id));
    if(typeof e.title!=='string'||!e.title.trim())throw new Error(`第 ${row} 项缺少有效标题`);
    const team=normalizeTeamName(e.team,target);if(!names.has(team.toLowerCase()))throw new Error(`第 ${row} 项团队 ${e.team||'(空)'} 不存在`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(e.start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(e.end||''))throw new Error(`第 ${row} 项日期格式必须为 YYYY-MM-DD`);
    if(e.end<e.start)throw new Error(`第 ${row} 项结束日期早于开始日期`);
  });
  return source;
}
function applyProjectData(raw,fileName=''){
  const data=validateImportedData(raw);
  const branding=data.branding||{},settings=data.settings||{},metadata=data.metadata||{};
  teams=migrateTeams(data.teams);
  events=data.events.map(e=>({...e,title:e.title.trim(),team:normalizeTeamName(e.team,teams),owner:typeof e.owner==='string'?e.owner.trim():'',location:typeof e.location==='string'?e.location.trim():'',notes:typeof e.notes==='string'?e.notes.trim():'',status:e.status==='confirmed'?'confirmed':'planned'}));
  recycleBin=Array.isArray(data.recycleBin)?data.recycleBin.map(e=>({...e,team:normalizeTeamName(e.team,teams)})):[];
  lastDeletedEvent=recycleBin.length?recycleBin[recycleBin.length-1]:null;
  appTitle=typeof branding.title==='string'&&branding.title.trim()?branding.title.trim():'Team Planner';
  appSubtitle=typeof branding.subtitle==='string'?branding.subtitle.trim():'Annual & Monthly Planning Board';
  appLogo=typeof branding.logo==='string'?branding.logo:'';
  appLogoType=branding.logoType==='file'?'file':(appLogo?'url':'');
  currentColWidth=Number.isFinite(Number(settings.colWidth))?Math.min(80,Math.max(34,Number(settings.colWidth))):48;
  currentFontSize=Number.isFinite(Number(settings.fontSize))?Math.min(14,Math.max(9,Number(settings.fontSize))):11;
  isWrapMode=typeof settings.isWrapMode==='boolean'?settings.isWrapMode:false;
  isBoldMode=typeof settings.isBoldMode==='boolean'?settings.isBoldMode:true;
  showLunar=typeof settings.showLunar==='boolean'?settings.showLunar:false;
  showWeekend=typeof settings.showWeekend==='boolean'?settings.showWeekend:true;
  showHolidays=typeof settings.showHolidays==='boolean'?settings.showHolidays:true;
  showAdjusted=typeof settings.showAdjusted==='boolean'?settings.showAdjusted:true;
  year=Number.isInteger(settings.year)?settings.year:(events[0]?Number(events[0].start.slice(0,4)):new Date().getFullYear());
  currentMonth=Number.isInteger(settings.currentMonth)&&settings.currentMonth>=0&&settings.currentMonth<=11?settings.currentMonth:new Date().getMonth();
  view=settings.view==='year'?'year':'month';
  projectCreatedAt=metadata.createdAt||new Date().toISOString();projectUpdatedAt=metadata.updatedAt||new Date().toISOString();
  currentProjectFileName=fileName||currentProjectFileName||'';
  projectDirty=false;
  applyBranding();applyColWidth(currentColWidth);applyFontSize(currentFontSize);updateWrapBtnUI();updateBoldBtnUI();
  $('yearBtn').classList.toggle('active',view==='year');$('monthBtn').classList.toggle('active',view==='month');
  renderTeamToggles();renderLegend();updateRecycleCount();render();updateProjectStatus();
}
async function openProjectFilePicker(){
  if(projectDirty&&!confirm('当前项目存在未保存修改，仍要打开其他项目吗？'))return;
  if('showOpenFilePicker' in window){
    try{
      const [handle]=await window.showOpenFilePicker({multiple:false,types:[{description:'Team Planner Project',accept:{'application/json':['.json','.tplanner']}}]});
      const file=await handle.getFile();const data=JSON.parse(await file.text());currentProjectHandle=handle;applyProjectData(data,file.name);closeSettings();toast(`已打开项目：${file.name}`);
    }catch(err){if(err&&err.name!=='AbortError')alert(`打开失败：${err.message||'项目文件无效'}`);}
  }else{const input=$('jsonFileInput');input.value='';input.click();}
}
async function importJSONFile(ev){
  const file=ev.target.files&&ev.target.files[0];if(!file)return;
  try{const data=JSON.parse(await file.text());currentProjectHandle=null;applyProjectData(data,file.name);closeSettings();toast(`已打开项目：${file.name}`);}
  catch(err){alert(`打开失败：${err.message||'项目文件无效'}\n当前项目未被修改。`);}
}
function safeProjectFileName(){
  const base=(currentProjectFileName||appTitle||'Team-Planner').replace(/\.tplanner\.json$/i,'').replace(/[<>:"/\\|?*\x00-\x1F]/g,'-').trim()||'Team-Planner';
  return base+'.tplanner.json';
}
async function writeProjectHandle(handle){
  const writable=await handle.createWritable();await writable.write(JSON.stringify(buildProjectPayload(),null,2));await writable.close();
  currentProjectHandle=handle;currentProjectFileName=handle.name;projectUpdatedAt=new Date().toISOString();projectDirty=false;updateProjectStatus();toast(`项目已保存：${handle.name}`);
}
async function saveProject(){
  if(currentProjectHandle){try{await writeProjectHandle(currentProjectHandle);}catch(err){alert(`保存失败：${err.message}`);}return;}
  await saveProjectAs();
}
async function saveProjectAs(){
  if('showSaveFilePicker' in window){
    try{const handle=await window.showSaveFilePicker({suggestedName:safeProjectFileName(),types:[{description:'Team Planner Project',accept:{'application/json':['.json']}}]});await writeProjectHandle(handle);}
    catch(err){if(err&&err.name!=='AbortError')alert(`另存失败：${err.message}`);}
  }else{
    const blob=new Blob([JSON.stringify(buildProjectPayload(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=safeProjectFileName();a.click();URL.revokeObjectURL(a.href);currentProjectFileName=a.download;projectDirty=false;updateProjectStatus();toast('项目文件已下载；浏览器不支持直接覆盖原文件');
  }
}
function exportData(){return saveProjectAs();}
function openImportFilePicker(){return openProjectFilePicker();}
function newProject(){
  if(projectDirty&&!confirm('当前项目存在未保存修改，仍要新建空白项目吗？'))return;
  currentProjectHandle=null;currentProjectFileName='';projectCreatedAt=new Date().toISOString();projectUpdatedAt=projectCreatedAt;
  applyProjectData({schemaVersion:'TeamPlannerProject/1.19',metadata:{projectName:'Untitled Project',createdAt:projectCreatedAt,updatedAt:projectUpdatedAt},branding:{title:'Team Planner',subtitle:'Annual & Monthly Planning Board',logo:'',logoType:''},settings:{colWidth:48,fontSize:11,isWrapMode:false,isBoldMode:true,showLunar:false,showWeekend:true,showHolidays:true,showAdjusted:true,year:new Date().getFullYear(),currentMonth:new Date().getMonth(),view:'month'},teams:defaultTeams,events:[],recycleBin:[]},'');
  currentProjectFileName='';projectDirty=true;updateProjectStatus();closeSettings();toast('已新建空白项目，请另存项目文件');
}
function clearAllPlannerData(){
  if(!confirm('将清除当前项目全部排期和回收站，但不会删除磁盘中的项目文件。是否继续？'))return;
  const typed=prompt('请输入 RESET 确认：');if(typed!=='RESET')return alert('输入不正确，未清除数据。');
  events=[];recycleBin=[];lastDeletedEvent=null;markProjectDirty();updateRecycleCount();render();closeSettings();toast('当前项目数据已清空，请保存项目');
}
'''
text = text[:block_start] + project_code + text[block_end:]

# Remove remaining direct localStorage writes/reads from mutation paths.
# At this point initialization was replaced; convert remaining writes to dirty tracking.
text = re.sub(r"localStorage\.setItem\([^;]+;", "markProjectDirty();", text)
text = re.sub(r"Object\.keys\(localStorage\).*?location\.reload\(\);", "newProject();", text, flags=re.S)

# Ensure settings save marks project dirty after data changes.
text = text.replace("saveTeamsToLocal();persistEvents();closeSettings();", "markProjectDirty();closeSettings();", 1)

# Ensure title version and project schema stay correct if duplicate old strings survive.
text = text.replace("TeamPlannerFullConfig/18.0", "TeamPlannerProject/1.19")
text = text.replace("version:'18.0'", "version:'1.19'")

path.write_text(text, encoding='utf-8', newline='\n')
print(f'[OK] 已升级: {path.resolve()}')
print(f'[OK] 已备份: {backup.resolve()}')
print('[OK] Build 01: index.html 不再以 localStorage 作为项目数据存储；项目数据保存为 *.tplanner.json')
