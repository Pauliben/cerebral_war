// ============================================================
// game.js — Robo Tug of War v2
// Supports: Local (same screen) + Online (Firebase)
// ============================================================

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_Q   = 12;
const TOTAL_SEC = 100;
const FB_STORAGE_KEY = 'robotug_firebase_config';

// ── DOM helpers ──────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = ['start','local-setup','online-setup','waiting','game','end']
  .reduce((o,n) => { o[n] = $('screen-'+n); return o; }, {});

function showScreen(name) {
  Object.values(screens).forEach(s => { s.style.display='none'; s.classList.remove('active'); });
  const s = screens[name];
  s.style.display = 'flex';
  requestAnimationFrame(() => s.classList.add('active'));
}

// ── Mode tracking ────────────────────────────────────────────
let gameMode     = null;  // 'local' | 'online'
let onlineRole   = null;  // 'host' | 'guest'
let myPlayerIdx  = null;  // 0 = P1, 1 = P2  (online only)
let roomRef      = null;  // Firebase DB ref
let fbDatabase   = null;  // Firebase database instance
let fbApp        = null;

// ── Game state (local authority in local mode; shared via Firebase online) ──
let gs           = null;
let timerInterval = null;
let timeLeft     = TOTAL_SEC;

// ═══════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════

$('btn-mode-local').onclick  = () => showScreen('local-setup');
$('btn-mode-online').onclick = () => {
  showScreen('online-setup');
  initOnlineSetup();
};
$('btn-back-local').onclick  = () => showScreen('start');
$('btn-back-online').onclick = () => showScreen('start');

// ═══════════════════════════════════════════════════════════
//  LOCAL MODE
// ═══════════════════════════════════════════════════════════

$('btn-start-local').onclick = startLocalGame;
$('p1-name').addEventListener('keydown', e => { if(e.key==='Enter') startLocalGame(); });
$('p2-name').addEventListener('keydown', e => { if(e.key==='Enter') startLocalGame(); });

function startLocalGame() {
  gameMode = 'local';
  const p1name = $('p1-name').value.trim() || 'Red Bot';
  const p2name = $('p2-name').value.trim() || 'Blue Bot';

  const pool = loadQuestions();
  gs = {
    players: [
      { id:1, name:p1name, questions: shuffleArr([...pool]), qIndex:0, score:0, streak:0, done:false, locked:false },
      { id:2, name:p2name, questions: shuffleArr([...pool]), qIndex:0, score:0, streak:0, done:false, locked:false },
    ],
    ropePos: 50,
    gameOver: false,
  };

  $('online-badge').style.display = 'none';
  renderGameScreen('local');
  showScreen('game');
  startTimer();
}

// ═══════════════════════════════════════════════════════════
//  ONLINE SETUP — Firebase
// ═══════════════════════════════════════════════════════════

function initOnlineSetup() {
  const saved = loadFbConfig();
  if (saved) {
    showLobby();
    connectFirebase(saved).catch(() => {
      showConfigForm();
      $('config-error').textContent = '⚠️ Could not connect with saved config. Please re-enter.';
    });
  } else {
    showConfigForm();
  }
}

function showConfigForm() {
  $('firebase-config-section').style.display = 'block';
  $('lobby-section').style.display = 'none';
}
function showLobby() {
  $('firebase-config-section').style.display = 'none';
  $('lobby-section').style.display = 'block';
}

$('btn-save-config').onclick = async () => {
  const cfg = {
    apiKey:      $('fb-apiKey').value.trim(),
    authDomain:  $('fb-authDomain').value.trim(),
    databaseURL: $('fb-databaseURL').value.trim(),
    projectId:   $('fb-projectId').value.trim(),
  };
  if (!cfg.apiKey || !cfg.databaseURL) {
    $('config-error').textContent = '⚠️ API Key and Database URL are required.'; return;
  }
  $('config-error').textContent = 'Connecting…';
  try {
    await connectFirebase(cfg);
    saveFbConfig(cfg);
    $('config-error').textContent = '';
    showLobby();
  } catch(e) {
    $('config-error').textContent = '✗ Connection failed: ' + e.message;
  }
};

$('btn-reset-config').onclick = () => {
  localStorage.removeItem(FB_STORAGE_KEY);
  fbApp = null; fbDatabase = null;
  showConfigForm();
};

