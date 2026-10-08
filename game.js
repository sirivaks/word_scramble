const MIN_LEN = 3;
const SCORE_FOR = { 3: 10, 4: 20, 5: 40, 6: 70, 7: 110 };

const state = {
  letters: [],
  solutions: [],
  found: new Set(),
  used: new Set(),
  current: [],
  score: 0,
  round: 1,
};

function counts(str) {
  const map = {};
  for (const ch of str) map[ch] = (map[ch] || 0) + 1;
  return map;
}

function canSpell(word, bag) {
  const need = counts(word);
  return Object.entries(need).every(([ch, n]) => (bag[ch] || 0) >= n);
}

function solutionsFor(letters) {
  const bag = counts(letters.join(""));
  return WORDS.filter((w) => w.length >= MIN_LEN && w.length <= letters.length && canSpell(w, bag))
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
}

function pickPuzzle(size) {
  const seeds = WORDS.filter((w) => w.length === size && new Set(w).size >= size - 1);
  const shuffled = shuffle(seeds);
  for (const seed of shuffled.slice(0, 80)) {
    const letters = seed.split("");
    const sols = solutionsFor(letters);
    if (sols.length >= 8 && sols.some((w) => w.length === size)) {
      return { letters: shuffle(letters), solutions: sols };
    }
  }
  const fallback = "LISTEN".slice(0, size).padEnd(size, "E").split("");
  return { letters: shuffle(fallback), solutions: solutionsFor(fallback) };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newRound(advance = false) {
  if (advance) state.round += 1;
  const size = Number(document.getElementById("difficulty").value);
  const puzzle = pickPuzzle(size);
  state.letters = puzzle.letters;
  state.solutions = puzzle.solutions;
  state.found = new Set();
  state.used = new Set();
  state.current = [];
  setStatus(`Drag across these ${size} letters. Release to check the word.`);
  render();
}

function setStatus(text, kind = "") {
  const el = document.getElementById("status");
  el.textContent = text;
  el.className = `status ${kind}`;
}

let dragging = false;

function syncLetters() {
  document.querySelectorAll("#wheel .letter").forEach((btn) => {
    btn.classList.toggle("used", state.used.has(Number(btn.dataset.index)));
  });
}

function addLetter(index) {
  if (state.used.has(index)) return;
  state.used.add(index);
  state.current.push(index);
  renderCurrent();
  syncLetters();
}

function deleteLetter() {
  const index = state.current.pop();
  if (index === undefined) return;
  state.used.delete(index);
  renderCurrent();
  syncLetters();
}

function submitWord() {
  const word = state.current.map((i) => state.letters[i]).join("");
  if (!word) return;
  if (word.length < MIN_LEN || !state.solutions.includes(word)) {
    setStatus(`${word} is not present.`, "bad");
    clearCurrent();
    return;
  }
  if (state.found.has(word)) {
    setStatus(`${word} is already found.`, "bad");
    clearCurrent();
    return;
  }
  state.found.add(word);
  state.score += SCORE_FOR[word.length] || word.length * 10;
  setStatus(`Nice — ${word} (+${SCORE_FOR[word.length] || 0})`, "good");
  clearCurrent();
  render();
  if (state.found.size === state.solutions.length) {
    setStatus("You found every combination. New letters coming up.", "good");
    setTimeout(() => newRound(true), 900);
  }
}

function clearCurrent() {
  state.current = [];
  state.used = new Set();
  renderCurrent();
  renderWheel();
}

function hint() {
  const missing = state.solutions.filter((w) => !state.found.has(w));
  if (!missing.length) return;
  const word = missing.sort((a, b) => a.length - b.length)[0];
  state.found.add(word);
  state.score = Math.max(0, state.score - 5);
  setStatus(`Hint: ${word}`, "good");
  render();
}

function renderGroups() {
  const root = document.getElementById("word-groups");
  root.innerHTML = "";
  const byLen = {};
  for (const w of state.solutions) {
    byLen[w.length] ??= [];
    byLen[w.length].push(w);
  }
  for (const len of Object.keys(byLen).map(Number).sort((a, b) => a - b)) {
    const group = document.createElement("div");
    group.className = "group";
    group.innerHTML = `<div class="group-title">${len} letters · ${byLen[len].filter((w) => state.found.has(w)).length}/${byLen[len].length}</div>`;
    const slots = document.createElement("div");
    slots.className = "slots";
    for (const w of byLen[len]) {
      const slot = document.createElement("div");
      slot.className = `slot ${state.found.has(w) ? "found" : ""}`;
      slot.textContent = state.found.has(w) ? w : "•".repeat(w.length);
      slots.appendChild(slot);
    }
    group.appendChild(slots);
    root.appendChild(group);
  }
}

function renderCurrent() {
  const el = document.getElementById("current");
  el.innerHTML = state.current.map((i) => `<span>${state.letters[i]}</span>`).join("");
}

function renderWheel() {
  const wheel = document.getElementById("wheel");
  wheel.innerHTML = "";
  const n = state.letters.length;
  state.letters.forEach((ch, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `letter ${state.used.has(i) ? "used" : ""}`;
    btn.textContent = ch;
    btn.dataset.index = String(i);
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    btn.style.left = `${50 + Math.cos(angle) * 34}%`;
    btn.style.top = `${50 + Math.sin(angle) * 34}%`;
    wheel.appendChild(btn);
  });
}

function render() {
  document.getElementById("found").textContent = `${state.found.size}/${state.solutions.length}`;
  document.getElementById("score").textContent = String(state.score);
  document.getElementById("round").textContent = String(state.round);
  renderGroups();
  renderCurrent();
  renderWheel();
}

function letterIndexAt(x, y) {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    const btn = el.closest?.(".letter");
    if (btn && btn.closest("#wheel")) return Number(btn.dataset.index);
  }
  return -1;
}

