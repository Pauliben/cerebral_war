// ============================================================
// game.js — Robo Tug of War Quiz Game Logic
// ============================================================

const TOTAL_QUESTIONS = 12;
const TOTAL_TIME = 100; // seconds

// ── State ────────────────────────────────────────────────────
let gameState = null;
let timerInterval = null;
let timeLeft = TOTAL_TIME;

// ── DOM refs ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = {
  start: $('screen-start'),
  game:  $('screen-game'),
  end:   $('screen-end'),
};

// ── Show screen ───────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => {
    s.classList.remove('active', 'fade-in');
    s.style.display = 'none';
  });
  const s = screens[name];
  s.style.display = 'flex';
  requestAnimationFrame(() => {
    s.classList.add('active', 'fade-in');
  });
}

// ── Init game ─────────────────────────────────────────────────
function initGame() {
  const p1name = $('p1-name').value.trim() || 'Red Bot';
  const p2name = $('p2-name').value.trim() || 'Blue Bot';

  // Each player gets independently shuffled questions from the same pool
  const pool = loadQuestions(); // from questions.js
  const p1Qs = shuffleArray([...pool]);
  const p2Qs = shuffleArray([...pool]);

  gameState = {
    players: [
      {
        id: 1, name: p1name,
        questions: p1Qs,
        qIndex: 0,
        score: 0,
        streak: 0,
        done: false,
        locked: false, // locked briefly after answering
      },
      {
        id: 2, name: p2name,
        questions: p2Qs,
        qIndex: 0,
        score: 0,
        streak: 0,
        done: false,
        locked: false,
      }
    ],
    ropePos: 50, // 0=p1 wins, 100=p2 wins
    gameOver: false,
  };

  // Set names
  $('name-p1').textContent = p1name;
  $('name-p2').textContent = p2name;
  $('qtag-p1').textContent = p1name.substring(0, 6);
  $('qtag-p2').textContent = p2name.substring(0, 6);

  // Init pips
  initPips('pips-p1', 1);
  initPips('pips-p2', 2);

  // Init scores
  $('score-p1').textContent = '0';
  $('score-p2').textContent = '0';

  // Init rope
  updateRope(50);

  // Load first questions
  loadQuestion(0);
  loadQuestion(1);

  // Start timer
  timeLeft = TOTAL_TIME;
  updateTimerDisplay();
  timerInterval = setInterval(tickTimer, 1000);

  showScreen('game');
}

function initPips(containerId, playerNum) {
  const container = $(containerId);
  container.innerHTML = '';
  for (let i = 0; i < TOTAL_QUESTIONS; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip';
    pip.id = `pip-p${playerNum}-${i}`;
    container.appendChild(pip);
  }
}

// ── Load question for a player ────────────────────────────────
function loadQuestion(pIdx) {
  const p = gameState.players[pIdx];
  const suffix = pIdx === 0 ? 'p1' : 'p2';
  const q = p.questions[p.qIndex];

  $(`qcount-${suffix}`).textContent = `Q ${p.qIndex + 1}/${TOTAL_QUESTIONS}`;
  $(`qtext-${suffix}`).textContent = q.q;
  $(`qfeedback-${suffix}`).textContent = '';
  $(`qfeedback-${suffix}`).className = 'q-feedback';
  $(`streak-${suffix}`).textContent = p.streak >= 3 ? `🔥×${p.streak}` : '';

  const optsEl = $(`qopts-${suffix}`);
  const btns = optsEl.querySelectorAll('.opt-btn');
  btns.forEach((btn, i) => {
    btn.querySelector('span').textContent = q.options[i];
    btn.className = 'opt-btn';
    btn.disabled = false;
    btn.onclick = () => handleAnswer(pIdx, i);
  });

  $(`q-panel-${suffix}`).classList.remove('done-panel', 'correct-flash', 'wrong-flash');
}

