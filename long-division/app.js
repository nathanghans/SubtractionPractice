'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const DIFFICULTY = {
  easy:   { label: 'Easy',   divisor: [2, 9],   digits: [2, 2] },
  medium: { label: 'Medium', divisor: [2, 9],   digits: [3, 3] },
  hard:   { label: 'Hard',   divisor: [4, 12],  digits: [3, 4] },
  expert: { label: 'Expert', divisor: [11, 25], digits: [4, 5] },
};

const QUESTIONS_PER_MODE = { missing: 8, guided: 5, practice: 10 };

const MODE_TITLES = {
  missing: 'Find the Missing Number',
  guided: 'Step-by-Step Guide',
  practice: 'Practice Long Division',
};

const CORRECT_MESSAGES = [
  'Amazing! 🌟', 'You got it! 🎉', 'Brilliant! 💫', 'Superstar! ⭐',
  'Nailed it! 🎀', 'Yes! Keep it up! 🌺', "You're on fire! 🔥", 'Perfect! 💖',
];
const WRONG_MESSAGES = [
  'So close! Try again 💪', 'Almost there! 🌈', "Don't give up! ✨", "You've got this! 💪",
];

// ── State ───────────────────────────────────────────────────────────────────
let currentMode       = 'practice';
let currentDifficulty = 'easy';
let totalQuestions    = 10;
let currentIndex      = 0;
let score             = 0;
let streak            = 0;

// guided-mode step state
let guided = null; // { trace, stepIndex, phase, attemptedWrong }

// ── Helpers ─────────────────────────────────────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Division engine ─────────────────────────────────────────────────────────
// Computes the full digit-by-digit long division trace for dividend ÷ divisor.
function divisionTrace(dividend, divisor) {
  const digits = String(dividend).split('').map(Number);
  const n = digits.length;
  const quotientDigits = new Array(n).fill(null);
  const steps = [];
  let current = 0;
  let started = false;

  for (let i = 0; i < n; i++) {
    current = current * 10 + digits[i];
    if (!started && current < divisor) continue;
    started = true;
    const qd = Math.floor(current / divisor);
    const product = qd * divisor;
    const remainder = current - product;
    quotientDigits[i] = qd;
    steps.push({ column: i, current, quotientDigit: qd, product, remainder });
    current = remainder;
  }

  if (!started) {
    steps.push({ column: n - 1, current: dividend, quotientDigit: 0, product: 0, remainder: dividend });
    quotientDigits[n - 1] = 0;
  }

  const finalRemainder = steps[steps.length - 1].remainder;
  const quotient = parseInt(quotientDigits.map(d => (d === null ? '' : d)).join('') || '0', 10);

  return { dividend, divisor, digits, n, quotientDigits, steps, quotient, remainder: finalRemainder };
}

function generateProblem(difficultyKey) {
  const cfg = DIFFICULTY[difficultyKey];
  const divisor = randInt(cfg.divisor[0], cfg.divisor[1]);
  const digitCount = randInt(cfg.digits[0], cfg.digits[1]);
  const min = Math.pow(10, digitCount - 1);
  const max = Math.pow(10, digitCount) - 1;
  const dividend = randInt(min, max);
  return divisionTrace(dividend, divisor);
}

// The result-row value for step k: what appears after subtracting and
// bringing the next digit down. For the last step it's just the remainder.
function resultRowValue(trace, k) {
  const s = trace.steps[k];
  const isLast = k === trace.steps.length - 1;
  return {
    value: isLast ? s.remainder : trace.steps[k + 1].current,
    endCol: isLast ? s.column : trace.steps[k + 1].column,
  };
}

