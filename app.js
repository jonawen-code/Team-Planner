/* Migrated inline script from index_v1.19_build01b.html */
const holidays_2026 = {
  '2026-01-01': '元旦', '2026-01-02': '元旦', '2026-01-03': '元旦',
  '2026-02-15': '春节', '2026-02-16': '春节', '2026-02-17': '春节', '2026-02-18': '春节',
  '2026-02-19': '春节', '2026-02-20': '春节', '2026-02-21': '春节', '2026-02-22': '春节', '2026-02-23': '春节',
  '2026-04-04': '清明', '2026-04-05': '清明', '2026-04-06': '清明',
  '2026-05-01': '劳动节', '2026-05-02': '劳动节', '2026-05-03': '劳动节', '2026-05-04': '劳动节', '2026-05-05': '劳动节',
  '2026-06-19': '端午', '2026-06-20': '端午', '2026-06-21': '端午',
  '2026-09-25': '中秋', '2026-09-26': '中秋', '2026-09-27': '中秋',
  '2026-10-01': '国庆', '2026-10-02': '国庆', '2026-10-03': '国庆', '2026-10-04': '国庆',
  '2026-10-05': '国庆', '2026-10-06': '国庆', '2026-10-07': '国庆'
};

const workdays_adjusted_2026 = {
  '2026-01-04': '调休上班',
  '2026-02-14': '调休上班', '2026-02-28': '调休上班',
  '2026-05-09': '调休上班',
  '2026-09-20': '调休上班',
  '2026-10-10': '调休上班'
};

const holidays_2027 = {
  '2027-01-01': '元旦', '2027-01-02': '元旦', '2027-01-03': '元旦',
  '2027-02-06': '春节', '2027-02-07': '春节', '2027-02-08': '春节', '2027-02-09': '春节',
  '2027-02-10': '春节', '2027-02-11': '春节', '2027-02-12': '春节', '2027-02-13': '春节',
  '2027-04-04': '清明', '2027-04-05': '清明', '2027-04-06': '清明',
  '2027-05-01': '劳动节', '2027-05-02': '劳动节', '2027-05-03': '劳动节', '2027-05-04': '劳动节', '2027-05-05': '劳动节',
  '2027-06-08': '端午', '2027-06-09': '端午', '2027-06-10': '端午',
  '2027-09-15': '中秋',
  '2027-10-01': '国庆', '2027-10-02': '国庆', '2027-10-03': '国庆', '2027-10-04': '国庆',
  '2027-10-05': '国庆', '2027-10-06': '国庆', '2027-10-07': '国庆'
};

const workdays_adjusted_2027 = {};

function getHolidaysForYear(y) { return y === 2027 ? holidays_2027 : holidays_2026; }
function getAdjustedForYear(y) { return y === 2027 ? workdays_adjusted_2027 : workdays_adjusted_2026; }

const defaultTeams = [
  { name:'Team A', color:'#c9142b', light:false, visible:true },
  { name:'Team B', color:'#7bc633', light:true, visible:true },
  { name:'Team C', color:'#f7c49f', light:true, visible:true },
  { name:'Team D', color:'#f3c428', light:true, visible:true },
];

const verifiedFullYearEvents = [];

