// ============================================================
// game.js — Robo Tug of War v3
// Fixes: Firebase join/host race condition, array→object conversion,
//        status flow rewrite, guest game start, settings (Q+time)
// ============================================================
'use strict';

// ── Runtime settings (overridden by player choices) ──────────
let TOTAL_Q   = 12;
let TOTAL_SEC = 100;
const FB_KEY  = 'robotug_firebase_config';

// ── DOM helper ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const SCREEN_IDS = ['start','local-setup','online-setup','waiting','game','end'];
const screens = SCREEN_IDS.reduce((o,n) => { o[n] = $('screen-'+n); return o; }, {});

function showScreen(name) {
  SCREEN_IDS.forEach(n => { screens[n].style.display='none'; screens[n].classList.remove('active'); });
  screens[name].style.display = 'flex';
  requestAnimationFrame(() => screens[name].classList.add('active'));
}

// ── Runtime state ─────────────────────────────────────────────
let gameMode      = null;
let onlineRole    = null;
let myPIdx        = null;
let currentCode   = null;
let roomRef       = null;
let fbDb          = null;
let fbUnsub       = null;
let gs            = null;
let timerInterval = null;
let timeLeft      = 0;

// ═══════════════════════════════════════════════════════════
//  SCREEN NAVIGATION
// ═══════════════════════════════════════════════════════════
$('btn-mode-local').onclick  = () => showScreen('local-setup');
$('btn-mode-online').onclick = () => { showScreen('online-setup'); initOnlineSetup(); };
$('btn-back-local').onclick  = () => showScreen('start');
$('btn-back-online').onclick = () => showScreen('start');

// ═══════════════════════════════════════════════════════════
//  SETTINGS HELPERS
// ═══════════════════════════════════════════════════════════
function readLocalSettings() {
  TOTAL_Q   = parseInt($('local-q-count').value,   10) || 12;
  TOTAL_SEC = parseInt($('local-time-limit').value, 10) || 100;
}
function readOnlineSettings() {
  TOTAL_Q   = parseInt($('online-q-count').value,   10) || 12;
  TOTAL_SEC = parseInt($('online-time-limit').value, 10) || 100;
}

// ═══════════════════════════════════════════════════════════
//  LOCAL MODE
// ═══════════════════════════════════════════════════════════
$('btn-start-local').onclick = startLocalGame;
$('p1-name').addEventListener('keydown', e => { if(e.key==='Enter') startLocalGame(); });
$('p2-name').addEventListener('keydown', e => { if(e.key==='Enter') startLocalGame(); });

function startLocalGame() {
  readLocalSettings();
  gameMode   = 'local';
  const p1n  = $('p1-name').value.trim() || 'Red Bot';
  const p2n  = $('p2-name').value.trim() || 'Blue Bot';
  const pool = loadQuestions(TOTAL_Q);
  gs = makeGS(p1n, p2n, shuffleArr([...pool]), shuffleArr([...pool]));
  $('online-badge').style.display = 'none';
  renderGame('local');
  showScreen('game');
  startTimer();
}

// ═══════════════════════════════════════════════════════════
//  GAME STATE FACTORY
// ═══════════════════════════════════════════════════════════
function makeGS(p1n, p2n, p1qs, p2qs) {
  return {
    players: [
      { name:p1n, questions:p1qs, qIndex:0, score:0, streak:0, done:false, locked:false },
      { name:p2n, questions:p2qs, qIndex:0, score:0, streak:0, done:false, locked:false },
    ],
    ropePos: 50, gameOver: false,
  };
}

// ═══════════════════════════════════════════════════════════
//  FIREBASE — CONNECTION
// ═══════════════════════════════════════════════════════════
function initOnlineSetup() {
  const saved = loadFbCfg();
  if (saved) {
    showLobby();
    connectFirebase(saved).catch(() => { showConfigForm(); $('config-error').textContent='⚠️ Saved config failed. Re-enter.'; });
  } else { showConfigForm(); }
}
function showConfigForm() { $('firebase-config-section').style.display='block'; $('lobby-section').style.display='none'; }
function showLobby()      { $('firebase-config-section').style.display='none';  $('lobby-section').style.display='block'; }

