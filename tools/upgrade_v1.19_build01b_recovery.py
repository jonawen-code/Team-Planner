from pathlib import Path
import re
import sys

SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('index_v1.19_build01a.html')
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('index_v1.19_build01b.html')

if not SOURCE.exists():
    raise SystemExit(f'找不到源文件: {SOURCE}')

html = SOURCE.read_text(encoding='utf-8-sig')
if 'v1.19 Build 01A' not in html:
    raise SystemExit('源文件不是预期的 v1.19 Build 01A，未做任何修改。')
if 'RECOVERY_MANAGER_BUILD_01B' in html:
    raise SystemExit('该文件已经包含 Build 01B 恢复模块，未重复修改。')

html = html.replace('Team Planner v1.19 Build 01A', 'Team Planner v1.19 Build 01B')
html = html.replace('v1.19 Build 01A</b>：统一 currentProject 数据模型；兼容导入 V18 JSON；项目导出为 .tplanner.json。',
                    'v1.19 Build 01B</b>：增加自动恢复、5 份轮转快照、备份提醒与恢复中心。')
html = html.replace("build:'01A'", "build:'01B'")
html = html.replace("build: '01A'", "build: '01B'")
html = html.replace("build:\"01A\"", "build:\"01B\"")
html = html.replace(" + ' v1.19 Build 01A'", " + ' v1.19 Build 01B'")

css = r'''
/* RECOVERY_MANAGER_BUILD_01B */
.recovery-status{font-size:12px;color:#64748b;display:flex;align-items:center;gap:6px;white-space:nowrap}
.recovery-dot{width:8px;height:8px;border-radius:50%;background:#16a34a;display:inline-block}
.recovery-dot.dirty{background:#d97706}.recovery-dot.warning{background:#dc2626}
.recovery-panel{position:fixed;inset:0;background:rgba(15,23,42,.48);z-index:300;display:none;align-items:center;justify-content:center;padding:20px}
.recovery-dialog{background:#fff;width:min(620px,96vw);max-height:88vh;overflow:auto;border-radius:12px;padding:22px;box-shadow:0 24px 60px rgba(15,23,42,.28)}
.recovery-dialog h3{margin:0 0 8px}.recovery-dialog p{color:#64748b;line-height:1.55}
.recovery-item{border:1px solid #e2e8f0;border-radius:8px;padding:11px 12px;margin:8px 0;display:flex;gap:12px;align-items:center}
.recovery-item-main{flex:1}.recovery-item-title{font-weight:700}.recovery-item-meta{font-size:12px;color:#64748b;margin-top:3px}
.recovery-banner{display:none;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;padding:8px 14px;font-size:12px;align-items:center;gap:10px}
.recovery-banner.show{display:flex}.recovery-banner button{margin-left:auto}
'''
html = html.replace('</style>', css + '\n</style>', 1)

header_marker = '<div class="spacer"></div>'
header_insert = '''<div class="spacer"></div>
  <div class="recovery-status" id="recoveryStatus" title="浏览器恢复缓存状态">
    <span class="recovery-dot" id="recoveryDot"></span>
    <span id="recoveryStatusText">已建立恢复点</span>
  </div>'''
html = html.replace(header_marker, header_insert, 1)

main_marker = '<main>'
main_insert = '''<div class="recovery-banner" id="backupReminderBanner">
  <span id="backupReminderText">建议导出项目文件，防止清理浏览器数据后无法恢复。</span>
  <button type="button" onclick="exportData()">立即备份</button>
  <button type="button" onclick="dismissBackupReminder()">稍后提醒</button>
</div>
<main>'''
html = html.replace(main_marker, main_insert, 1)

body_marker = '<div class="toast" id="toast"></div>'
recovery_ui = '''<div class="toast" id="toast"></div>
<div class="recovery-panel" id="recoveryPanel">
  <div class="recovery-dialog">
    <h3 id="recoveryPanelTitle">恢复中心</h3>
    <p id="recoveryPanelMessage"></p>
    <div id="recoveryList"></div>
    <div class="actions">
      <button id="recoveryIgnoreBtn" onclick="closeRecoveryPanel()">继续使用当前数据</button>
    </div>
  </div>
</div>'''
if body_marker not in html:
    raise SystemExit('未找到 toast 节点，未做任何修改。')