// ── Firebase connect (dynamic import of Firebase SDK) ───────
async function connectFirebase(cfg) {
  // Dynamically load Firebase from CDN
  const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getDatabase } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');

  if (!getApps().length) {
    fbApp = initializeApp(cfg);
  } else {
    fbApp = getApp();
  }
  fbDatabase = getDatabase(fbApp);
  // Quick connectivity test — just having the db object is enough; errors surface on first read/write
}

// ── Create room ──────────────────────────────────────────────
$('btn-create-room').onclick = async () => {
  const name = $('host-name').value.trim() || 'Red Bot';
  $('lobby-error').textContent = '';
  const code = genRoomCode();
  try {
    await createRoom(code, name);
    $('room-code-display').textContent = code;
    $('waiting-status').textContent = '⏳ Waiting for opponent to join…';
    showScreen('waiting');
    listenForGuest(code);
  } catch(e) {
    $('lobby-error').textContent = '✗ Could not create room: ' + e.message;
  }
};

// ── Join room ────────────────────────────────────────────────
$('btn-join-room').onclick = async () => {
  const name = $('joiner-name').value.trim() || 'Blue Bot';
  const code = $('join-code').value.trim().toUpperCase();
  $('lobby-error').textContent = '';
  if (!code) { $('lobby-error').textContent = '⚠️ Enter a room code.'; return; }
  try {
    await joinRoom(code, name);
  } catch(e) {
    $('lobby-error').textContent = '✗ ' + e.message;
  }
};

$('btn-cancel-room').onclick = async () => {
  if (roomRef) {
    try {
      const { remove } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
      await remove(roomRef);
    } catch(_) {}
    roomRef = null;
  }
  showScreen('online-setup');
};

// ── Firebase room helpers ────────────────────────────────────
async function createRoom(code, hostName) {
  const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  const pool = loadQuestions();
  const p1Qs = shuffleArr([...pool]);
  const p2Qs = shuffleArr([...pool]);

  roomRef = ref(fbDatabase, `rooms/${code}`);
  const roomData = {
    status: 'waiting',
    createdAt: Date.now(),
    ropePos: 50,
    gameOver: false,
    players: {
      p1: { name: hostName, score: 0, qIndex: 0, streak: 0, done: false,
            questions: p1Qs.map(q => ({ q:q.q, options:q.options, answer:q.answer })) },
      p2: { name: '', score: 0, qIndex: 0, streak: 0, done: false,
            questions: p2Qs.map(q => ({ q:q.q, options:q.options, answer:q.answer })) },
    },
    timer: { start: null, running: false },
  };
  await set(roomRef, roomData);
  onlineRole  = 'host';
  myPlayerIdx = 0;
  gameMode    = 'online';
}

async function joinRoom(code, guestName) {
  const { ref, get, update } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  const snap = await get(ref(fbDatabase, `rooms/${code}`));
  if (!snap.exists()) throw new Error('Room not found. Check the code and try again.');
  const data = snap.val();
  if (data.status !== 'waiting') throw new Error('Room is already in progress or has ended.');

  roomRef     = ref(fbDatabase, `rooms/${code}`);
  onlineRole  = 'guest';
  myPlayerIdx = 1;
  gameMode    = 'online';

  await update(ref(fbDatabase, `rooms/${code}/players/p2`), { name: guestName });
  await update(ref(fbDatabase, `rooms/${code}`), { status: 'ready' });
}

// ── Host waits for guest, then starts ────────────────────────
async function listenForGuest(code) {
  const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  const statusRef = ref(fbDatabase, `rooms/${code}/status`);
  const unsub = onValue(statusRef, async snap => {
    if (snap.val() === 'ready') {
      unsub(); // stop listening
      await startOnlineGame(code);
    }
  });
}

