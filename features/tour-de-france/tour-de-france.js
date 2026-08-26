(function () {
  "use strict";

  // Same pattern as the test-cricket widget: a scrubber-driven index
  // rather than a one-way elapsed-time clock, so render(index) is a pure
  // function that rebuilds all visible state from scratch on every call
  // — it has to work correctly whether the index is stepping forward
  // under autoplay or jumping backward under a drag.
  //
  // gap is signed seconds between the overall race leader and the
  // closest rival: positive means the original leader is still ahead,
  // negative means the lead has changed hands.
  var STAGES = [
    { type: "flat", gap: 4, log: "A bunch sprint decides the opening stage — a handful of bonus seconds separate the overall contenders." },
    { type: "flat", gap: 4, log: "Another sprint stage, another bunch finish — the peloton stays together and nothing changes at the top." },
    { type: "hilly", gap: 12, log: "A late uphill kick on a hilly stage nets a few extra bonus seconds for the overall leader." },
    { type: "flat", gap: 12, log: "Flat and uneventful — a breakaway takes the stage, the general classification doesn't move." },
    { type: "mountain", gap: 85, log: "The race hits the high mountains for the first time — a summit finish blows the gap wide open." },
    { type: "hilly", gap: 80, log: "A quieter transitional stage; the break stays away for the win, the GC riders mark each other." },
    { type: "flat", gap: 80, log: "Another flat stage, another bunch sprint — the overall standings hold steady." },
    { type: "flat", gap: 80, log: "Crosswinds threaten to split the field, but the peloton regroups before the line — no change overall." },
    { type: "itt", gap: -35, log: "An individual time trial turns the race on its head — a specialist against the watch flips the gap in one afternoon." },
    { type: "flat", gap: -35, log: "A flat sprint stage the day after the time trial — legs recover, the standings don't change." },
    { type: "mountain", gap: -10, log: "The Pyrenees begin — the new race leader's rival claws back time on the first big climbing test." },
    { type: "mountain", gap: 25, log: "A dominant summit finish swings the race lead back the other way, with seconds to spare." },
    { type: "mountain", gap: 95, log: "The queen stage of the race — brutal climbing thins the group and the gap balloons past a minute and a half." },
    { type: "mountain", gap: 110, log: "One more day in the high mountains consolidates the advantage further." },
    { type: "flat", gap: 110, log: "A flat, forgettable stage — the break contests the win, the overall gap doesn't move." },
    { type: "hilly", gap: 105, log: "A hilly stage nibbles a few seconds back, but the order at the top is unchanged." },
    { type: "flat", gap: 105, log: "Sprinters' stage — the bunch comes together for the finish, no change overall." },
    { type: "flat", gap: 105, log: "Another day for the fast men — the general classification riders sit in, saving themselves." },
    { type: "mountain", gap: 130, log: "The last mountain stage before Paris — a near-faultless ride puts the result beyond real doubt." },
    { type: "itt", gap: 140, log: "One final effort against the clock — the gap edges out slightly further with only the procession left." },
    { type: "flat", gap: 140, log: "The traditional, largely ceremonial ride into Paris — sprinters contest the finish, the overall result is already settled." },
  ];

  var TYPE_LABEL = {
    flat: "Flat / sprint stage",
    hilly: "Hilly stage",
    mountain: "Mountain stage",
    itt: "Individual time trial",
  };

  var STEP_MS = 1600;
  var CHART_X0 = 20;
  var CHART_X1 = 380;
  var GAP_MAX = 150; // seconds, top of the chart
  var GAP_MIN = -60; // seconds, bottom of the chart
  var CHART_Y_TOP = 20;
  var CHART_Y_BOTTOM = 170;

  function xAt(i) {
    return CHART_X0 + (i / (STAGES.length - 1)) * (CHART_X1 - CHART_X0);
  }

  function yAt(gap) {
    var f = (GAP_MAX - gap) / (GAP_MAX - GAP_MIN);
    return CHART_Y_TOP + f * (CHART_Y_BOTTOM - CHART_Y_TOP);
  }

  function formatGap(gap) {
    var abs = Math.abs(gap);
    var m = Math.floor(abs / 60);
    var s = abs % 60;
    return (gap < 0 ? "-" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function gapPhrase(gap) {
    if (gap === 0) return "Tied on general classification";
    var leader = gap > 0 ? "Rider A" : "Rider B";
    return leader + " leads by " + formatGap(gap);
  }

  var chart = document.getElementById("tdf-chart");
  var areaPath = document.getElementById("tdf-area");
  var linePath = document.getElementById("tdf-line");
  var revealRect = document.getElementById("tdf-reveal-rect");
  var playhead = document.getElementById("tdf-playhead");
  var weekMarkersGroup = document.getElementById("tdf-week-markers");
  var strip = document.getElementById("tdf-strip");
  var statusEl = document.getElementById("tdf-status");
  var logEl = document.getElementById("tdf-log");
  var scrubber = document.getElementById("tdf-scrubber");
  var scrubberLabel = document.getElementById("tdf-scrubber-label");

  if (!chart || !areaPath || !linePath || !revealRect || !playhead ||
      !weekMarkersGroup || !strip || !statusEl || !logEl || !scrubber || !scrubberLabel) {
    return;
  }

  (function buildChart() {
    var baselineY = yAt(0);
    var linePoints = [];
    for (var i = 0; i < STAGES.length; i++) {
      linePoints.push(xAt(i) + "," + yAt(STAGES[i].gap));
    }
    linePath.setAttribute("d", "M" + linePoints.join(" L"));
    areaPath.setAttribute(
      "d",
      "M" + xAt(0) + "," + baselineY +
      " L" + linePoints.join(" L") +
      " L" + xAt(STAGES.length - 1) + "," + baselineY + " Z"
    );

    var weekStarts = [0, 7, 14];
    for (var w = 0; w < weekStarts.length; w++) {
      var idx = weekStarts[w];
      var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "tdf-week-marker");
      var x = xAt(idx);
      var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x);
      line.setAttribute("y1", 14);
      line.setAttribute("x2", x);
      line.setAttribute("y2", 178);
      var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x);
      text.setAttribute("y", 190);
      text.textContent = "Wk " + (w + 1);
      g.appendChild(line);
      g.appendChild(text);
      weekMarkersGroup.appendChild(g);
    }
  })();

  var stripCells = [];
  (function buildStrip() {
    for (var i = 0; i < STAGES.length; i++) {
      var cell = document.createElement("div");
      cell.className = "tdf-strip-cell " + STAGES[i].type;
      cell.title = "Stage " + (i + 1) + " — " + TYPE_LABEL[STAGES[i].type];
      strip.appendChild(cell);
      stripCells.push(cell);
    }
  })();

  function render(index) {
    var s = STAGES[index];

    scrubber.value = index;
    scrubberLabel.textContent = "Stage " + (index + 1);

    var x = xAt(index);
    revealRect.setAttribute("width", Math.max(0, x - CHART_X0));
    playhead.setAttribute("x1", x);
    playhead.setAttribute("x2", x);

    for (var i = 0; i < stripCells.length; i++) {
      stripCells[i].classList.toggle("active", i === index);
      stripCells[i].classList.toggle("done", i < index);
    }

    statusEl.innerHTML =
      '<p class="tdf-status-line">Stage ' + (index + 1) + " of " + STAGES.length +
        " — <strong>" + TYPE_LABEL[s.type] + "</strong></p>" +
      '<p class="tdf-status-line">General classification: <strong>' + gapPhrase(s.gap) + "</strong></p>";

    logEl.innerHTML = "";
    for (var j = 0; j <= index; j++) {
      var line = document.createElement("p");
      if (j === index) line.className = "new";
      line.textContent = "Stage " + (j + 1) + " — " + STAGES[j].log;
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
      currentIndex = (currentIndex + 1) % STAGES.length;
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