html = html.replace(body_marker, recovery_ui, 1)

module = r'''
/* RECOVERY_MANAGER_BUILD_01B */
const RECOVERY_KEY='hr_planner_recovery_v119';
const RECOVERY_META_KEY='hr_planner_recovery_meta_v119';
const SNAPSHOT_PREFIX='hr_planner_backup_v119_';
const SNAPSHOT_COUNT=5;
const SNAPSHOT_INTERVAL_MS=10*60*1000;
const RECOVERY_DEBOUNCE_MS=1200;
const EXPORT_REMINDER_CHANGES=20;
const EXPORT_REMINDER_MS=24*60*60*1000;
let recoverySaveTimer=null;
let recoveryDirty=false;
let recoveryChangeCount=0;
let lastSnapshotAt=0;
let suppressRecoveryTracking=false;

function recoveryNow(){return new Date().toISOString();}
function recoveryClone(value){return JSON.parse(JSON.stringify(value));}
function recoveryMeta(){
  try{return JSON.parse(localStorage.getItem(RECOVERY_META_KEY)||'{}')||{};}catch(e){return {};}
}
function writeRecoveryMeta(patch){
  const next={...recoveryMeta(),...patch};
  localStorage.setItem(RECOVERY_META_KEY,JSON.stringify(next));
  return next;
}
function recoveryProjectName(project=currentProject){
  return project?.metadata?.projectName||project?.branding?.title||'Team Planner Project';
}
function recoveryTimeText(value){
  if(!value)return '未知时间';
  const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString('zh-CN',{hour12:false});
}
function updateRecoveryStatus(mode='saved',text='已建立恢复点'){
  const dot=document.getElementById('recoveryDot');
  const label=document.getElementById('recoveryStatusText');
  if(dot){dot.className='recovery-dot'+(mode==='dirty'?' dirty':mode==='warning'?' warning':'');}
  if(label)label.textContent=text;
}
function buildRecoveryEnvelope(reason='change'){
  syncProjectModel();
  return {format:'TeamPlannerRecovery/1.19',savedAt:recoveryNow(),reason,project:recoveryClone(currentProject)};
}
function writeRecoveryCache(reason='change'){
  if(suppressRecoveryTracking)return;
  try{
    const envelope=buildRecoveryEnvelope(reason);
    localStorage.setItem(RECOVERY_KEY,JSON.stringify(envelope));
    localStorage.setItem(PROJECT_CACHE_KEY,JSON.stringify(envelope.project));
    recoveryDirty=false;
    writeRecoveryMeta({lastRecoveryAt:envelope.savedAt,changeCount:recoveryChangeCount});
    updateRecoveryStatus('saved','恢复点 '+new Date(envelope.savedAt).toLocaleTimeString('zh-CN',{hour12:false}));
    maybeCreateSnapshot(envelope);
    evaluateBackupReminder();
  }catch(err){
    updateRecoveryStatus('warning','恢复缓存写入失败');
    console.error('Recovery save failed',err);
  }
}
function scheduleRecoverySave(reason='change'){
  if(suppressRecoveryTracking)return;
  recoveryDirty=true;recoveryChangeCount+=1;
  updateRecoveryStatus('dirty','存在未保存修改');
  clearTimeout(recoverySaveTimer);
  recoverySaveTimer=setTimeout(()=>writeRecoveryCache(reason),RECOVERY_DEBOUNCE_MS);
}
function createSnapshot(envelope=buildRecoveryEnvelope('snapshot')){
  const snapshots=loadSnapshots();
  const entry={format:'TeamPlannerSnapshot/1.19',savedAt:envelope.savedAt||recoveryNow(),project:recoveryClone(envelope.project)};
  snapshots.unshift(entry);
  snapshots.slice(0,SNAPSHOT_COUNT).forEach((item,index)=>localStorage.setItem(SNAPSHOT_PREFIX+(index+1),JSON.stringify(item)));
  for(let i=snapshots.length+1;i<=SNAPSHOT_COUNT;i++)localStorage.removeItem(SNAPSHOT_PREFIX+i);
  lastSnapshotAt=Date.now();
  writeRecoveryMeta({lastSnapshotAt:entry.savedAt});
}
function maybeCreateSnapshot(envelope){
  const meta=recoveryMeta();
  const previous=Date.parse(meta.lastSnapshotAt||0)||lastSnapshotAt||0;
  if(Date.now()-previous>=SNAPSHOT_INTERVAL_MS)createSnapshot(envelope);
}
function loadSnapshots(){
  const list=[];
  for(let i=1;i<=SNAPSHOT_COUNT;i++){
    try{const value=JSON.parse(localStorage.getItem(SNAPSHOT_PREFIX+i)||'null');if(value?.project)list.push(value);}catch(e){}
  }
  return list.sort((a,b)=>Date.parse(b.savedAt||0)-Date.parse(a.savedAt||0));
}
function readRecoveryEnvelope(){
  const raw=localStorage.getItem(RECOVERY_KEY);
  if(!raw)return {state:'missing'};
  try{
    const value=JSON.parse(raw);
    if(!value?.project)throw new Error('恢复数据缺少 project');
    validateImportedData(value.project);
    return {state:'valid',value};
  }catch(error){return {state:'corrupt',error};}
}
function applyRecoveredProject(project,sourceLabel='恢复点'){
  suppressRecoveryTracking=true;
  try{
    const restored=normalizeProject(recoveryClone(project));
    validateImportedData(restored);
    currentProject=restored;teams=restored.teams;events=restored.events;recycleBin=restored.recycleBin||[];
    lastDeletedEvent=recycleBin.length?recycleBin[recycleBin.length-1]:null;
    appTitle=restored.branding.title;appSubtitle=restored.branding.subtitle;appLogo=restored.branding.logo;appLogoType=restored.branding.logoType;
    currentColWidth=restored.settings.colWidth;currentFontSize=restored.settings.fontSize;isWrapMode=restored.settings.isWrapMode;isBoldMode=restored.settings.isBoldMode;
    showLunar=restored.settings.showLunar;showWeekend=restored.settings.showWeekend;showHolidays=restored.settings.showHolidays;showAdjusted=restored.settings.showAdjusted;
    applyBranding();applyColWidth(currentColWidth);applyFontSize(currentFontSize);updateWrapBtnUI();updateBoldBtnUI();updateRecycleCount();renderTeamToggles();renderLegend();render();
    localStorage.setItem(PROJECT_CACHE_KEY,JSON.stringify(currentProject));
  }finally{suppressRecoveryTracking=false;}
  writeRecoveryCache('restored');closeRecoveryPanel();toast('已从'+sourceLabel+'恢复项目');
}
function openRecoveryPanel(title,message,items){
  document.getElementById('recoveryPanelTitle').textContent=title;
  document.getElementById('recoveryPanelMessage').textContent=message;
  const list=document.getElementById('recoveryList');list.innerHTML='';
  items.forEach(item=>{
    const row=document.createElement('div');row.className='recovery-item';
    const main=document.createElement('div');main.className='recovery-item-main';
    main.innerHTML='<div class="recovery-item-title"></div><div class="recovery-item-meta"></div>';
    main.querySelector('.recovery-item-title').textContent=item.title;
    main.querySelector('.recovery-item-meta').textContent=item.meta;
    const button=document.createElement('button');button.className='primary';button.textContent='恢复';button.onclick=item.onRestore;
    row.append(main,button);list.appendChild(row);
  });
  document.getElementById('recoveryPanel').style.display='flex';
}
function closeRecoveryPanel(){document.getElementById('recoveryPanel').style.display='none';}
function detectRecoveryAtStartup(){
  const recovery=readRecoveryEnvelope();
  const snapshots=loadSnapshots();
  const currentModified=Date.parse(currentProject?.metadata?.modifiedAt||0)||0;
  if(recovery.state==='valid'){
    const recoveryModified=Date.parse(recovery.value.project?.metadata?.modifiedAt||recovery.value.savedAt||0)||0;
    if(recoveryModified>currentModified+1000){
      openRecoveryPanel('发现较新的恢复数据','检测到比当前项目更新的自动恢复点。', [{title:recoveryProjectName(recovery.value.project),meta:'恢复点：'+recoveryTimeText(recovery.value.savedAt),onRestore:()=>applyRecoveredProject(recovery.value.project,'自动恢复点')}]);
      return;
    }
  }
  if(recovery.state==='corrupt'&&snapshots.length){
    openRecoveryPanel('自动恢复数据异常','自动恢复缓存无法读取，可从最近的轮转快照恢复。',snapshots.map((s,i)=>({title:recoveryProjectName(s.project),meta:'快照 '+(i+1)+'：'+recoveryTimeText(s.savedAt),onRestore:()=>applyRecoveredProject(s.project,'快照')})));
  }else if(recovery.state==='corrupt'){
    updateRecoveryStatus('warning','恢复缓存损坏');
  }
}
function evaluateBackupReminder(){
  const meta=recoveryMeta();
  const lastExport=Date.parse(meta.lastExportAt||0)||0;
  const dueByChanges=recoveryChangeCount>=EXPORT_REMINDER_CHANGES;
  const dueByTime=!lastExport||Date.now()-lastExport>=EXPORT_REMINDER_MS;
  const dismissedUntil=Date.parse(meta.reminderDismissedUntil||0)||0;
  const banner=document.getElementById('backupReminderBanner');
  if(!banner)return;
  const shouldShow=(dueByChanges||dueByTime)&&Date.now()>dismissedUntil;
  banner.classList.toggle('show',shouldShow);
  if(shouldShow){
    document.getElementById('backupReminderText').textContent=dueByChanges?'已有较多修改尚未导出项目文件，建议立即备份。':'项目超过 1 天未导出备份，建议立即保存 .tplanner.json。';
  }
}
function dismissBackupReminder(){
  writeRecoveryMeta({reminderDismissedUntil:new Date(Date.now()+4*60*60*1000).toISOString()});
  document.getElementById('backupReminderBanner')?.classList.remove('show');
}
function recordSuccessfulExport(){
  recoveryChangeCount=0;
  writeRecoveryMeta({lastExportAt:recoveryNow(),changeCount:0,reminderDismissedUntil:null});
  document.getElementById('backupReminderBanner')?.classList.remove('show');
}
function flushRecoveryBeforeExit(){
  if(recoveryDirty){clearTimeout(recoverySaveTimer);writeRecoveryCache('page-exit');}
}

const originalPersistProjectCache=persistProjectCache;
persistProjectCache=function(){scheduleRecoverySave('project-change');};
saveTeamsToLocal=function(){scheduleRecoverySave('team-change');};
persistEvents=function(){scheduleRecoverySave('event-change');};
persistBranding=function(){scheduleRecoverySave('branding-change');};
persistAllSettings=function(){scheduleRecoverySave('settings-change');};
const originalExportData=exportData;
exportData=function(){
  flushRecoveryBeforeExit();
  originalExportData();
  recordSuccessfulExport();
};
window.addEventListener('beforeunload',flushRecoveryBeforeExit);
setInterval(()=>{if(recoveryDirty)writeRecoveryCache('interval');else maybeCreateSnapshot(buildRecoveryEnvelope('scheduled-snapshot'));},SNAPSHOT_INTERVAL_MS);
setTimeout(()=>{const meta=recoveryMeta();recoveryChangeCount=Number(meta.changeCount)||0;detectRecoveryAtStartup();evaluateBackupReminder();if(!localStorage.getItem(RECOVERY_KEY))writeRecoveryCache('initial');},0);
'''

if 'init();' not in html:
    raise SystemExit('未找到 init();，未做任何修改。')
html = html.replace('init();', module + '\ninit();', 1)

OUTPUT.write_text(html, encoding='utf-8')
print(f'完成: {OUTPUT}')