// ── Start online game ────────────────────────────────────────
async function startOnlineGame(code) {
  const { ref, get, update, onValue } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');

  const snap = await get(ref(fbDatabase, `rooms/${code}`));
  const data = snap.val();

  // Build local gs from Firebase data
  gs = {
    players: [
      { name: data.players.p1.name, questions: data.players.p1.questions,
        qIndex: data.players.p1.qIndex, score: data.players.p1.score,
        streak: data.players.p1.streak, done: data.players.p1.done, locked: false },
      { name: data.players.p2.name, questions: data.players.p2.questions,
        qIndex: data.players.p2.qIndex, score: data.players.p2.score,
        streak: data.players.p2.streak, done: data.players.p2.done, locked: false },
    ],
    ropePos:  data.ropePos,
    gameOver: data.gameOver,
  };

  // Mark game started
  const now = Date.now();
  await update(roomRef, { status: 'playing', 'timer/start': now, 'timer/running': true });

  $('online-badge').style.display = 'inline';
  renderGameScreen('online');
  showScreen('game');

  // Start local timer
  timeLeft = TOTAL_SEC;
  startTimer();

  // Subscribe to remote changes
  onValue(roomRef, snap => {
    if (!snap.exists()) return;
    const remote = snap.val();
    handleRemoteUpdate(remote);
  });
}

// ── Handle Firebase updates on both clients ──────────────────
function handleRemoteUpdate(remote) {
  if (!gs || gs.gameOver) return;

  const theirIdx = myPlayerIdx === 0 ? 1 : 0;
  const theirKey = theirIdx === 0 ? 'p1' : 'p2';
  const remotePlyr = remote.players[theirKey];

  // Sync opponent's state into local gs
  gs.players[theirIdx].score   = remotePlyr.score;
  gs.players[theirIdx].qIndex  = remotePlyr.qIndex;
  gs.players[theirIdx].streak  = remotePlyr.streak;
  gs.players[theirIdx].done    = remotePlyr.done;

  // Sync rope from Firebase (authoritative)
  gs.ropePos = remote.ropePos;
  updateRope(gs.ropePos);

  // Update opponent score display
  $(`score-p${theirIdx+1}`).textContent = remotePlyr.score;
  updatePips(theirIdx, remotePlyr.qIndex, null); // just show progress

  // Check if opponent finished
  if (remotePlyr.done && !gs.gameOver) {
    const myP = gs.players[myPlayerIdx];
    if (myP.done) {
      triggerEndGame('scores');
    } else {
      triggerEndGame('finish', theirIdx);
    }
  }

  // Check server-set gameOver
  if (remote.gameOver && !gs.gameOver) {
    gs.gameOver = true;
    clearInterval(timerInterval);
  }
}

// ── Push my answer result to Firebase ────────────────────────
async function pushMyStateToFirebase(myP) {
  if (!roomRef) return;
  const { update } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  const myKey = myPlayerIdx === 0 ? 'p1' : 'p2';
  await update(roomRef, {
    [`players/${myKey}/score`]:  myP.score,
    [`players/${myKey}/qIndex`]: myP.qIndex,
    [`players/${myKey}/streak`]: myP.streak,
    [`players/${myKey}/done`]:   myP.done,
    ropePos: gs.ropePos,
  });
}

async function pushGameOver() {
  if (!roomRef) return;
  const { update } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  await update(roomRef, { gameOver: true });
}

// ═══════════════════════════════════════════════════════════
//  RENDER GAME SCREEN
// ═══════════════════════════════════════════════════════════

function renderGameScreen(mode) {
  const p1 = gs.players[0], p2 = gs.players[1];

  $('name-p1').textContent = p1.name;
  $('name-p2').textContent = p2.name;
  $('qtag-p1').textContent = p1.name.substring(0,6);
  $('qtag-p2').textContent = p2.name.substring(0,6);
  $('score-p1').textContent = '0';
  $('score-p2').textContent = '0';

  initPips(0); initPips(1);
  updateRope(50);

  // Timer bar reset
  $('timer-bar').style.width = '100%';
  $('timer-bar').style.background = '';
  $('timer-text').style.color = '';
  $('timer-text').textContent = TOTAL_SEC;

  if (mode === 'local') {
    // Show both panels side by side
    $('q-panel-p1').style.display = 'flex';
    $('q-panel-p2').style.display = 'flex';
    $('q-panel-p1').classList.remove('solo');
    $('q-panel-p2').classList.remove('solo');
    // Restore keyboard hints
    setKeyHints('qopts-p1', ['1','2','3','4']);
    setKeyHints('qopts-p2', ['7','8','9','0']);
    loadQuestion(0);
    loadQuestion(1);

  } else {
    // Online — show only MY panel full-width, other panel shows as spectator view
    const myPanel  = `q-panel-p${myPlayerIdx+1}`;
    const theirPanel = `q-panel-p${(myPlayerIdx===0?1:0)+1}`;

    $('q-panel-p1').style.display = 'flex';
    $('q-panel-p2').style.display = 'flex';
    $(myPanel).classList.add('solo');
    $(theirPanel).classList.add('waiting-overlay');

    // My panel uses tap/click only (no kbd hints)
    setKeyHints(`qopts-p${myPlayerIdx+1}`, ['A','B','C','D']);
    loadQuestion(myPlayerIdx);

    // Opponent panel just shows score/name — questions hidden by overlay
    const theirIdx = myPlayerIdx === 0 ? 1 : 0;
    $(  `qtext-p${theirIdx+1}`).textContent = '…';
    clearOptions(`qopts-p${theirIdx+1}`);
  }
}

