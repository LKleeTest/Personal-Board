/* LK Board: Supabase live data layer.
   Keeps the in-memory board (window.__LK) in sync with the lk_* tables.
   Sign-in is required for sync; "Continue on this device only" keeps the app local. */
(function(){
'use strict';
const LK=window.__LK;
if(!LK||!window.supabase)return;

const SB_URL='https://kbvbfxbrmztyzuyvahgs.supabase.co';
const SB_KEY='sb_publishable_5S61gu8TcjXISPDewQ2QvA_G0JJBZSB';
const sb=window.supabase.createClient(SB_URL,SB_KEY);

const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=ms=>new Date(ms||Date.now()).toISOString();
const orNull=v=>v?v:null;

/* ---------- mapping between the board and the tables ---------- */
const DEFS=[
  {name:'lists',t:'lk_lists',key:r=>r.id,conflict:'id',col:'id'},
  {name:'tasks',t:'lk_tasks',key:r=>r.id,conflict:'id',col:'id'},
  {name:'steps',t:'lk_task_steps',key:r=>r.id,conflict:'id',col:'id'},
  {name:'bills',t:'lk_bills',key:r=>r.id,conflict:'id',col:'id'},
  {name:'pays',t:'lk_bill_payments',key:r=>r.id,conflict:'id',col:'id'},
  {name:'drafts',t:'lk_drafts',key:r=>r.day,conflict:'user_id,day',col:'day'},
  {name:'profile',t:'lk_profile',key:()=>'me',conflict:'user_id',col:null}
];
const DELETE_ORDER=['pays','steps','tasks','drafts','bills','lists'].map(n=>DEFS.find(d=>d.name===n));

function toRows(S){
  const rows={lists:[],tasks:[],steps:[],bills:[],pays:[],drafts:[],profile:[]};
  S.lists.forEach((l,i)=>rows.lists.push({id:l.id,name:l.name,icon:l.icon||'📝',position:i}));
  const listIds=new Set(S.lists.map(l=>l.id));
  S.tasks.forEach(t=>{
    t.created=t.created||Date.now();
    rows.tasks.push({id:t.id,list_id:listIds.has(t.listId)?t.listId:null,title:t.title,due:orNull(t.due),priority:!!t.priority,done:!!t.done,done_at:orNull(t.doneAt),xp:t.xp||0,sample:!!t.sample,auto:t.auto||[],created_at:iso(t.created)});
    t.steps.forEach((s,i)=>rows.steps.push({id:s.id,task_id:t.id,text:s.text,done:!!s.done,done_on:orNull(s.at),position:i}));
  });
  S.bills.forEach(b=>{
    rows.bills.push({id:b.id,name:b.name,amount:b.amount==null?null:Number(b.amount),currency:b.cur||'SGD',due:b.due,repeat:b.repeat||'once',anchor_day:b.day||null,note:b.note||'',autopay:!!b.auto,paid:!!b.paid,sample:!!b.sample});
    (b.log||[]).forEach(l=>{
      if(!l.id)l.id=crypto.randomUUID();
      rows.pays.push({id:l.id,bill_id:b.id,paid_on:l.date,amount:l.amount==null?null:Number(l.amount),currency:l.cur||'SGD',on_time:!!l.onTime});
    });
  });
  Object.keys(S.drafts||{}).forEach(day=>{
    const d=S.drafts[day];d.at=d.at||Date.now();
    rows.drafts.push({day:day,subject:d.subject||'',body:d.body||'',edited:!!d.edited,saved_at:iso(d.at)});
  });
  rows.profile.push({name:S.name||'',lang:S.lang||'en-SG',xp:S.xp||0,streak:S.streak||0,best:S.best||0,last_done:orNull(S.lastDone),mail_to:S.mailTo||'',end_hour:S.endHour||18});
  return rows;
}
function fromRows(db){
  const p=(db.profile&&db.profile[0])||{};
  const byTask={};
  db.steps.forEach(s=>{(byTask[s.task_id]=byTask[s.task_id]||[]).push(s)});
  const paysBy={};
  db.pays.forEach(x=>{(paysBy[x.bill_id]=paysBy[x.bill_id]||[]).push(x)});
  const S={v:1,name:p.name||'',lang:p.lang||'en-SG',xp:p.xp||0,streak:p.streak||0,best:p.best||0,lastDone:p.last_done||'',mailTo:p.mail_to||'',endHour:p.end_hour||18,updatedAt:Date.now(),
    lists:db.lists.map(l=>({id:l.id,name:l.name,icon:l.icon})),
    tasks:db.tasks.map(t=>({id:t.id,title:t.title,listId:t.list_id||'inbox',due:t.due||'',priority:!!t.priority,done:!!t.done,doneAt:t.done_at||'',created:Date.parse(t.created_at)||Date.now(),xp:t.xp||0,sample:!!t.sample,auto:t.auto||[],
      steps:(byTask[t.id]||[]).slice().sort((a,b)=>a.position-b.position).map(s=>({id:s.id,text:s.text,done:!!s.done,at:s.done_on||undefined}))})),
    bills:db.bills.map(b=>({id:b.id,name:b.name,amount:b.amount==null?null:Number(b.amount),cur:b.currency,due:b.due,repeat:b.repeat,day:b.anchor_day||undefined,note:b.note||'',auto:!!b.autopay,paid:!!b.paid,sample:!!b.sample,
      log:(paysBy[b.id]||[]).slice().sort((a,b2)=>a.paid_on<b2.paid_on?1:a.paid_on>b2.paid_on?-1:0).map(x=>({id:x.id,date:x.paid_on,amount:x.amount==null?null:Number(x.amount),cur:x.currency,onTime:!!x.on_time}))})),
    drafts:{}};
  db.drafts.forEach(d=>{S.drafts[d.day]={subject:d.subject,body:d.body,edited:!!d.edited,at:Date.parse(d.saved_at)||Date.now()}});
  return S;
}
function snap(rows){
  const o={};
  DEFS.forEach(d=>{const m=new Map();(rows[d.name]||[]).forEach(r=>m.set(d.key(r),JSON.stringify(r)));o[d.name]=m});
  return o;
}
function sameSnap(a,b){
  return DEFS.every(d=>{const x=a[d.name],y=b[d.name];if(x.size!==y.size)return false;for(const [k,v] of x)if(y.get(k)!==v)return false;return true});
}

/* ---------- status chip ---------- */
const brand=document.querySelector('.brand');
if(brand)brand.insertAdjacentHTML('afterend','<div id="syncStatus" style="font-size:12.5px;color:var(--navy-dim);padding:0 4px 10px;margin-top:-8px"></div>');
function setStatus(text){const el=$('#syncStatus');if(el)el.textContent=text}
setStatus('Not signed in');

/* ---------- push (changed rows only) ---------- */
let userId=null,email='',synced=null,pushing=false,again=false,version=0,pushedVersion=0,pushTimer=0,quietUntil=0,pullTimer=0,channel=null,startedFor=null;
const emptySnap=()=>snap({lists:[],tasks:[],steps:[],bills:[],pays:[],drafts:[],profile:[]});
LK.ext.onSave=()=>{
  version++;
  if(!userId)return;
  setStatus('Saving…');
  clearTimeout(pushTimer);pushTimer=setTimeout(push,700);
};
async function push(){
  if(!userId||!synced)return;
  if(pushing){again=true;return}
  pushing=true;
  const v=version;
  try{
    const rows=toRows(LK.getS());
    const now=snap(rows);
    for(const d of DEFS){
      const old=synced[d.name],up=[];
      rows[d.name].forEach(r=>{if(old.get(d.key(r))!==JSON.stringify(r))up.push(Object.assign({user_id:userId},r))});
      if(up.length){const {error}=await sb.from(d.t).upsert(up,{onConflict:d.conflict});if(error)throw error}
    }
    for(const d of DELETE_ORDER){
      const gone=[...synced[d.name].keys()].filter(k=>!now[d.name].has(k));
      if(gone.length){const {error}=await sb.from(d.t).delete().in(d.col,gone);if(error)throw error}
    }
    synced=now;pushedVersion=v;quietUntil=Date.now()+2500;
    setStatus('● Synced');
  }catch(e){
    setStatus('Offline, will retry');
    clearTimeout(pushTimer);pushTimer=setTimeout(push,8000);
    console.warn('LK sync push failed',e);
  }
  pushing=false;
  if(again){again=false;push()}
}

/* ---------- pull and live updates ---------- */
async function pull(){
  const q=t=>sb.from(t).select('*');
  const rs=await Promise.all([q('lk_profile'),q('lk_lists').order('position'),q('lk_tasks'),q('lk_task_steps').order('position'),q('lk_bills'),q('lk_bill_payments'),q('lk_drafts')]);
  for(const r of rs)if(r.error)throw r.error;
  return{profile:rs[0].data,lists:rs[1].data,tasks:rs[2].data,steps:rs[3].data,bills:rs[4].data,pays:rs[5].data,drafts:rs[6].data};
}
function adopt(S2){
  LK.setS(S2);LK.persistLocal();
  synced=snap(toRows(LK.getS()));
  LK.renderAll();
}
async function refresh(){
  if(!userId||pushing||version!==pushedVersion)return;
  try{
    const S2=fromRows(await pull());
    const theirs=snap(toRows(S2));
    if(!sameSnap(theirs,snap(toRows(LK.getS())))){adopt(S2);setStatus('● Synced (updated)')}
  }catch(e){console.warn('LK refresh failed',e)}
}
function onChange(){
  if(pushing||Date.now()<quietUntil)return;
  clearTimeout(pullTimer);pullTimer=setTimeout(refresh,600);
}
function subscribe(){
  if(channel)return;
  channel=sb.channel('lk-live');
  DEFS.forEach(d=>channel.on('postgres_changes',{event:'*',schema:'public',table:d.t},onChange));
  channel.subscribe();
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});

/* ---------- first sync ---------- */
async function startSync(){
  if(startedFor===userId)return;
  startedFor=userId;
  setStatus('Syncing…');
  try{
    const db=await pull();
    const has=db.profile.length||db.lists.length||db.tasks.length||db.bills.length;
    if(has){
      adopt(fromRows(db));
      LK.toast('Loaded your data from Supabase.');
    }else{
      // first sign-in: upload what this device has (your tasks, bills and the sample data)
      synced=emptySnap();
      await push();
      LK.toast('Your board is now saved in Supabase.');
    }
    setStatus('● Synced');
    subscribe();
  }catch(e){
    startedFor=null;
    setStatus('Could not sync');
    LK.toast('Could not reach Supabase: '+esc(e.message||e),{ms:6000});
  }
}

/* ---------- sign-in gate ---------- */
const gate=document.createElement('div');
gate.id='authGate';
gate.hidden=true;
gate.innerHTML='<style>#authGate{position:fixed;inset:0;z-index:95;background:var(--bg);display:grid;place-items:center;padding:24px;overflow:auto}#authGate[hidden]{display:none}#authGate .card{width:min(94vw,400px);background:var(--surface);border-radius:26px;box-shadow:var(--shadow);padding:26px 22px;display:grid;gap:12px}#authGate h1{font:600 28px var(--font-display);margin:0}#authGate p{margin:0;color:var(--ink-2);font-size:15px}#authGate .msg{min-height:1.3em;font-size:14px;color:var(--ink-2)}#authGate .msg.err{color:var(--danger)}#authGate .link{color:var(--accent-text);font-weight:700;text-align:center;padding:8px}</style>'+
'<div class="card"><div style="font:700 13px var(--font-display);letter-spacing:.16em;text-transform:uppercase;color:var(--accent)">LK Board</div><h1>Sign in</h1><p>Your tasks and bills are saved to your own Supabase database and stay in sync on every device.</p>'+
'<label class="label" for="gEmail">Email</label><input class="inp" id="gEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com">'+
'<button class="btn primary" id="gSend">Email me a sign-in link</button>'+
'<div id="gCodeBox" hidden style="display:grid;gap:8px"><label class="label" for="gCode">Code from the email (if it shows one)</label><input class="inp" id="gCode" inputmode="numeric" autocomplete="one-time-code" placeholder="6 to 8 digit code"><button class="btn" id="gVerify">Sign in with code</button></div>'+
'<div class="msg" id="gMsg" role="status"></div><button class="link" id="gSkip">Continue on this device only</button></div>';
document.body.appendChild(gate);
const gMsg=(t,err)=>{const m=$('#gMsg');m.textContent=t;m.className='msg'+(err?' err':'')};
function showGate(){gate.hidden=false}
function hideGate(){gate.hidden=true}
$('#gSkip').addEventListener('click',hideGate);
$('#gSend').addEventListener('click',async()=>{
  const em=$('#gEmail').value.trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){gMsg('Enter a valid email address.',true);return}
  gMsg('Sending…');$('#gSend').disabled=true;
  const {error}=await sb.auth.signInWithOtp({email:em,options:{emailRedirectTo:location.origin+location.pathname}});
  $('#gSend').disabled=false;
  if(error){gMsg(error.message,true);return}
  gMsg('Check your inbox and open the link on this device.');
  $('#gCodeBox').hidden=false;
});
$('#gVerify').addEventListener('click',async()=>{
  const em=$('#gEmail').value.trim(),code=$('#gCode').value.trim();
  if(!code){gMsg('Enter the code from the email.',true);return}
  gMsg('Checking…');
  const {error}=await sb.auth.verifyOtp({email:em,token:code,type:'email'});
  if(error)gMsg(error.message,true);
});