$('btn-save-config').onclick = async () => {
  const cfg = {
    apiKey:$('fb-apiKey').value.trim(), authDomain:$('fb-authDomain').value.trim(),
    databaseURL:$('fb-databaseURL').value.trim(), projectId:$('fb-projectId').value.trim()
  };
  if (!cfg.apiKey || !cfg.databaseURL) { $('config-error').textContent='⚠️ API Key and Database URL required.'; return; }
  $('config-error').textContent='Connecting…';
  try { await connectFirebase(cfg); saveFbCfg(cfg); $('config-error').textContent=''; showLobby(); }
  catch(e) { $('config-error').textContent='✗ '+e.message; }
};
$('btn-reset-config').onclick = () => { localStorage.removeItem(FB_KEY); fbDb=null; showConfigForm(); };

async function connectFirebase(cfg) {
  const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getDatabase, ref, get }          = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  if (!getApps().length) initializeApp(cfg);
  fbDb = getDatabase(getApp());
  await get(ref(fbDb, '.info/connected'));   // throws if config wrong
}

// ═══════════════════════════════════════════════════════════
//  CREATE ROOM (HOST)
//
//  Flow:
//    host writes status:'waiting'
//    → guest reads room, writes name + status:'ready'
//    → host listener sees 'ready', writes status:'playing'
//    → guest listener sees 'playing', both call launchGame()
// ═══════════════════════════════════════════════════════════
$('btn-create-room').onclick = async () => {
  const name = $('host-name').value.trim() || 'Red Bot';
  $('lobby-error').textContent = 'Creating room…';
  readOnlineSettings();
  const code = genCode();
  try {
    await doCreateRoom(code, name);
    currentCode = code;
    $('room-code-display').textContent = code;
    $('waiting-status').textContent = '⏳ Waiting for opponent to join…';
    showScreen('waiting');
    hostWatchForReady(code);
  } catch(e) { $('lobby-error').textContent='✗ '+e.message; }
};

async function doCreateRoom(code, hostName) {
  const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  const pool = loadQuestions(TOTAL_Q);
  const p1qs = shuffleArr([...pool]).map(q=>({q:q.q,options:q.options,answer:q.answer}));
  const p2qs = shuffleArr([...pool]).map(q=>({q:q.q,options:q.options,answer:q.answer}));
  roomRef = ref(fbDb, `rooms/${code}`);
  await set(roomRef, {
    status:'waiting', createdAt:Date.now(), totalQ:TOTAL_Q, totalSec:TOTAL_SEC,
    ropePos:50, gameOver:false,
    players:{
      p1:{name:hostName, score:0, qIndex:0, streak:0, done:false, questions:p1qs},
      p2:{name:'',       score:0, qIndex:0, streak:0, done:false, questions:p2qs},
    }
  });
  onlineRole='host'; myPIdx=0; gameMode='online';
}