function setKeyHints(optsId, keys) {
  const btns = $(optsId).querySelectorAll('.opt-btn');
  btns.forEach((btn, i) => {
    const kbd = btn.querySelector('kbd');
    if (kbd) kbd.textContent = keys[i] || '';
  });
}
function clearOptions(optsId) {
  const btns = $(optsId).querySelectorAll('.opt-btn');
  btns.forEach(btn => { btn.querySelector('span').textContent=''; btn.disabled=true; });
}

// ═══════════════════════════════════════════════════════════
//  QUESTION LOGIC
// ═══════════════════════════════════════════════════════════

function initPips(pIdx) {
  const el = $(`pips-p${pIdx+1}`);
  el.innerHTML = '';
  for (let i=0; i<TOTAL_Q; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip';
    pip.id = `pip-p${pIdx+1}-${i}`;
    el.appendChild(pip);
  }
}

function updatePips(pIdx, upTo, result) {
  // result: 'correct'|'wrong'|null (just fill up to index)
  if (upTo > 0 && result) {
    const pip = $(`pip-p${pIdx+1}-${upTo-1}`);
    if (pip) pip.classList.add(result === true ? 'correct' : 'wrong');
  }
}

function loadQuestion(pIdx) {
  const p = gs.players[pIdx];
  const sfx = pIdx===0?'p1':'p2';
  const q = p.questions[p.qIndex];

  $(`qcount-${sfx}`).textContent = `Q ${p.qIndex+1}/${TOTAL_Q}`;
  $(`qtext-${sfx}`).textContent  = q.q;
  $(`qfeedback-${sfx}`).textContent = '';
  $(`qfeedback-${sfx}`).className = 'q-feedback';
  $(`streak-${sfx}`).textContent  = p.streak >= 3 ? `🔥×${p.streak}` : '';

  const btns = $(`qopts-${sfx}`).querySelectorAll('.opt-btn');
  btns.forEach((btn, i) => {
    btn.querySelector('span').textContent = q.options[i];
    btn.className = 'opt-btn';
    btn.disabled  = false;
    btn.onclick   = () => handleAnswer(pIdx, i);
  });

  $(`q-panel-${sfx}`).classList.remove('done-panel','correct-flash','wrong-flash');
}

function handleAnswer(pIdx, chosenIdx) {
  // In online mode, only allow answering for your own panel
  if (gameMode === 'online' && pIdx !== myPlayerIdx) return;

  const p = gs.players[pIdx];
  if (p.done || p.locked || gs.gameOver) return;

  p.locked = true;
  const q = p.questions[p.qIndex];
  const sfx = pIdx===0?'p1':'p2';
  const correct = chosenIdx === q.answer;

  const btns = $(`qopts-${sfx}`).querySelectorAll('.opt-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer)                btn.classList.add('correct-ans');
    if (i === chosenIdx && !correct)   btn.classList.add('wrong-ans');
  });

  const pip = $(`pip-p${pIdx+1}-${p.qIndex}`);

  if (correct) {
    p.score++;
    p.streak++;
    pip?.classList.add('correct');
    $(`score-p${pIdx+1}`).textContent = p.score;
    $(`qfeedback-${sfx}`).textContent = p.streak >= 3 ? `🔥 On fire! ×${p.streak}` : '✓ Correct!';
    $(`qfeedback-${sfx}`).className   = 'q-feedback correct';
    $(`q-panel-${sfx}`).classList.add('correct-flash');

    const pull = 5 + (p.streak >= 3 ? 2 : 0);
    gs.ropePos = pIdx===0
      ? Math.max(0,  gs.ropePos - pull)
      : Math.min(100, gs.ropePos + pull);
    updateRope(gs.ropePos);
    triggerPullAnim(pIdx);
  } else {
    p.streak = 0;
    pip?.classList.add('wrong');
    $(`qfeedback-${sfx}`).textContent = `✗ ${q.options[q.answer]}`;
    $(`qfeedback-${sfx}`).className   = 'q-feedback wrong';
    $(`q-panel-${sfx}`).classList.add('wrong-flash');
    triggerWrongAnim(pIdx);
  }

  // Advance after feedback delay
  setTimeout(async () => {
    p.qIndex++;
    if (p.qIndex >= TOTAL_Q) {
      p.done = true;
      $(`q-panel-${sfx}`).classList.add('done-panel');
      $(`streak-${sfx}`).textContent = '';

      if (gameMode === 'online') {
        await pushMyStateToFirebase(p);
        if (gs.players[myPlayerIdx===0?1:0].done) triggerEndGame('scores');
        else triggerEndGame('finish', pIdx);
      } else {
        const other = gs.players[1-pIdx];
        if (!gs.gameOver) {
          if (other.done) triggerEndGame('scores');
          else            triggerEndGame('finish', pIdx);
        }
      }
    } else {
      p.locked = false;
      if (gameMode === 'online') await pushMyStateToFirebase(p);
      loadQuestion(pIdx);
    }
  }, 900);
}