// ── Tableau rendering ───────────────────────────────────────────────────────
// Draws the long-division bracket layout into `container`.
// opts.revealed: Set of cell keys to show (omit/null = show everything)
// opts.inputSlot: { key } — render this one cell as a text <input> instead of a value
// opts.highlight: Set of cell keys to visually emphasize
// opts.overrides: { key: { value } } — force a cell's displayed value (used for the
//                 pre-bring-down remainder, before it merges with the next digit)
function buildTableau(container, trace, opts) {
  opts = opts || {};
  const revealed = opts.revealed || null;
  const inputSlot = opts.inputSlot || null;
  const highlight = opts.highlight || new Set();
  const overrides = opts.overrides || {};

  const isRevealed = key => revealed === null || revealed.has(key);

  container.innerHTML = '';
  const totalRows = 2 + 2 * trace.steps.length;
  container.style.gridTemplateRows = `repeat(${totalRows}, auto)`;
  container.style.gridTemplateColumns = `auto var(--col-w) repeat(${trace.n}, var(--col-w))`;

  function makeCell(row, colStart, span, text, extraClass, key) {
    const div = document.createElement('div');
    div.className = 'cell' + (extraClass ? ' ' + extraClass : '');
    div.style.gridRow = `${row} / span 1`;
    div.style.gridColumn = `${colStart} / span ${span}`;
    if (key && highlight.has(key)) div.classList.add('highlight');

    if (key && inputSlot && inputSlot.key === key) {
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.className = 'tableau-input';
      input.id = 'blank-input';
      input.autocomplete = 'off';
      input.addEventListener('keydown', handleKey);
      div.appendChild(input);
    } else {
      div.textContent = text;
    }
    container.appendChild(div);
    return div;
  }

  // Vertical bracket spine, drawn behind everything, rows 2..totalRows at column 2
  for (let r = 2; r <= totalRows; r++) {
    makeCell(r, 2, 1, '', 'spine', null);
  }

  // Divisor
  makeCell(2, 1, 1, trace.divisor, 'divisor-cell', 'divisor');

  // Dividend digits (row 2), with the overline that forms the bracket top
  trace.digits.forEach((d, i) => {
    makeCell(2, 3 + i, 1, d, 'divline', `dvd-${i}`);
  });

  // Quotient row
  trace.quotientDigits.forEach((qd, i) => {
    const key = `qd-${i}`;
    if (qd === null || !isRevealed(key)) return;
    makeCell(1, 3 + i, 1, qd, 'quotient-cell', key);
  });

  // Work rows: product (multiply) and result (subtract + bring down)
  trace.steps.forEach((s, k) => {
    const prodKey = `prod-${k}`;
    const resKey = `res-${k}`;
    const prodRow = 3 + 2 * k;
    const resRow = 4 + 2 * k;

    if (isRevealed(prodKey)) {
      const text = String(s.product);
      const startCol = s.column - text.length + 1;
      makeCell(prodRow, 3 + startCol, text.length, s.product, 'product-cell', prodKey);
      const minusCol = startCol > 0 ? 3 + startCol - 1 : 2;
      makeCell(prodRow, minusCol, 1, '−', 'minus-cell', null);
    }

    if (isRevealed(resKey)) {
      let value, endCol;
      if (overrides[resKey]) {
        value = overrides[resKey].value;
        endCol = s.column;
      } else {
        const r = resultRowValue(trace, k);
        value = r.value;
        endCol = r.endCol;
      }
      const text = String(value);
      const startCol = endCol - text.length + 1;
      makeCell(resRow, 3 + startCol, text.length, value, 'result-cell', resKey);
    }
  });
}

// ── Game flow (shared) ───────────────────────────────────────────────────────
function selectMode(mode) {
  currentMode = mode;
  document.getElementById('difficulty-title').textContent = MODE_TITLES[mode];
  showScreen('screen-difficulty');
}

function startGame(difficulty) {
  currentDifficulty = difficulty;
  totalQuestions = QUESTIONS_PER_MODE[currentMode];
  currentIndex = 0;
  score = 0;
  streak = 0;

  document.getElementById('q-total').textContent = totalQuestions;
  showScreen('screen-game');
  nextProblem();
}

function updateHeader() {
  document.getElementById('q-num').textContent = currentIndex + 1;
  document.getElementById('score-display').textContent = `⭐ ${score}`;
  document.getElementById('progress-bar').style.width = `${(currentIndex / totalQuestions) * 100}%`;

  const streakEl = document.getElementById('streak-display');
  if (streak >= 2) {
    streakEl.textContent = `🔥 ${streak}`;
    streakEl.classList.remove('hidden');
  } else {
    streakEl.classList.add('hidden');
  }
}

function clearFeedback() {
  const feedback = document.getElementById('feedback');
  feedback.className = 'feedback hidden';
  feedback.textContent = '';
}

function focusAnswerInput() {
  const input = document.getElementById('blank-input') || document.getElementById('answer-input');
  if (input) setTimeout(() => input.focus(), 50);
}

function handleKey(e) {
  if (e.key === 'Enter') {
    document.getElementById('submit-btn').click();
  }
}

function nextProblem() {
  if (currentIndex >= totalQuestions) {
    showResults();
    return;
  }
  updateHeader();
  clearFeedback();

  if (currentMode === 'missing') startMissingNumberProblem();
  else if (currentMode === 'guided') startGuidedProblem();
  else startPracticeProblem();
}