function beginDrag(event) {
  const index = letterIndexAt(event.clientX, event.clientY);
  if (index < 0) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  const wheel = document.getElementById("wheel");
  dragging = true;
  wheel.classList.add("dragging");
  state.current = [];
  state.used = new Set();
  syncLetters();
  renderCurrent();
  addLetter(index);
  try { wheel.setPointerCapture(event.pointerId); } catch (err) { /* pointer already released */ }
}

function moveDrag(event) {
  if (!dragging) return;
  const index = letterIndexAt(event.clientX, event.clientY);
  if (index >= 0) addLetter(index);
}

function endDrag(event) {
  if (!dragging) return;
  dragging = false;
  const wheel = document.getElementById("wheel");
  wheel.classList.remove("dragging");
  try {
    if (wheel.hasPointerCapture(event.pointerId)) wheel.releasePointerCapture(event.pointerId);
  } catch (err) { /* capture already gone */ }
  submitWord();
}

const wheelEl = document.getElementById("wheel");
wheelEl.addEventListener("pointerdown", beginDrag);
wheelEl.addEventListener("pointermove", moveDrag);
wheelEl.addEventListener("pointerup", endDrag);
wheelEl.addEventListener("pointercancel", endDrag);

document.getElementById("shuffle").addEventListener("click", () => {
  const unused = state.letters.map((ch, i) => ({ ch, i })).filter((x) => !state.used.has(x.i));
  const shuffled = shuffle(unused);
  let k = 0;
  state.letters = state.letters.map((ch, i) => (state.used.has(i) ? ch : shuffled[k++].ch));
  renderWheel();
});
document.getElementById("delete").addEventListener("click", deleteLetter);
document.getElementById("hint").addEventListener("click", hint);
document.getElementById("enter").addEventListener("click", submitWord);
document.getElementById("next").addEventListener("click", () => newRound(true));
document.getElementById("difficulty").addEventListener("change", () => newRound(true));

window.addEventListener("keydown", (e) => {
  if (e.key === "Enter") return submitWord();
  if (e.key === "Backspace") return deleteLetter();
  const ch = e.key.toUpperCase();
  const index = state.letters.findIndex((letter, i) => letter === ch && !state.used.has(i));
  if (index >= 0) addLetter(index);
});

newRound();