// ── Handle answer ─────────────────────────────────────────────
function handleAnswer(pIdx, chosenIdx) {
  const p = gameState.players[pIdx];
  if (p.done || p.locked || gameState.gameOver) return;

  p.locked = true;
  const q = p.questions[p.qIndex];
  const suffix = pIdx === 0 ? 'p1' : 'p2';
  const isCorrect = chosenIdx === q.answer;

  const optsEl = $(`qopts-${suffix}`);
  const btns = optsEl.querySelectorAll('.opt-btn');

  // Highlight answer
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add('correct-ans');
    if (i === chosenIdx && !isCorrect) btn.classList.add('wrong-ans');
  });

  const pipEl = $(`pip-p${pIdx + 1}-${p.qIndex}`);

  if (isCorrect) {
    p.score++;
    p.streak++;
    pipEl.classList.add('correct');
    $(`score-p${pIdx + 1}`).textContent = p.score;
    $(`qfeedback-${suffix}`).textContent = p.streak >= 3 ? `🔥 On fire! +${p.streak} streak` : '✓ Correct!';
    $(`qfeedback-${suffix}`).className = 'q-feedback correct';
    $(`q-panel-${suffix}`).classList.add('correct-flash');

    // Rope moves toward this player
    const pull = 5 + (p.streak >= 3 ? 2 : 0); // streak bonus
    gameState.ropePos = pIdx === 0
      ? Math.max(0, gameState.ropePos - pull)
      : Math.min(100, gameState.ropePos + pull);
    updateRope(gameState.ropePos);
    triggerPullAnimation(pIdx);
  } else {
    p.streak = 0;
    pipEl.classList.add('wrong');
    $(`qfeedback-${suffix}`).textContent = `✗ Answer: ${q.options[q.answer]}`;
    $(`qfeedback-${suffix}`).className = 'q-feedback wrong';
    $(`q-panel-${suffix}`).classList.add('wrong-flash');
    triggerWrongAnimation(pIdx);
  }

  // Advance to next question after brief delay
  setTimeout(() => {
    p.qIndex++;
    if (p.qIndex >= TOTAL_QUESTIONS) {
      p.done = true;
      const panelSuffix = pIdx === 0 ? 'p1' : 'p2';
      $(`q-panel-${panelSuffix}`).classList.add('done-panel');
      $(`streak-${panelSuffix}`).textContent = '';

      // If this player finished first — check win
      if (!gameState.gameOver) {
        const other = gameState.players[1 - pIdx];
        if (other.done) {
          // Both done — compare scores
          endGame('scores');
        } else {
          endGame('finish', pIdx);
        }
      }
    } else {
      p.locked = false;
      loadQuestion(pIdx);
    }
  }, 900);
}

// ── Rope visual ───────────────────────────────────────────────
function updateRope(pos) {
  document.documentElement.style.setProperty('--rope-pos', pos);
  const marker = $('rope-marker');
  const flag = $('rope-flag');
  marker.style.left = `calc(${pos}% - 2px)`;
  flag.style.left = `${pos}%`;

  // Color shift based on position
  const rope = document.querySelector('.rope');
  if (pos < 30) {
    rope.style.boxShadow = `0 3px 15px rgba(255,60,90,.5), inset 0 1px 2px rgba(255,255,255,.15)`;
  } else if (pos > 70) {
    rope.style.boxShadow = `0 3px 15px rgba(0,212,255,.5), inset 0 1px 2px rgba(255,255,255,.15)`;
  } else {
    rope.style.boxShadow = `0 3px 8px rgba(0,0,0,.6), inset 0 1px 2px rgba(255,255,255,.15)`;
  }
}

// ── Robot animations ──────────────────────────────────────────
function triggerPullAnimation(pIdx) {
  const robo = $(`robo-p${pIdx + 1}`);
  robo.classList.remove('pulling', 'wrong-anim');
  void robo.offsetWidth;
  robo.classList.add('pulling');
  robo.addEventListener('animationend', () => robo.classList.remove('pulling'), { once: true });
}

function triggerWrongAnimation(pIdx) {
  const robo = $(`robo-p${pIdx + 1}`);
  robo.classList.remove('pulling', 'wrong-anim');
  void robo.offsetWidth;
  robo.classList.add('wrong-anim');
  robo.addEventListener('animationend', () => robo.classList.remove('wrong-anim'), { once: true });
}

// ── Timer ─────────────────────────────────────────────────────
function tickTimer() {
  timeLeft--;
  updateTimerDisplay();
  if (timeLeft <= 0 && !gameState.gameOver) {
    endGame('time');
  }
}

function updateTimerDisplay() {
  $('timer-text').textContent = timeLeft;
  const pct = (timeLeft / TOTAL_TIME) * 100;
  $('timer-bar').style.width = pct + '%';

  // Color warning
  if (timeLeft <= 20) {
    $('timer-bar').style.background = 'linear-gradient(90deg, #ff3c5a, #ff0000)';
    $('timer-text').style.color = '#ff3c5a';
  } else if (timeLeft <= 40) {
    $('timer-bar').style.background = 'linear-gradient(90deg, #ffd700, #ff7700)';
    $('timer-text').style.color = '#ffd700';
  }
}

