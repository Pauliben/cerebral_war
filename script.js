let timer = 100;
let gameActive = true;
const maxQuestions = 12;

let p1 = { score: 0, currentAnswer: 0, questions: [] };
let p2 = { score: 0, currentAnswer: 0, questions: [] };

// Generate random math questions
function generateQuestion() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let ans;
    if (op === '+') ans = a + b;
    if (op === '-') ans = a - b;
    if (op === '*') ans = a * b;
    return { text: `${a} ${op} ${b} = ?`, ans: ans };
}

function setupGame() {
    for(let i=0; i<maxQuestions; i++) {
        p1.questions.push(generateQuestion());
        p2.questions.push(generateQuestion());
    }
    updateUI('p1');
    updateUI('p2');
    startTimer();
}

function updateUI(player) {
    const data = player === 'p1' ? p1 : p2;
    if (data.score < maxQuestions) {
        document.getElementById(`${player}-q`).innerText = data.questions[data.score].text;
        document.getElementById(`${player}-score`).innerText = data.score;
    } else {
        checkWinner();
    }
}

function startTimer() {
    const interval = setInterval(() => {
        if (!gameActive) return clearInterval(interval);
        timer--;
        document.getElementById('time').innerText = timer;
        if (timer <= 0) {
            gameActive = false;
            checkWinner();
        }
    }, 1000);
}

function moveRope() {
    const diff = p1.score - p2.score;
    const movePercent = 50 + (diff * 4); // Shifts the knot 4% per point diff
    document.getElementById('knot').style.left = movePercent + "%";
}

function checkWinner() {
    gameActive = false;
    let msg = "";
    if (p1.score > p2.score) msg = "Player 1 Wins!";
    else if (p2.score > p1.score) msg = "Player 2 Wins!";
    else msg = "It's a Tie!";
    
    document.getElementById('winner-text').innerText = msg;
    document.getElementById('overlay').classList.remove('hidden');
}

// Input Listeners
document.getElementById('p1-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        if (parseInt(e.target.value) === p1.questions[p1.score].ans) {
            p1.score++;
            e.target.value = '';
            moveRope();
            updateUI('p1');
        }
    }
});

document.getElementById('p2-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        if (parseInt(e.target.value) === p2.questions[p2.score].ans) {
            p2.score++;
            e.target.value = '';
            moveRope();
            updateUI('p2');
        }
    }
});

setupGame();