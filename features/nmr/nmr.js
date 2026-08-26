(function () {
  "use strict";

  var CYCLE = 30; // seconds per loop
  var CELLS = 24;

  // Temperature-drift level (in steps of a synthetic ±0.3°C aircon
  // sawtooth) at each of the 24 acquisition time-slots. This is the one
  // physical timeline both panels are built from.
  var LEVELS = [];
  for (var i = 0; i < CELLS; i++) {
    LEVELS.push(Math.round(2 * Math.sin((2 * Math.PI * i) / 8)));
  }

  // Fixed shuffle of acquisition order: RANDOM_ORDER[i] is the time-slot
  // increment i is actually measured in once acquisition is randomised.
  // INV is its inverse — INV[k] is the increment measured at time-slot k —
  // used to animate cells lighting up in real acquisition order.
  var RANDOM_ORDER = [
    17, 3, 22, 9, 0, 14, 6, 19, 11, 23, 2, 15,
    8, 20, 5, 1, 18, 10, 4, 21, 13, 7, 16, 12,
  ];
  var INV = [];
  for (var j = 0; j < CELLS; j++) INV[RANDOM_ORDER[j]] = j;

  var SEQ_START = 2, SEQ_END = 10;
  var RAND_START = 15, RAND_END = 23;

  // Single source of truth for the log panel, keyed to the same clock
  // that drives the strip/spectrum animation below, so the two can't
  // drift out of sync.
  var EVENTS = [
    { t: 0, log: "Aircon cycling — probe temperature drifting ±0.3°C every ~4 min" },
    { t: SEQ_START, log: "Sequential run starts — 24 t1 increments acquired back-to-back" },
    { t: SEQ_END, log: "Sequential 2D FT — drift is now a smooth function of increment number" },
    { t: 12, log: "Result: a coherent artefact — a faint diagonal beside the real peak" },
    { t: RAND_START, log: "Randomised run starts — same 24 increments, acquisition order shuffled" },
    { t: RAND_END, log: "Randomised 2D FT — drift no longer correlates with increment number" },
    { t: 25, log: "Result: drift spreads into the noise floor — the real peak stands clean" },
    { t: 28, log: "Same physical drift, different acquisition order, different outcome" },
  ];

  function clamp01(f) {
    return f < 0 ? 0 : f > 1 ? 1 : f;
  }

  function seqRevealCount(t) {
    if (t < SEQ_START) return 0;
    if (t >= SEQ_END) return CELLS;
    return Math.floor(((t - SEQ_START) / (SEQ_END - SEQ_START)) * CELLS);
  }

  function randRevealCount(t) {
    if (t < RAND_START) return 0;
    if (t >= RAND_END) return CELLS;
    return Math.floor(((t - RAND_START) / (RAND_END - RAND_START)) * CELLS);
  }

  function seqGhostOpacity(t) {
    return 0.85 * clamp01((t - SEQ_END) / 2);
  }

  function randNoiseOpacity(t) {
    return clamp01((t - RAND_END) / 2);
  }

  var svgNS = "http://www.w3.org/2000/svg";
  var seqStrip = document.getElementById("nmr-seq-strip");
  var randStrip = document.getElementById("nmr-rand-strip");
  var seqGhost = document.getElementById("nmr-seq-ghost");
  var randNoise = document.getElementById("nmr-rand-noise");
  var log = document.getElementById("nmr-log");

  if (!seqStrip || !randStrip || !seqGhost || !randNoise || !log) return;

  var CELL_W = 13, CELL_GAP = 0.5;
  var STRIP_X = 10;

  function buildStrip(container, y) {
    var cells = [];
    for (var i = 0; i < CELLS; i++) {
      var rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", STRIP_X + i * (CELL_W + CELL_GAP));
      rect.setAttribute("y", y);
      rect.setAttribute("width", CELL_W);
      rect.setAttribute("height", 20);
      rect.setAttribute("class", "nmr-cell nmr-pending");
      container.appendChild(rect);
      cells.push(rect);
    }
    return cells;
  }

  var seqCells = buildStrip(seqStrip, 26);
  var randCells = buildStrip(randStrip, 106);

  function levelClass(level) {
    return level === 0 ? "0" : level < 0 ? "n" + -level : "p" + level;
  }

  function paintCell(cell, level) {
    cell.setAttribute("class", "nmr-cell nmr-level-" + levelClass(level));
  }

  function resetCells(cells) {
    for (var c = 0; c < cells.length; c++) {
      cells[c].setAttribute("class", "nmr-cell nmr-pending");
    }
  }

  function appendLogLine(text) {
    var line = document.createElement("p");
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  var revealed = 0;
  var seqRevealed = 0;
  var randRevealed = 0;
  var prevCyclePos = 0;
  var start = null;

  function reset() {
    log.innerHTML = "";
    revealed = 0;
    seqRevealed = 0;
    randRevealed = 0;
    resetCells(seqCells);
    resetCells(randCells);
    seqGhost.style.opacity = 0;
    randNoise.style.opacity = 0;
  }

  reset();

  function frame(timestamp) {
    if (start === null) start = timestamp;
    var elapsed = (timestamp - start) / 1000;
    var cyclePos = elapsed % CYCLE;

    if (cyclePos < prevCyclePos) reset();
    prevCyclePos = cyclePos;

    while (revealed < EVENTS.length && EVENTS[revealed].t <= cyclePos) {
      appendLogLine(EVENTS[revealed].log);
      revealed++;
    }

    var seqCount = seqRevealCount(cyclePos);
    while (seqRevealed < seqCount) {
      paintCell(seqCells[seqRevealed], LEVELS[seqRevealed]);
      seqRevealed++;
    }

    var randCount = randRevealCount(cyclePos);
    while (randRevealed < randCount) {
      paintCell(randCells[INV[randRevealed]], LEVELS[randRevealed]);
      randRevealed++;
    }

    seqGhost.style.opacity = seqGhostOpacity(cyclePos);
    randNoise.style.opacity = randNoiseOpacity(cyclePos);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