// ── End game ──────────────────────────────────────────────────
function endGame(reason, winnerPIdx) {
  if (gameState.gameOver) return;
  gameState.gameOver = true;
  clearInterval(timerInterval);

  // Disable all buttons
  document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);
  gameState.players.forEach(p => { p.locked = true; });

  const p1 = gameState.players[0];
  const p2 = gameState.players[1];

  let winner = null;
  let winnerText = '';
  let reasonText = '';

  if (reason === 'finish') {
    winner = winnerPIdx;
    winnerText = `${gameState.players[winnerPIdx].name} WINS!`;
    reasonText = '🏆 First to finish all questions!';
  } else if (reason === 'time') {
    if (p1.score > p2.score) {
      winner = 0;
      winnerText = `${p1.name} WINS!`;
      reasonText = `⏱ Time's up! Higher score wins!`;
    } else if (p2.score > p1.score) {
      winner = 1;
      winnerText = `${p2.name} WINS!`;
      reasonText = `⏱ Time's up! Higher score wins!`;
    } else {
      winner = null;
      winnerText = "IT'S A DRAW!";
      reasonText = `⏱ Time's up! Same score — what a battle!`;
    }
  } else {
    // Both finished, compare scores
    if (p1.score > p2.score) {
      winner = 0;
      winnerText = `${p1.name} WINS!`;
      reasonText = `🎯 Better accuracy!`;
    } else if (p2.score > p1.score) {
      winner = 1;
      winnerText = `${p2.name} WINS!`;
      reasonText = `🎯 Better accuracy!`;
    } else {
      winner = null;
      winnerText = "IT'S A DRAW!";
      reasonText = `🤝 Perfect tie! Both incredible!`;
    }
  }

  // Show end screen after brief delay
  setTimeout(() => {
    $('win-title').textContent = winnerText;
    $('win-reason').textContent = reasonText;

    $('fs-name-p1').textContent = p1.name;
    $('fs-name-p2').textContent = p2.name;
    $('fs-score-p1').textContent = `${p1.score}/12`;
    $('fs-score-p2').textContent = `${p2.score}/12`;

    $('final-p1').classList.remove('winner-card');
    $('final-p2').classList.remove('winner-card');
    if (winner === 0) $('final-p1').classList.add('winner-card');
    if (winner === 1) $('final-p2').classList.add('winner-card');

    $('win-bot').textContent = winner === null ? '🤝' : '🏆';

    launchFireworks();
    showScreen('end');
  }, 800);
}

// ── Fireworks ─────────────────────────────────────────────────
function launchFireworks() {
  const container = $('fireworks');
  container.innerHTML = '';
  const colors = ['#ffd700', '#ff3c5a', '#00d4ff', '#00ff88', '#ff7700', '#ff69b4'];
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  for (let b = 0; b < 6; b++) {
    const bx = Math.random() * window.innerWidth;
    const by = Math.random() * window.innerHeight * 0.6 + 50;
    const delay = b * 0.25;
    for (let i = 0; i < 18; i++) {
      const spark = document.createElement('div');
      spark.className = 'spark';
      const angle = (i / 18) * Math.PI * 2;
      const dist = 80 + Math.random() * 80;
      spark.style.cssText = `
        left: ${bx}px; top: ${by}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        --tx: ${Math.cos(angle) * dist}px;
        --ty: ${Math.sin(angle) * dist}px;
        --dur: ${0.6 + Math.random() * 0.5}s;
        --delay: ${delay + Math.random() * 0.2}s;
      `;
      container.appendChild(spark);
    }
  }
}

// ── Keyboard controls ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!gameState || gameState.gameOver) return;

  // P1: keys 1,2,3,4
  const p1Map = { '1': 0, '2': 1, '3': 2, '4': 3 };
  // P2: keys 7,8,9,0
  const p2Map = { '7': 0, '8': 1, '9': 2, '0': 3 };

  if (p1Map[e.key] !== undefined && !gameState.players[0].locked && !gameState.players[0].done) {
    handleAnswer(0, p1Map[e.key]);
  }
  if (p2Map[e.key] !== undefined && !gameState.players[1].locked && !gameState.players[1].done) {
    handleAnswer(1, p2Map[e.key]);
  }
});

// ── Shuffle ───────────────────────────────────────────────────
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Button bindings ───────────────────────────────────────────
$('btn-start').addEventListener('click', initGame);
$('p1-name').addEventListener('keydown', e => { if (e.key === 'Enter') initGame(); });
$('p2-name').addEventListener('keydown', e => { if (e.key === 'Enter') initGame(); });

$('btn-restart').addEventListener('click', () => {
  clearInterval(timerInterval);
  gameState = null;
  // Reset timer bar colors
  $('timer-bar').style.background = '';
  $('timer-text').style.color = '';
  showScreen('start');
});

// ── Start on load ─────────────────────────────────────────────
window.addEventListener('load', () => {
  showScreen('start');
});