// ═══════════════════════════════════════════════════════════
//  ROPE & ROBOT ANIMATIONS
// ═══════════════════════════════════════════════════════════

function updateRope(pos) {
  $('rope-marker').style.left = `calc(${pos}% - 2px)`;
  $('rope-flag').style.left   = `${pos}%`;
  const rope = $('rope');
  if (pos < 30)      rope.style.boxShadow = '0 3px 15px rgba(255,60,90,.5),inset 0 1px 2px rgba(255,255,255,.15)';
  else if (pos > 70) rope.style.boxShadow = '0 3px 15px rgba(0,212,255,.5),inset 0 1px 2px rgba(255,255,255,.15)';
  else               rope.style.boxShadow = '0 3px 8px rgba(0,0,0,.6),inset 0 1px 2px rgba(255,255,255,.15)';
}

function triggerPullAnim(pIdx) {
  const r = $(`robo-p${pIdx+1}`);
  r.classList.remove('pulling','wrong-anim');
  void r.offsetWidth;
  r.classList.add('pulling');
  r.addEventListener('animationend', () => r.classList.remove('pulling'), {once:true});
}
function triggerWrongAnim(pIdx) {
  const r = $(`robo-p${pIdx+1}`);
  r.classList.remove('pulling','wrong-anim');
  void r.offsetWidth;
  r.classList.add('wrong-anim');
  r.addEventListener('animationend', () => r.classList.remove('wrong-anim'), {once:true});
}

// ═══════════════════════════════════════════════════════════
//  TIMER
// ═══════════════════════════════════════════════════════════

function startTimer() {
  timeLeft = TOTAL_SEC;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    $('timer-text').textContent = timeLeft;
    $('timer-bar').style.width  = (timeLeft/TOTAL_SEC*100) + '%';
    if (timeLeft <= 20) {
      $('timer-bar').style.background = 'linear-gradient(90deg,#ff3c5a,#ff0000)';
      $('timer-text').style.color = '#ff3c5a';
    } else if (timeLeft <= 40) {
      $('timer-bar').style.background = 'linear-gradient(90deg,#ffd700,#ff7700)';
    }
    if (timeLeft <= 0 && !gs.gameOver) triggerEndGame('time');
  }, 1000);
}

// ═══════════════════════════════════════════════════════════
//  END GAME
// ═══════════════════════════════════════════════════════════