async function hostWatchForReady(code) {
  const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  const unsub = onValue(ref(fbDb,`rooms/${code}/status`), async snap => {
    if (snap.val() === 'ready') {
      unsub();
      // Flip to 'playing' — this is the signal for both sides to launch
      const { ref:r2, update } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
      await update(r2(fbDb,`rooms/${code}`), { status:'playing' });
      await launchGame(code);
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  JOIN ROOM (GUEST)
// ═══════════════════════════════════════════════════════════
$('btn-join-room').onclick = async () => {
  const name = $('joiner-name').value.trim() || 'Blue Bot';
  const code = $('join-code').value.trim().toUpperCase();
  $('lobby-error').textContent = '';
  if (!code) { $('lobby-error').textContent='⚠️ Enter a room code.'; return; }
  $('lobby-error').textContent = 'Joining…';
  try {
    await doJoinRoom(code, name);
    // Don't block on lobby — listen for host to flip 'playing'
    $('lobby-error').textContent = '✅ Joined! Waiting for host…';
    guestWatchForPlaying(code);
  } catch(e) { $('lobby-error').textContent='✗ '+e.message; }
};

async function doJoinRoom(code, guestName) {
  const { ref, get, update } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  const snap = await get(ref(fbDb, `rooms/${code}`));
  if (!snap.exists()) throw new Error('Room not found. Check the code.');
  const data = snap.val();
  // Only block if already playing or ended (not waiting/ready)
  if (data.status === 'playing') throw new Error('Game already in progress. Ask host for a new room.');
  if (data.status === 'ended')   throw new Error('This game has ended. Ask host for a new room.');

  TOTAL_Q   = data.totalQ   || 12;
  TOTAL_SEC = data.totalSec || 100;
  roomRef     = ref(fbDb, `rooms/${code}`);
  currentCode = code;
  onlineRole  = 'guest';
  myPIdx      = 1;
  gameMode    = 'online';

  // Write name then flip status — both in one update to minimise listener races
  await update(ref(fbDb, `rooms/${code}`), {
    'players/p2/name': guestName,
    status: 'ready',
  });
}

async function guestWatchForPlaying(code) {
  const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  const unsub = onValue(ref(fbDb,`rooms/${code}/status`), async snap => {
    if (snap.val() === 'playing') {
      unsub();
      await launchGame(code);
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  LAUNCH GAME (called by both host and guest)
// ═══════════════════════════════════════════════════════════
async function launchGame(code) {
  const { ref, get, onValue } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  const snap = await get(ref(fbDb, `rooms/${code}`));
  if (!snap.exists()) { alert('Room data missing. Please restart.'); return; }
  const data = snap.val();

  // Firebase can store arrays as numeric-keyed objects — restore them
  const fixArr = v => v ? Object.values(v) : [];

  gs = makeGS(
    data.players.p1.name, data.players.p2.name,
    fixArr(data.players.p1.questions), fixArr(data.players.p2.questions)
  );
  gs.ropePos  = data.ropePos  || 50;
  gs.gameOver = data.gameOver || false;
  TOTAL_Q     = data.totalQ   || TOTAL_Q;
  TOTAL_SEC   = data.totalSec || TOTAL_SEC;

  $('online-badge').style.display = 'inline';
  renderGame('online');
  showScreen('game');
  startTimer();

  // Subscribe to live updates
  if (fbUnsub) fbUnsub();
  fbUnsub = onValue(ref(fbDb, `rooms/${code}`), snap => {
    if (snap.exists()) handleRemote(snap.val());
  });
}

// ── Handle incoming Firebase update ──────────────────────────
function handleRemote(remote) {
  if (!gs) return;
  const theirIdx = myPIdx === 0 ? 1 : 0;
  const theirKey = theirIdx === 0 ? 'p1' : 'p2';
  const them = remote.players && remote.players[theirKey];
  if (!them) return;

  gs.players[theirIdx].score  = them.score  || 0;
  gs.players[theirIdx].qIndex = them.qIndex || 0;
  gs.players[theirIdx].streak = them.streak || 0;
  gs.players[theirIdx].done   = them.done   || false;

  if (remote.ropePos !== undefined) { gs.ropePos = remote.ropePos; updateRope(gs.ropePos); }
  $(`score-p${theirIdx+1}`).textContent = them.score || 0;

  if (!gs.gameOver) {
    if (them.done && gs.players[myPIdx].done) triggerEndGame('scores');
    else if (them.done) triggerEndGame('finish', theirIdx);
  }
  if (remote.gameOver && !gs.gameOver) { gs.gameOver=true; clearInterval(timerInterval); }
}

// ── Push my state ─────────────────────────────────────────────
async function pushState(p) {
  if (!roomRef) return;
  try {
    const { update } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const k = myPIdx===0?'p1':'p2';
    await update(roomRef, {
      [`players/${k}/score`]:  p.score,
      [`players/${k}/qIndex`]: p.qIndex,
      [`players/${k}/streak`]: p.streak,
      [`players/${k}/done`]:   p.done,
      ropePos: gs.ropePos,
    });
  } catch(e) { console.warn('pushState:', e.message); }
}
async function pushGameOver() {
  if (!roomRef) return;
  try {
    const { update } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    await update(roomRef, { gameOver:true, status:'ended' });
  } catch(_) {}
}

// ═══════════════════════════════════════════════════════════
//  CANCEL ROOM
// ═══════════════════════════════════════════════════════════
$('btn-cancel-room').onclick = async () => {
  if (roomRef && onlineRole==='host') {
    try { const {remove}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'); await remove(roomRef); } catch(_) {}
  }
  roomRef=null; currentCode=null;
  showScreen('online-setup');
};

// ═══════════════════════════════════════════════════════════
//  RENDER GAME SCREEN
// ═══════════════════════════════════════════════════════════
function renderGame(mode) {
  const [p1,p2] = gs.players;
  $('name-p1').textContent  = p1.name;  $('name-p2').textContent  = p2.name;
  $('qtag-p1').textContent  = p1.name.substring(0,8);
  $('qtag-p2').textContent  = p2.name.substring(0,8);
  $('score-p1').textContent = '0';      $('score-p2').textContent = '0';
  $('timer-text').textContent = TOTAL_SEC;
  $('timer-bar').style.cssText = 'width:100%';
  $('timer-text').style.color  = '';
  initPips(0); initPips(1);
  updateRope(50);

  const panelClean = id => $(id).classList.remove('solo','waiting-overlay','done-panel','correct-flash','wrong-flash');
  panelClean('q-panel-p1'); panelClean('q-panel-p2');
  $('q-panel-p1').style.display = 'flex';
  $('q-panel-p2').style.display = 'flex';

  if (mode==='local') {
    setKbdHints('qopts-p1',['1','2','3','4']);
    setKbdHints('qopts-p2',['7','8','9','0']);
    loadQ(0); loadQ(1);
  } else {
    const myPanel    = `q-panel-p${myPIdx+1}`;
    const theirPanel = `q-panel-p${myPIdx===0?2:1}`;
    $(theirPanel).classList.add('waiting-overlay');
    setKbdHints(`qopts-p${myPIdx+1}`,['A','B','C','D']);
    loadQ(myPIdx);
    // Clear opponent panel contents
    const ti = myPIdx===0?1:0;
    $(`qtext-p${ti+1}`).textContent='';
    $(`qopts-p${ti+1}`).querySelectorAll('.opt-btn').forEach(b=>{b.querySelector('span').textContent='';b.disabled=true;});
  }
}
function setKbdHints(optsId, keys) {
  $(optsId).querySelectorAll('.opt-btn').forEach((b,i)=>{const k=b.querySelector('kbd');if(k)k.textContent=keys[i]||'';});
}

// ═══════════════════════════════════════════════════════════
//  PIPS
// ═══════════════════════════════════════════════════════════
function initPips(pIdx) {
  const el = $(`pips-p${pIdx+1}`); el.innerHTML='';
  const shown = Math.min(TOTAL_Q, 20);
  for(let i=0;i<shown;i++){
    const p=document.createElement('div'); p.className='pip'; p.id=`pip-p${pIdx+1}-${i}`; el.appendChild(p);
  }
}

// ═══════════════════════════════════════════════════════════
//  QUESTIONS
// ═══════════════════════════════════════════════════════════
function loadQ(pIdx) {
  const p=gs.players[pIdx], sfx=pIdx===0?'p1':'p2', q=p.questions[p.qIndex];
  if(!q) return;
  $(`qcount-${sfx}`).textContent    = `Q ${p.qIndex+1}/${TOTAL_Q}`;
  $(`qtext-${sfx}`).textContent     = q.q;
  $(`qfeedback-${sfx}`).textContent = '';
  $(`qfeedback-${sfx}`).className   = 'q-feedback';
  $(`streak-${sfx}`).textContent    = p.streak>=3?`🔥×${p.streak}`:'';
  $(`qopts-${sfx}`).querySelectorAll('.opt-btn').forEach((btn,i)=>{
    btn.querySelector('span').textContent=q.options[i]; btn.className='opt-btn'; btn.disabled=false;
    btn.onclick=()=>handleAnswer(pIdx,i);
  });
  $(`q-panel-${sfx}`).classList.remove('done-panel','correct-flash','wrong-flash');
}

function handleAnswer(pIdx, chosenIdx) {
  if(gameMode==='online' && pIdx!==myPIdx) return;
  const p=gs.players[pIdx];
  if(p.done||p.locked||gs.gameOver) return;
  p.locked=true;
  const q=p.questions[p.qIndex], sfx=pIdx===0?'p1':'p2', ok=chosenIdx===q.answer;

  $(`qopts-${sfx}`).querySelectorAll('.opt-btn').forEach((btn,i)=>{
    btn.disabled=true;
    if(i===q.answer) btn.classList.add('correct-ans');
    if(i===chosenIdx&&!ok) btn.classList.add('wrong-ans');
  });

  const pip=$(`pip-p${pIdx+1}-${Math.min(p.qIndex,19)}`);
  if(ok){
    p.score++;p.streak++;
    if(pip) pip.classList.add('correct');
    $(`score-p${pIdx+1}`).textContent=p.score;
    $(`qfeedback-${sfx}`).textContent=p.streak>=3?`🔥 On fire! ×${p.streak}`:'✓ Correct!';
    $(`qfeedback-${sfx}`).className='q-feedback correct';
    $(`q-panel-${sfx}`).classList.add('correct-flash');
    const pull=5+(p.streak>=3?2:0);
    gs.ropePos=pIdx===0?Math.max(0,gs.ropePos-pull):Math.min(100,gs.ropePos+pull);
    updateRope(gs.ropePos); triggerPullAnim(pIdx);
  } else {
    p.streak=0;
    if(pip) pip.classList.add('wrong');
    $(`qfeedback-${sfx}`).textContent=`✗ ${q.options[q.answer]}`;
    $(`qfeedback-${sfx}`).className='q-feedback wrong';
    $(`q-panel-${sfx}`).classList.add('wrong-flash');
    triggerWrongAnim(pIdx);
  }

  setTimeout(async ()=>{
    p.qIndex++;
    if(p.qIndex>=TOTAL_Q){
      p.done=true;
      $(`q-panel-${sfx}`).classList.add('done-panel');
      $(`streak-${sfx}`).textContent='';
      if(gameMode==='online') await pushState(p);
      if(!gs.gameOver){
        const other=gs.players[1-pIdx];
        if(other.done) triggerEndGame('scores'); else triggerEndGame('finish',pIdx);
      }
    } else {
      p.locked=false;
      if(gameMode==='online') await pushState(p);
      loadQ(pIdx);
    }
  },900);
}

// ═══════════════════════════════════════════════════════════
//  ROPE & ROBOTS
// ═══════════════════════════════════════════════════════════
function updateRope(pos) {
  $('rope-marker').style.left=`calc(${pos}% - 2px)`;
  $('rope-flag').style.left=`${pos}%`;
  const s=$('rope').style;
  if(pos<30)      s.boxShadow='0 3px 15px rgba(255,60,90,.5),inset 0 1px 2px rgba(255,255,255,.15)';
  else if(pos>70) s.boxShadow='0 3px 15px rgba(0,212,255,.5),inset 0 1px 2px rgba(255,255,255,.15)';
  else            s.boxShadow='0 3px 8px rgba(0,0,0,.6),inset 0 1px 2px rgba(255,255,255,.15)';
}
function triggerPullAnim(pIdx){
  const r=$(`robo-p${pIdx+1}`);r.classList.remove('pulling','wrong-anim');void r.offsetWidth;
  r.classList.add('pulling');r.addEventListener('animationend',()=>r.classList.remove('pulling'),{once:true});
}
function triggerWrongAnim(pIdx){
  const r=$(`robo-p${pIdx+1}`);r.classList.remove('pulling','wrong-anim');void r.offsetWidth;
  r.classList.add('wrong-anim');r.addEventListener('animationend',()=>r.classList.remove('wrong-anim'),{once:true});
}

// ═══════════════════════════════════════════════════════════
//  TIMER
// ═══════════════════════════════════════════════════════════
function startTimer(){
  timeLeft=TOTAL_SEC; clearInterval(timerInterval);
  $('timer-text').textContent=timeLeft; $('timer-bar').style.width='100%';
  timerInterval=setInterval(()=>{
    timeLeft--;
    $('timer-text').textContent=timeLeft;
    $('timer-bar').style.width=Math.max(0,timeLeft/TOTAL_SEC*100)+'%';
    if(timeLeft<=10){$('timer-bar').style.background='linear-gradient(90deg,#ff3c5a,#ff0000)';$('timer-text').style.color='#ff3c5a';}
    else if(timeLeft<=30){$('timer-bar').style.background='linear-gradient(90deg,#ffd700,#ff7700)';$('timer-text').style.color='#ffd700';}
    if(timeLeft<=0&&!gs.gameOver) triggerEndGame('time');
  },1000);
}

// ═══════════════════════════════════════════════════════════
//  END GAME
// ═══════════════════════════════════════════════════════════
async function triggerEndGame(reason,winnerPIdx){
  if(!gs||gs.gameOver) return;
  gs.gameOver=true; clearInterval(timerInterval);
  document.querySelectorAll('.opt-btn').forEach(b=>b.disabled=true);
  gs.players.forEach(p=>p.locked=true);
  if(gameMode==='online') await pushGameOver();
  const [p1,p2]=gs.players;
  let winner=null,winTitle='',winReason='';
  if(reason==='finish'){winner=winnerPIdx;winTitle=`${gs.players[winnerPIdx].name} WINS!`;winReason='🏆 First to finish!';}
  else if(reason==='time'){
    if(p1.score>p2.score){winner=0;winTitle=`${p1.name} WINS!`;winReason="⏱ Time's up — most correct!";}
    else if(p2.score>p1.score){winner=1;winTitle=`${p2.name} WINS!`;winReason="⏱ Time's up — most correct!";}
    else{winTitle="IT'S A DRAW!";winReason="⏱ Time's up — perfectly matched!";}
  } else {
    if(p1.score>p2.score){winner=0;winTitle=`${p1.name} WINS!`;winReason='🎯 Better accuracy!';}
    else if(p2.score>p1.score){winner=1;winTitle=`${p2.name} WINS!`;winReason='🎯 Better accuracy!';}
    else{winTitle="IT'S A DRAW!";winReason='🤝 Equal brilliance!';}
  }
  setTimeout(()=>{
    $('win-title').textContent=winTitle; $('win-reason').textContent=winReason;
    $('fs-name-p1').textContent=p1.name; $('fs-name-p2').textContent=p2.name;
    $('fs-score-p1').textContent=`${p1.score}/${TOTAL_Q}`; $('fs-score-p2').textContent=`${p2.score}/${TOTAL_Q}`;
    $('final-p1').classList.toggle('winner-card',winner===0); $('final-p2').classList.toggle('winner-card',winner===1);
    $('win-bot').textContent=winner===null?'🤝':'🏆';
    launchFireworks(); showScreen('end');
  },600);
}

$('btn-restart').onclick = async ()=>{
  clearInterval(timerInterval);
  if(fbUnsub){fbUnsub();fbUnsub=null;}
  if(gameMode==='online'&&roomRef&&onlineRole==='host'){
    try{const{remove}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');await remove(roomRef);}catch(_){}
  }
  roomRef=null;currentCode=null;gs=null;gameMode=null;onlineRole=null;myPIdx=null;
  $('timer-bar').style.background='';$('timer-text').style.color='';$('lobby-error').textContent='';
  showScreen('start');
};

// ═══════════════════════════════════════════════════════════
//  KEYBOARD (local only)
// ═══════════════════════════════════════════════════════════
document.addEventListener('keydown',e=>{
  if(!gs||gs.gameOver||gameMode!=='local') return;
  const p1k={'1':0,'2':1,'3':2,'4':3},p2k={'7':0,'8':1,'9':2,'0':3};
  if(p1k[e.key]!==undefined&&!gs.players[0].locked&&!gs.players[0].done) handleAnswer(0,p1k[e.key]);
  if(p2k[e.key]!==undefined&&!gs.players[1].locked&&!gs.players[1].done) handleAnswer(1,p2k[e.key]);
});

// ═══════════════════════════════════════════════════════════
//  FIREWORKS
// ═══════════════════════════════════════════════════════════
function launchFireworks(){
  const c=$('fireworks');c.innerHTML='';
  const cols=['#ffd700','#ff3c5a','#00d4ff','#00ff88','#ff7700','#ff69b4'];
  for(let b=0;b<7;b++){
    const bx=Math.random()*window.innerWidth,by=Math.random()*window.innerHeight*.6+50,dl=b*.2;
    for(let i=0;i<20;i++){
      const sp=document.createElement('div');sp.className='spark';
      const ang=(i/20)*Math.PI*2,d=80+Math.random()*90;
      sp.style.cssText=`left:${bx}px;top:${by}px;background:${cols[~~(Math.random()*cols.length)]};--tx:${Math.cos(ang)*d}px;--ty:${Math.sin(ang)*d}px;--dur:${.6+Math.random()*.5}s;--delay:${dl+Math.random()*.2}s;border-radius:${Math.random()>.5?'50%':'0'}`;
      c.appendChild(sp);
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════
function shuffleArr(a){for(let i=a.length-1;i>0;i--){const j=~~(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function genCode(){return Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[~~(Math.random()*32)]).join('');}
function saveFbCfg(c){localStorage.setItem(FB_KEY,JSON.stringify(c));}
function loadFbCfg(){try{return JSON.parse(localStorage.getItem(FB_KEY));}catch(_){return null;}}

window.addEventListener('load',()=>showScreen('start'));