function triggerShake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

function showFeedback(correct, extraText) {
  const feedback = document.getElementById('feedback');
  if (correct) {
    feedback.textContent = extraText || pick(CORRECT_MESSAGES);
    feedback.className = 'feedback correct';
  } else {
    feedback.textContent = extraText || pick(WRONG_MESSAGES);
    feedback.className = 'feedback wrong';
  }
}

function showResults() {
  document.getElementById('progress-bar').style.width = '100%';
  showScreen('screen-results');

  const pct = score / totalQuestions;
  let emoji, title, msg;
  if (pct === 1) {
    emoji = '🏆'; title = 'Perfect Score!';
    msg = "You got every single one right. You're a division master!";
  } else if (pct >= 0.8) {
    emoji = '🌟'; title = 'Amazing Job!';
    msg = "You're so close to perfect — keep practising!";
  } else if (pct >= 0.6) {
    emoji = '🌸'; title = 'Great Work!';
    msg = "You're getting stronger every round. Keep it up!";
  } else if (pct >= 0.4) {
    emoji = '💪'; title = 'Good Effort!';
    msg = 'Practice makes perfect — try again and you will do even better!';
  } else {
    emoji = '🌈'; title = 'Keep Practising!';
    msg = 'Every mistake is a step forward. Give it another go!';
  }

  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-msg').textContent = msg;
  document.getElementById('final-score').textContent = score;
  document.getElementById('final-out-of').textContent = ` / ${totalQuestions}`;
}

function playAgain() { startGame(currentDifficulty); }
function goHome() { showScreen('screen-welcome'); }

// ── Mode 1: Find the Missing Number ─────────────────────────────────────────
let missingState = null; // { trace, blankKey, correctValue }

function startMissingNumberProblem() {
  const trace = generateProblem(currentDifficulty);

  const candidates = ['divisor'];
  trace.steps.forEach((s, k) => {
    candidates.push(`qd-${s.column}`);
    candidates.push(`prod-${k}`);
    candidates.push(`res-${k}`);
  });
  const blankKey = pick(candidates);

  let correctValue;
  if (blankKey === 'divisor') correctValue = trace.divisor;
  else if (blankKey.startsWith('qd-')) correctValue = trace.quotientDigits[parseInt(blankKey.slice(3), 10)];
  else if (blankKey.startsWith('prod-')) correctValue = trace.steps[parseInt(blankKey.slice(5), 10)].product;
  else correctValue = resultRowValue(trace, parseInt(blankKey.slice(4), 10)).value;

  missingState = { trace, blankKey, correctValue };

  const tableau = document.getElementById('tableau');
  buildTableau(tableau, trace, { inputSlot: { key: blankKey } });

  document.getElementById('prompt-text').textContent =
    'One number is missing from this solved problem. Figure out what it is!';

  const promptBox = document.getElementById('prompt-box');
  promptBox.querySelector('.answer-row').innerHTML = '';
  promptBox.querySelector('.answer-row').style.display = 'none';

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.textContent = 'Check ✓';
  submitBtn.onclick = checkMissingNumberAnswer;

  focusAnswerInput();
}

function checkMissingNumberAnswer() {
  const input = document.getElementById('blank-input');
  if (!input) return;
  const raw = input.value.trim();
  if (raw === '') { triggerShake(input); return; }

  const userAnswer = parseInt(raw, 10);
  const correct = missingState.correctValue;
  input.disabled = true;

  if (userAnswer === correct) {
    score++; streak++;
    input.classList.add('cell-correct');
    showFeedback(true);
  } else {
    streak = 0;
    input.classList.add('cell-wrong');
    showFeedback(false, `${pick(WRONG_MESSAGES)} The missing number was ${correct}.`);
    triggerShake(input);
  }

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.textContent = currentIndex < totalQuestions - 1 ? 'Next →' : 'See Results 🎉';
  submitBtn.onclick = () => { currentIndex++; nextProblem(); };
}

// ── Mode 2: Step-by-Step Guide ──────────────────────────────────────────────
function startGuidedProblem() {
  guided = { trace: generateProblem(currentDifficulty), stepIndex: 0, phase: 'divide', wrongOnce: false };
  renderGuidedPhase();
}

