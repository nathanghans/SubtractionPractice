'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const DIFFICULTY = {
  easy:   { max: 10,  label: 'Easy' },
  medium: { max: 50,  label: 'Medium' },
  hard:   { max: 100, label: 'Hard' },
};

const TOTAL_QUESTIONS = 10;

const CORRECT_MESSAGES = [
  "Amazing! 🌟", "You got it! 🎉", "Brilliant! 💫", "Superstar! ⭐",
  "Fantastic! 🌸", "Nailed it! 🎀", "Wonderful! 🦋", "Yes! Keep it up! 🌺",
  "You're on fire! 🔥", "Perfect! 💖",
];

const WRONG_MESSAGES = [
  "So close! Try again 💪", "Almost there! 🌈", "Don't give up! ✨",
  "Give it another shot! 🌸", "You've got this! 💪",
];

// ── State ────────────────────────────────────────────────────────────────────
let currentDifficulty = 'easy';
let questions         = [];
let currentIndex      = 0;
let score             = 0;
let streak            = 0;
let answered          = false;

// ── Helpers ──────────────────────────────────────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateQuestions(difficulty) {
  const { max } = DIFFICULTY[difficulty];
  const qs = [];
  while (qs.length < TOTAL_QUESTIONS) {
    const a = randInt(1, max);
    const b = randInt(0, a);           // guarantees non-negative answer
    qs.push({ a, b, answer: a - b });
  }
  return qs;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Game Flow ─────────────────────────────────────────────────────────────────
function startGame(difficulty) {
  currentDifficulty = difficulty;
  questions         = generateQuestions(difficulty);
  currentIndex      = 0;
  score             = 0;
  streak            = 0;
  answered          = false;

  showScreen('screen-game');
  renderQuestion();
}

function renderQuestion() {
  answered = false;
  const q = questions[currentIndex];

  document.getElementById('num-a').textContent    = q.a;
  document.getElementById('num-b').textContent    = q.b;
  document.getElementById('q-num').textContent    = currentIndex + 1;
  document.getElementById('score-display').textContent = `⭐ ${score}`;
  document.getElementById('progress-bar').style.width  = `${(currentIndex / TOTAL_QUESTIONS) * 100}%`;

  const streakEl = document.getElementById('streak-display');
  if (streak >= 2) {
    streakEl.textContent = `🔥 ${streak}`;
    streakEl.classList.remove('hidden');
  } else {
    streakEl.classList.add('hidden');
  }

  const input = document.getElementById('answer-input');
  input.value       = '';
  input.disabled    = false;
  input.style.border = '3px solid #e1bee7';

  const feedback = document.getElementById('feedback');
  feedback.className = 'feedback hidden';
  feedback.textContent = '';

  const btn = document.getElementById('submit-btn');
  btn.textContent = 'Check ✓';
  btn.style.opacity = '1';

  setTimeout(() => input.focus(), 50);
}

function handleKey(e) {
  if (e.key === 'Enter') {
    if (answered) {
      nextQuestion();
    } else {
      checkAnswer();
    }
  }
}

function checkAnswer() {
  if (answered) return;

  const input = document.getElementById('answer-input');
  const raw   = input.value.trim();

  if (raw === '') {
    triggerShake(input);
    return;
  }

  const userAnswer = parseInt(raw, 10);
  const correct    = questions[currentIndex].answer;
  const feedback   = document.getElementById('feedback');
  const btn        = document.getElementById('submit-btn');

  answered    = true;
  input.disabled = true;

  if (userAnswer === correct) {
    score++;
    streak++;
    input.style.border = '3px solid #a5d6a7';
    feedback.textContent = pick(CORRECT_MESSAGES);
    feedback.className   = 'feedback correct';
  } else {
    streak = 0;
    input.style.border = '3px solid #f48fb1';
    feedback.textContent = `${pick(WRONG_MESSAGES)} The answer is ${correct}.`;
    feedback.className   = 'feedback wrong';
    triggerShake(input);
  }

  btn.textContent  = currentIndex < TOTAL_QUESTIONS - 1 ? 'Next →' : 'See Results 🎉';
  btn.onclick      = nextQuestion;
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex >= TOTAL_QUESTIONS) {
    showResults();
  } else {
    document.getElementById('submit-btn').onclick = checkAnswer;
    renderQuestion();
  }
}

function showResults() {
  document.getElementById('progress-bar').style.width = '100%';
  showScreen('screen-results');

  const pct = score / TOTAL_QUESTIONS;
  let emoji, title, msg;

  if (pct === 1) {
    emoji = '🏆'; title = 'Perfect Score!';
    msg = 'You got every single one right. You\'re a subtraction superstar!';
  } else if (pct >= 0.8) {
    emoji = '🌟'; title = 'Amazing Job!';
    msg = 'You\'re so close to perfect — keep practising!';
  } else if (pct >= 0.6) {
    emoji = '🌸'; title = 'Great Work!';
    msg = 'You\'re getting stronger every round. Keep it up!';
  } else if (pct >= 0.4) {
    emoji = '💪'; title = 'Good Effort!';
    msg = 'Practice makes perfect — try again and you\'ll do even better!';
  } else {
    emoji = '🌈'; title = 'Keep Practising!';
    msg = 'Every mistake is a step forward. Give it another go!';
  }

  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-msg').textContent   = msg;
  document.getElementById('final-score').textContent  = score;
}

function playAgain() {
  startGame(currentDifficulty);
}

function goHome() {
  showScreen('screen-welcome');
}

// ── Utility ──────────────────────────────────────────────────────────────────
function triggerShake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;    // reflow to restart animation
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}
