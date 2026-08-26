(function () {
  "use strict";

  // Unlike Witron/Met Office/NMR/Ozone (a single elapsed-time clock that
  // only ever moves forward), this widget is driven by a session index
  // that a scrubber can move in either direction. So render(index) is a
  // pure function of that index — it rebuilds all visible state from
  // scratch every call — rather than an append-only log that assumes
  // monotonic playback.
  var SESSIONS = [
    { day: 1, session: "Morning", battingTeam: "home", innings: "Home 1st innings", score: "45-1 (18 ov)", momentum: 10,
      log: "Home openers settle in cautiously, one early wicket after a testing new-ball spell." },
    { day: 1, session: "Afternoon", battingTeam: "home", innings: "Home 1st innings", score: "130-2 (36 ov)", momentum: 30,
      log: "A composed partnership pushes the score along — Home take control of the session." },
    { day: 1, session: "Evening", battingTeam: "home", innings: "Home 1st innings", score: "210-3 (54 ov)", momentum: 35,
      log: "A late flurry of boundaries before the close; Home end Day 1 well on top." },
    { day: 2, session: "Morning", battingTeam: "home", innings: "Home 1st innings", score: "240-5 (66 ov)", momentum: 15,
      log: "Two quick wickets after the second new ball let Away claw back some control." },
    { day: 2, session: "Afternoon", battingTeam: "home", innings: "Home 1st innings (all out)", score: "340 all out (89.4 ov)", momentum: 20,
      log: "Home bowled out for 340 shortly after lunch — a below-par finish given the platform they had." },
    { day: 2, session: "Evening", battingTeam: "away", innings: "Away 1st innings", score: "60-1 (20 ov)", momentum: 5,
      log: "Away's openers see out a testing evening session under lights." },
    { day: 3, session: "Morning", battingTeam: "away", innings: "Away 1st innings", score: "140-2 (38 ov)", momentum: -10,
      log: "The Away captain launches a fluent counter-attack; the deficit shrinks fast." },
    { day: 3, session: "Afternoon", battingTeam: "away", innings: "Away 1st innings", score: "220-4 (56 ov)", momentum: -5,
      log: "Two wickets fall in three overs, but the total keeps climbing regardless." },
    { day: 3, session: "Evening", battingTeam: "away", innings: "Away 1st innings (all out)", score: "300 all out (84.2 ov)", momentum: 20,
      log: "Away all out for 300 — Home lead by 40 runs on first innings." },
    { day: 4, session: "Morning", battingTeam: "home", innings: "Home 2nd innings", score: "50-2 (16 ov)", momentum: 25,
      log: "Home extend the lead cautiously, losing early wickets in the process." },
    { day: 4, session: "Afternoon", battingTeam: "home", innings: "Home 2nd innings", score: "140-5 (34 ov)", momentum: 10,
      log: "A clatter of wickets in the afternoon threatens to squander the advantage." },
    { day: 4, session: "Evening", battingTeam: "home", innings: "Home 2nd innings (declared)", score: "220-8 dec (52 ov)", momentum: 30,
      log: "Home declare on 220 for 8, setting Away 260 to win with two sessions and a full final day left." },
    { day: 5, session: "Morning", battingTeam: "away", innings: "Away 2nd innings — chasing 260", score: "80-2 (22 ov)", momentum: 15,
      log: "Two early wickets in the chase put Home firmly back in control." },
    { day: 5, session: "Afternoon", battingTeam: "away", innings: "Away 2nd innings — chasing 260", score: "180-6 (44 ov)", momentum: 0,
      log: "The balance swings session to session now — every wicket and boundary matters." },
    { day: 5, session: "Evening", battingTeam: "away", innings: "Away 2nd innings (all out) — Home win by 5 runs", score: "254 all out (61.3 ov)", momentum: 40,
      log: "The last wicket falls in the final over — Home win by 5 runs, as tense a finish as this format produces." },
  ];

  var STEP_MS = 2200;
  var CHART_X0 = 20;
  var CHART_X1 = 380;
  var CHART_BASELINE_Y = 95;
  var MOMENTUM_SCALE = 1.5; // 50 momentum points -> 75px, keeps ±50 within the 20..170 box

  function xAt(i) {
    return CHART_X0 + (i / (SESSIONS.length - 1)) * (CHART_X1 - CHART_X0);
  }

  function yAt(momentum) {
    return CHART_BASELINE_Y - momentum * MOMENTUM_SCALE;
  }

  var chart = document.getElementById("tc-chart");
  var areaPath = document.getElementById("tc-area");
  var linePath = document.getElementById("tc-line");
  var revealRect = document.getElementById("tc-reveal-rect");
  var playhead = document.getElementById("tc-playhead");
  var dayMarkersGroup = document.getElementById("tc-day-markers");
  var strip = document.getElementById("tc-strip");
  var statusEl = document.getElementById("tc-status");
  var logEl = document.getElementById("tc-log");
  var scrubber = document.getElementById("tc-scrubber");
  var scrubberLabel = document.getElementById("tc-scrubber-label");

  if (!chart || !areaPath || !linePath || !revealRect || !playhead ||
      !dayMarkersGroup || !strip || !statusEl || !logEl || !scrubber || !scrubberLabel) {
    return;
  }

  // Build the momentum curve and the strip once, from the SESSIONS data
  // itself, rather than hand-transcribing coordinates into the markup.
  (function buildChart() {
    var linePoints = [];
    for (var i = 0; i < SESSIONS.length; i++) {
      linePoints.push(xAt(i) + "," + yAt(SESSIONS[i].momentum));
    }
    linePath.setAttribute("d", "M" + linePoints.join(" L"));
    areaPath.setAttribute(
      "d",
      "M" + xAt(0) + "," + CHART_BASELINE_Y +
      " L" + linePoints.join(" L") +
      " L" + xAt(SESSIONS.length - 1) + "," + CHART_BASELINE_Y + " Z"
    );

    for (var d = 0; d < SESSIONS.length; d++) {
      if (SESSIONS[d].session !== "Morning") continue;
      var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "tc-day-marker");
      var x = xAt(d);
      var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x);
      line.setAttribute("y1", 14);
      line.setAttribute("x2", x);
      line.setAttribute("y2", 178);
      var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x);
      text.setAttribute("y", 190);
      text.textContent = "D" + SESSIONS[d].day;
      g.appendChild(line);
      g.appendChild(text);
      dayMarkersGroup.appendChild(g);
    }
  })();

  var stripCells = [];
  (function buildStrip() {
    for (var i = 0; i < SESSIONS.length; i++) {
      var cell = document.createElement("div");
      cell.className = "tc-strip-cell " + SESSIONS[i].battingTeam;
      cell.title = "Day " + SESSIONS[i].day + ", " + SESSIONS[i].session +
        " — " + (SESSIONS[i].battingTeam === "home" ? "Home" : "Away") + " batting";
      strip.appendChild(cell);
      stripCells.push(cell);
    }
  })();

  function momentumPhrase(momentum) {
    if (momentum === 0) return "Even";
    var team = momentum > 0 ? "Home" : "Away";
    return team + " ahead (" + (momentum > 0 ? "+" : "") + momentum + ")";
  }

  function render(index) {
    var s = SESSIONS[index];

    scrubber.value = index;
    scrubberLabel.textContent = "Day " + s.day + ", " + s.session;

    var x = xAt(index);
    revealRect.setAttribute("width", Math.max(0, x - CHART_X0));
    playhead.setAttribute("x1", x);
    playhead.setAttribute("x2", x);

    for (var i = 0; i < stripCells.length; i++) {
      stripCells[i].classList.toggle("active", i === index);
      stripCells[i].classList.toggle("done", i < index);
    }

    statusEl.innerHTML =
      '<p class="tc-status-line"><strong>' + s.innings + "</strong></p>" +
      '<p class="tc-status-line">Score: <strong>' + s.score + "</strong></p>" +
      '<p class="tc-status-line">Momentum: <strong>' + momentumPhrase(s.momentum) + "</strong></p>";

    logEl.innerHTML = "";
    for (var j = 0; j <= index; j++) {
      var line = document.createElement("p");
      if (j === index) line.className = "new";
      line.textContent = "Day " + SESSIONS[j].day + ", " + SESSIONS[j].session + " — " + SESSIONS[j].log;
      logEl.appendChild(line);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  var currentIndex = 0;
  var timer = null;

  function stopAutoplay() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(function () {
      currentIndex = (currentIndex + 1) % SESSIONS.length;
      render(currentIndex);
    }, STEP_MS);
  }

  scrubber.addEventListener("input", function () {
    stopAutoplay();
    currentIndex = parseInt(scrubber.value, 10);
    render(currentIndex);
  });

  render(0);
  startAutoplay();
})();