function guidedRevealSet(trace, upToStep, phase) {
  const revealed = new Set(['divisor']);
  trace.digits.forEach((_, i) => revealed.add(`dvd-${i}`));

  for (let j = 0; j < upToStep; j++) {
    revealed.add(`qd-${trace.steps[j].column}`);
    revealed.add(`prod-${j}`);
    revealed.add(`res-${j}`);
  }

  const s = trace.steps[upToStep];
  if (!s) return revealed;
  const col = s.column;
  if (phase === 'multiply' || phase === 'subtract' || phase === 'bringdown') revealed.add(`qd-${col}`);
  if (phase === 'subtract' || phase === 'bringdown') revealed.add(`prod-${upToStep}`);
  if (phase === 'bringdown') revealed.add(`res-${upToStep}`);
  return revealed;
}

function guidedCurrentHighlightKeys(trace, stepIndex) {
  // The set of cells that make up the "current" number being divided at this step.
  const keys = new Set();
  if (stepIndex === 0) {
    const col = trace.steps[0].column;
    for (let i = 0; i <= col; i++) keys.add(`dvd-${i}`);
  } else {
    keys.add(`res-${stepIndex - 1}`);
  }
  return keys;
}

function renderGuidedPhase() {
  const { trace, stepIndex, phase } = guided;
  const s = trace.steps[stepIndex];
  const isLast = stepIndex === trace.steps.length - 1;

  const revealed = guidedRevealSet(trace, stepIndex, phase);
  const highlight = new Set();
  const overrides = {};
  let inputSlot = null;
  let promptText = '';

  if (phase === 'divide') {
    guidedCurrentHighlightKeys(trace, stepIndex).forEach(k => highlight.add(k));
    highlight.add('divisor');
    inputSlot = { key: `qd-${s.column}` };
    promptText = `Divide: how many times does ${trace.divisor} go into ${s.current}?`;
  } else if (phase === 'multiply') {
    highlight.add(`qd-${s.column}`);
    highlight.add('divisor');
    inputSlot = { key: `prod-${stepIndex}` };
    promptText = `Multiply: ${s.quotientDigit} × ${trace.divisor} = ?`;
  } else if (phase === 'subtract') {
    guidedCurrentHighlightKeys(trace, stepIndex).forEach(k => highlight.add(k));
    highlight.add(`prod-${stepIndex}`);
    inputSlot = { key: `res-${stepIndex}` };
    overrides[`res-${stepIndex}`] = { value: s.remainder }; // placeholder while unanswered
    promptText = `Subtract: ${s.current} − ${s.product} = ?`;
  } else if (phase === 'bringdown') {
    highlight.add(`res-${stepIndex}`);
    highlight.add(`dvd-${s.column + 1}`);
    inputSlot = { key: `res-${stepIndex}` };
    const nextDigit = trace.digits[s.column + 1];
    promptText = `Bring down the next digit (${nextDigit}). What number do you get?`;
  }

  if (inputSlot) revealed.add(inputSlot.key);

  const tableau = document.getElementById('tableau');
  buildTableau(tableau, trace, { revealed, inputSlot, highlight, overrides });

  document.getElementById('prompt-text').textContent = promptText;
  const promptBox = document.getElementById('prompt-box');
  promptBox.querySelector('.answer-row').style.display = 'none';

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.textContent = phase === 'bringdown' ? 'Bring Down ⬇' : 'Check ✓';
  submitBtn.onclick = checkGuidedAnswer;

  clearFeedback();
  focusAnswerInput();

  guided.isLastStep = isLast;
}

function guidedExpectedValue() {
  const { trace, stepIndex, phase } = guided;
  const s = trace.steps[stepIndex];
  if (phase === 'divide') return s.quotientDigit;
  if (phase === 'multiply') return s.product;
  if (phase === 'subtract') return s.remainder;
  if (phase === 'bringdown') return resultRowValue(trace, stepIndex).value;
}

function checkGuidedAnswer() {
  const input = document.getElementById('blank-input');
  if (!input) return;
  const raw = input.value.trim();
  if (raw === '') { triggerShake(input); return; }

  const userAnswer = parseInt(raw, 10);
  const correct = guidedExpectedValue();

  if (userAnswer === correct) {
    input.disabled = true;
    input.classList.add('cell-correct');
    if (!guided.wrongOnce) { score++; streak++; }
    showFeedback(true);

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.textContent = 'Continue →';
    submitBtn.onclick = advanceGuidedPhase;
  } else {
    streak = 0;
    guided.wrongOnce = true;
    input.classList.add('cell-wrong');
    triggerShake(input);
    showFeedback(false, pick(WRONG_MESSAGES));
  }
}