async function triggerEndGame(reason, winnerPIdx) {
  if (gs.gameOver) return;
  gs.gameOver = true;
  clearInterval(timerInterval);

  document.querySelectorAll('.opt-btn').forEach(b => b.disabled=true);
  gs.players.forEach(p => p.locked=true);

  if (gameMode === 'online') await pushGameOver();

  const p1 = gs.players[0], p2 = gs.players[1];
  let winner=null, winTitle='', winReason='';

  if (reason==='finish') {
    winner    = winnerPIdx;
    winTitle  = `${gs.players[winnerPIdx].name} WINS!`;
    winReason = '🏆 First to answer all questions!';
  } else if (reason==='time') {
    if (p1.score > p2.score)      { winner=0; winTitle=`${p1.name} WINS!`; winReason='⏱ Time\'s up — most correct!'; }
    else if (p2.score > p1.score) { winner=1; winTitle=`${p2.name} WINS!`; winReason='⏱ Time\'s up — most correct!'; }
    else                          { winner=null; winTitle="IT'S A DRAW!";   winReason='⏱ Time\'s up — dead even!'; }
  } else {
    if (p1.score > p2.score)      { winner=0; winTitle=`${p1.name} WINS!`; winReason='🎯 Better accuracy!'; }
    else if (p2.score > p1.score) { winner=1; winTitle=`${p2.name} WINS!`; winReason='🎯 Better accuracy!'; }
    else                          { winner=null; winTitle="IT'S A DRAW!";   winReason='🤝 Equal genius!'; }
  }

  setTimeout(() => {
    $('win-title').textContent  = winTitle;
    $('win-reason').textContent = winReason;
    $('fs-name-p1').textContent  = p1.name;
    $('fs-name-p2').textContent  = p2.name;
    $('fs-score-p1').textContent = `${p1.score}/12`;
    $('fs-score-p2').textContent = `${p2.score}/12`;
    $('final-p1').classList.toggle('winner-card', winner===0);
    $('final-p2').classList.toggle('winner-card', winner===1);
    $('win-bot').textContent = winner===null ? '🤝' : '🏆';
    launchFireworks();
    showScreen('end');
  }, 800);
}

// ── Restart ───────────────────────────────────────────────────
$('btn-restart').onclick = async () => {
  clearInterval(timerInterval);
  // Clean up Firebase room if online
  if (gameMode==='online' && roomRef && onlineRole==='host') {
    try {
      const { remove } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
      await remove(roomRef);
    } catch(_) {}
  }
  roomRef=null; gs=null; gameMode=null; onlineRole=null; myPlayerIdx=null;
  $('timer-bar').style.background=''; $('timer-text').style.color='';
  showScreen('start');
};

// ═══════════════════════════════════════════════════════════
//  KEYBOARD (local mode only)
// ═══════════════════════════════════════════════════════════

document.addEventListener('keydown', e => {
  if (!gs || gs.gameOver || gameMode !== 'local') return;
  const p1k = {'1':0,'2':1,'3':2,'4':3};
  const p2k = {'7':0,'8':1,'9':2,'0':3};
  if (p1k[e.key] !== undefined && !gs.players[0].locked && !gs.players[0].done) handleAnswer(0, p1k[e.key]);
  if (p2k[e.key] !== undefined && !gs.players[1].locked && !gs.players[1].done) handleAnswer(1, p2k[e.key]);
});

// ═══════════════════════════════════════════════════════════
//  FIREWORKS
// ═══════════════════════════════════════════════════════════

function launchFireworks() {
  const c = $('fireworks'); c.innerHTML='';
  const colors=['#ffd700','#ff3c5a','#00d4ff','#00ff88','#ff7700','#ff69b4'];
  for (let b=0; b<7; b++) {
    const bx = Math.random()*window.innerWidth;
    const by = Math.random()*window.innerHeight*.6+50;
    const delay = b*.2;
    for (let i=0; i<20; i++) {
      const spark = document.createElement('div');
      spark.className='spark';
      const ang = (i/20)*Math.PI*2;
      const d   = 80+Math.random()*90;
      spark.style.cssText=`left:${bx}px;top:${by}px;background:${colors[Math.floor(Math.random()*colors.length)]};--tx:${Math.cos(ang)*d}px;--ty:${Math.sin(ang)*d}px;--dur:${.6+Math.random()*.5}s;--delay:${delay+Math.random()*.2}s;border-radius:${Math.random()>.5?'50%':'0'}`;
      c.appendChild(spark);
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════

function shuffleArr(arr) {
  for (let i=arr.length-1; i>0; i--) {
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function genRoomCode() {
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:5}, ()=>chars[Math.floor(Math.random()*chars.length)]).join('');
}

function saveFbConfig(cfg) { localStorage.setItem(FB_STORAGE_KEY, JSON.stringify(cfg)); }
function loadFbConfig()    { try { return JSON.parse(localStorage.getItem(FB_STORAGE_KEY)); } catch(_){return null;} }

// ── Boot ──────────────────────────────────────────────────────
window.addEventListener('load', () => showScreen('start'));