/* account row inside Settings */
const setSheet=document.querySelector('#setWrap .sheet');
const acct=document.createElement('div');
acct.innerHTML='<span class="label">Account</span><div id="acctRow" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span id="acctText" style="flex:1;min-width:0;overflow-wrap:anywhere;color:var(--ink-2)"></span><button class="btn small" id="acctBtn"></button></div>';
if(setSheet)setSheet.insertBefore(acct,setSheet.querySelector(':scope > .sheet-actions'));
function renderAcct(){
  $('#acctText').textContent=userId?('Signed in as '+email):'Not signed in. Data stays on this device.';
  $('#acctBtn').textContent=userId?'Sign out':'Sign in';
}
$('#acctBtn').addEventListener('click',async()=>{
  if(userId){await sb.auth.signOut()}else{showGate()}
  const w=$('#setWrap');w.classList.remove('on');setTimeout(()=>{w.hidden=true},220);
});

function onSession(session){
  if(session&&session.user){
    if(userId===session.user.id)return;
    userId=session.user.id;email=session.user.email||'';
    hideGate();renderAcct();
    setTimeout(startSync,0);
  }else if(userId){
    userId=null;email='';startedFor=null;synced=null;
    if(channel){sb.removeChannel(channel);channel=null}
    setStatus('Not signed in');renderAcct();showGate();
  }
}
sb.auth.onAuthStateChange((ev,session)=>{setTimeout(()=>onSession(session),0)});
renderAcct();
sb.auth.getSession().then(r=>{
  const session=r&&r.data&&r.data.session;
  if(session)onSession(session);else showGate();
});

/* tiny test hook */
window.__LKSYNC={toRows:toRows,fromRows:fromRows,snap:snap,sameSnap:sameSnap};
})();