function advanceGuidedPhase() {
  const order = ['divide', 'multiply', 'subtract', 'bringdown'];
  const { trace, stepIndex, isLastStep } = guided;

  if (guided.phase === 'subtract' && isLastStep) {
    // No bring-down after the final digit — problem is complete.
    finishGuidedProblem();
    return;
  }

  const idx = order.indexOf(guided.phase);
  let nextPhase = order[idx + 1];

  if (nextPhase === 'bringdown' && isLastStep) {
    finishGuidedProblem();
    return;
  }

  if (nextPhase === undefined) {
    // finished bring-down, move to next step's divide phase
    guided.stepIndex++;
    guided.phase = 'divide';
    guided.wrongOnce = false;
  } else {
    guided.phase = nextPhase;
    guided.wrongOnce = false;
  }
  renderGuidedPhase();
}

function finishGuidedProblem() {
  const { trace } = guided;
  const tableau = document.getElementById('tableau');
  buildTableau(tableau, trace, {}); // reveal everything, fully solved

  document.getElementById('prompt-text').textContent =
    `Solved! ${trace.dividend} ÷ ${trace.divisor} = ${trace.quotient}` +
    (trace.remainder ? ` remainder ${trace.remainder}.` : ' exactly.');
  document.getElementById('prompt-box').querySelector('.answer-row').style.display = 'none';
  showFeedback(true, 'Great work walking through every step! 🎉');

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.textContent = currentIndex < totalQuestions - 1 ? 'Next Problem →' : 'See Results 🎉';
  submitBtn.onclick = () => { currentIndex++; nextProblem(); };
}

// ── Mode 3: Practice ─────────────────────────────────────────────────────────
let practiceState = null; // { trace }

function startPracticeProblem() {
  const trace = generateProblem(currentDifficulty);
  practiceState = { trace };

  const tableau = document.getElementById('tableau');
  buildTableau(tableau, trace, { revealed: new Set([
    'divisor', ...trace.digits.map((_, i) => `dvd-${i}`),
  ]) });

  document.getElementById('prompt-text').textContent = 'Work it out, then enter the quotient and remainder.';

  const answerRow = document.getElementById('prompt-box').querySelector('.answer-row');
  answerRow.style.display = 'flex';
  answerRow.innerHTML = `
    <div class="practice-inputs">
      <label class="practice-label">Quotient
        <input id="practice-quotient" type="text" inputmode="numeric" autocomplete="off" />
      </label>
      <label class="practice-label">Remainder
        <input id="practice-remainder" type="text" inputmode="numeric" autocomplete="off" value="0" />
      </label>
    </div>
  `;

  const qInput = document.getElementById('practice-quotient');
  const rInput = document.getElementById('practice-remainder');
  [qInput, rInput].forEach(el => el.addEventListener('keydown', handleKey));

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.textContent = 'Check ✓';
  submitBtn.onclick = checkPracticeAnswer;

  setTimeout(() => qInput.focus(), 50);
}

function checkPracticeAnswer() {
  const qInput = document.getElementById('practice-quotient');
  const rInput = document.getElementById('practice-remainder');
  const qRaw = qInput.value.trim();
  const rRaw = rInput.value.trim();
  if (qRaw === '' || rRaw === '') { triggerShake(qRaw === '' ? qInput : rInput); return; }

  const userQ = parseInt(qRaw, 10);
  const userR = parseInt(rRaw, 10);
  const { trace } = practiceState;

  qInput.disabled = true;
  rInput.disabled = true;

  const correct = userQ === trace.quotient && userR === trace.remainder;
  if (correct) {
    score++; streak++;
    qInput.classList.add('cell-correct');
    rInput.classList.add('cell-correct');
    showFeedback(true);
  } else {
    streak = 0;
    qInput.classList.add('cell-wrong');
    rInput.classList.add('cell-wrong');
    showFeedback(false, `${pick(WRONG_MESSAGES)} The answer is ${trace.quotient} remainder ${trace.remainder}.`);
    triggerShake(qInput);

    // Reveal the fully worked tableau so they can see where it went differently.
    const tableau = document.getElementById('tableau');
    buildTableau(tableau, trace, {});
  }

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.textContent = currentIndex < totalQuestions - 1 ? 'Next →' : 'See Results 🎉';
  submitBtn.onclick = () => { currentIndex++; nextProblem(); };
}
