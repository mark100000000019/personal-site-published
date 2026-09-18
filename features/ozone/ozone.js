(function () {
  "use strict";

  // Two independent clocks, both derived from the same elapsed timer, the
  // same way Witron/Met Office/NMR derive everything from `t`: a fast loop
  // for the (seconds-timescale) catalytic cycle, a slow loop for the
  // (decades-timescale) hole-area sweep. Feature.loop drives the slow
  // cycle; the fast one is derived from the raw elapsed time it passes.
  var FAST_CYCLE = 8; // seconds per catalytic-cycle lap
  var SLOW_CYCLE = 30; // seconds per decades-chart loop
  var SWEEP_DURATION = 24; // seconds of the slow loop spent drawing
  var SWEEP_START_YEAR = 1975;
  var SWEEP_END_YEAR = 2020;
  var CHART_X0 = 20;
  var CHART_X1 = 380;

  function yearT(year) {
    return (
      ((year - SWEEP_START_YEAR) / (SWEEP_END_YEAR - SWEEP_START_YEAR)) *
      SWEEP_DURATION
    );
  }

  // Single source of truth for the log panel and the chart markers: every
  // entry fires at time t within the slow loop, and an entry tied to a
  // milestone year also reveals that marker on the chart.
  var EVENTS = [
    { t: 0, log: "Sweeping 1975 → present — schematic hole area, real milestone years" },
    { t: yearT(1985), log: "1985 — ozone hole discovered (Farman, Gardiner & Shanklin)", markerId: "oz-marker-1985" },
    { t: yearT(1987), log: "1987 — Montreal Protocol signed", markerId: "oz-marker-1987" },
    { t: yearT(1989), log: "1989 — Protocol enters into force", markerId: "oz-marker-1989" },
    { t: yearT(1996), log: "1996 — CFC production phased out in developed nations", markerId: "oz-marker-1996" },
    { t: yearT(2016), log: "2016 — first confirmed signs of recovery", markerId: "oz-marker-2016" },
    { t: SWEEP_DURATION, log: "Sweep complete — hole narrowing, but not yet fully closed" },
    { t: 27, log: "Full recovery projected around the 2060s" },
  ];

  function clamp01(f) {
    return f < 0 ? 0 : f > 1 ? 1 : f;
  }

  function playheadX(t) {
    return CHART_X0 + clamp01(t / SWEEP_DURATION) * (CHART_X1 - CHART_X0);
  }

  var nodes = [];
  for (var n = 0; n < 4; n++) {
    nodes.push(document.getElementById("oz-node-" + n));
  }

  var counterEl = document.getElementById("oz-counter");
  var revealRect = document.getElementById("oz-reveal-rect");
  var playhead = document.getElementById("oz-playhead");
  var log = document.getElementById("ozone-log");

  if (!counterEl || !revealRect || !playhead || !log || nodes.indexOf(null) !== -1) {
    return;
  }

  function updateNodes(active) {
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle("active", i === active);
    }
  }

  function markerEl(event) {
    return event.markerId ? document.getElementById(event.markerId) : null;
  }

  var events = Feature.eventLog(log, EVENTS, function (event) {
    Feature.appendLogLine(log, event.log);
    var el = markerEl(event);
    if (el) el.classList.add("revealed");
  });

  function resetSlow() {
    events.reset();
    for (var i = 0; i < EVENTS.length; i++) {
      var el = markerEl(EVENTS[i]);
      if (el) el.classList.remove("revealed");
    }
  }

  var destroyedCount = 0;
  var prevFastPos = 0;

  resetSlow();
  updateNodes(0);

  Feature.loop(SLOW_CYCLE, {
    onReset: resetSlow,
    onFrame: function (slowPos, elapsed) {
      events.advance(slowPos);

      var x = playheadX(slowPos);
      playhead.setAttribute("x1", x);
      playhead.setAttribute("x2", x);
      revealRect.setAttribute("width", x);

      // The fast catalytic-cycle clock: its counter deliberately never
      // resets, reading as cumulative damage from one unchanged atom.
      var fastPos = elapsed % FAST_CYCLE;
      if (fastPos < prevFastPos) {
        destroyedCount++;
        counterEl.textContent = destroyedCount;
      }
      prevFastPos = fastPos;
      updateNodes(Math.floor(fastPos / 2) % 4);
    },
  });
})();