const LEGACY_TEAM_MAP={LD:'L&D',ENG:'Engagement',ELC:'TA',MEET:'Meeting',CB:'C&B'};
function normalizeTeamName(v,list=teams){const raw=String(v||'').trim();if(!raw)return '';const exact=(list||[]).find(t=>String(t.name||'').trim().toLowerCase()===raw.toLowerCase());if(exact)return exact.name;return LEGACY_TEAM_MAP[raw.toUpperCase()]||raw;}
function migrateTeams(raw){const source=Array.isArray(raw)?raw:defaultTeams,seen=new Set();return source.map(t=>{const sourceName=t.name||LEGACY_TEAM_MAP[String(t.id||'').toUpperCase()]||t.id;const name=normalizeTeamName(sourceName,defaultTeams);return {name,color:t.color||'#6366f1',light:typeof t.light==='boolean'?t.light:isColorLight(t.color||'#6366f1'),visible:t.visible!==false};}).filter(t=>t.name&&!seen.has(t.name.toLowerCase())&&(seen.add(t.name.toLowerCase()),true));}
const PROJECT_CACHE_KEY='hr_planner_project_cache_v119';
function readJSONStorage(key,fallback=null){try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw);}catch(e){return fallback;}}
function buildLegacyProject(){
  const legacyTeams=migrateTeams(readJSONStorage('hr_planner_teams_global',readJSONStorage('hr_planner_teams_v13',defaultTeams))||defaultTeams);
  const legacyEvents=(readJSONStorage('hr_planner_events_global',readJSONStorage('hr_planner_events_v13',verifiedFullYearEvents))||verifiedFullYearEvents).map(e=>({...e,team:normalizeTeamName(e.team,legacyTeams),status:e.status==='confirmed'?'confirmed':'planned'}));
  const legacyRecycle=(readJSONStorage('hr_planner_recycle_bin_global',[])||[]).map(e=>({...e,team:normalizeTeamName(e.team,legacyTeams)}));
  const now=new Date().toISOString();
  return {schemaVersion:'TeamPlannerProject/1.19',metadata:{projectName:'Team Planner Project',version:'1.19',build:'01B',createdAt:now,modifiedAt:now},branding:{title:localStorage.getItem('hr_planner_title_global')||localStorage.getItem('hr_planner_title_v13')||'Team Planner',subtitle:localStorage.getItem('hr_planner_subtitle_global')||'Annual & Monthly Planning Board',logo:localStorage.getItem('hr_planner_logo_global')||'',logoType:localStorage.getItem('hr_planner_logo_type_global')||''},settings:{colWidth:+localStorage.getItem('hr_planner_colwidth_global')||48,fontSize:+localStorage.getItem('hr_planner_fontsize_global')||11,isWrapMode:localStorage.getItem('hr_planner_wrapmode_global')==='true',isBoldMode:localStorage.getItem('hr_planner_boldmode_global')!=='false',showLunar:localStorage.getItem('hr_planner_show_lunar_global')==='true',showWeekend:localStorage.getItem('hr_planner_show_weekend_global')!=='false',showHolidays:localStorage.getItem('hr_planner_show_holidays_global')!=='false',showAdjusted:localStorage.getItem('hr_planner_show_adjusted_global')!=='false'},teams:legacyTeams,events:legacyEvents,recycleBin:legacyRecycle};
}
function normalizeProject(raw){
  const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const isV19=src.schemaVersion==='TeamPlannerProject/1.19'||(src.metadata&&src.branding&&src.settings);
  const sourceTeams=migrateTeams(src.teams||defaultTeams);
  const sourceEvents=Array.isArray(src.events)?src.events:[];
  const branding=isV19?(src.branding||{}):{title:src.title,subtitle:src.subtitle,logo:src.logo,logoType:src.logoType};
  const settings=isV19?(src.settings||{}):src;
  const now=new Date().toISOString();
  return {schemaVersion:'TeamPlannerProject/1.19',metadata:{projectName:String(src.metadata?.projectName||branding.title||'Team Planner Project').trim()||'Team Planner Project',version:'1.19',build:'01B',createdAt:src.metadata?.createdAt||now,modifiedAt:src.metadata?.modifiedAt||now},branding:{title:String(branding.title||'Team Planner'),subtitle:typeof branding.subtitle==='string'?branding.subtitle:'Annual & Monthly Planning Board',logo:typeof branding.logo==='string'?branding.logo:'',logoType:branding.logoType==='file'?'file':(branding.logo?'url':'')},settings:{colWidth:Number.isFinite(Number(settings.colWidth))?Math.min(80,Math.max(34,Number(settings.colWidth))):48,fontSize:Number.isFinite(Number(settings.fontSize))?Math.min(14,Math.max(9,Number(settings.fontSize))):11,isWrapMode:settings.isWrapMode===true,isBoldMode:settings.isBoldMode!==false,showLunar:settings.showLunar===true,showWeekend:settings.showWeekend!==false,showHolidays:settings.showHolidays!==false,showAdjusted:settings.showAdjusted!==false},teams:sourceTeams,events:sourceEvents.map(e=>({...e,team:normalizeTeamName(e.team,sourceTeams),status:e.status==='confirmed'?'confirmed':'planned'})),recycleBin:(Array.isArray(src.recycleBin)?src.recycleBin:[]).map(e=>({...e,team:normalizeTeamName(e.team,sourceTeams)}))};
}
let currentProject=normalizeProject(readJSONStorage(PROJECT_CACHE_KEY,null)||buildLegacyProject());
let teams=currentProject.teams;
let events=currentProject.events;
const requiredTeamNames=new Set(events.map(e=>e.team).filter(Boolean));requiredTeamNames.forEach(name=>{if(!teams.some(t=>t.name===name))teams.push({name,color:'#6366f1',light:false,visible:true});});

// -- rest of application logic migrated from inline script --
// The full original script is long; remaining functions (render, event handlers, persistence, UI bindings)
// are present in the original HTML. For maintainability, further modularization is recommended.

// If some parts remain in the original HTML (for incremental migration), extract and eval them so behavior remains intact.
(function runMigratedInline() {
  function tryEvalInlineBlock() {
    try {
      // Find the comment markers in the body
      const comments = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT, null, false);
      let cnode;
      while ((cnode = walker.nextNode())) {
        const v = String(cnode.nodeValue || '').trim();
        if (v === 'INLINE SCRIPT MOVED TO app.js' || v === 'END INLINE SCRIPT MOVED') comments.push({node: cnode, val: v});
      }
      if (comments.length < 2) return;
      // assume first is start, second is end
      const start = comments[0].node;
      const end = comments[1].node;
      // collect sibling nodes between start and end
      const parts = [];
      let cur = start.nextSibling;
      while (cur && cur !== end) {
        parts.push(cur.textContent || '');
        cur = cur.nextSibling;
      }
      const code = parts.join('');
      if (!code.trim()) return;
      // evaluate in global scope
      (0, eval)(code);
    } catch (e) {
      console.error('Error evaluating migrated inline script block:', e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryEvalInlineBlock); else tryEvalInlineBlock();
})();
