(function () {
  "use strict";

  var CYCLE = 30; // seconds per loop

  // Single source of truth for the log panel: every event has a time
  // within the loop, a flavour clock-time, and its log line. The scene
  // animation is derived separately (below) but keyed to the same times,
  // so the two panels can never drift out of sync.
  var EVENTS = [
    { t: 0, clock: "08:02", text: "Inbound lorry arrives — Dock 3" },
    { t: 3, clock: "08:05", text: "Pallet unloaded, staged for putaway" },
    { t: 6, clock: "08:11", text: "Stored — bay B-14" },
    { t: 10, clock: "08:12", text: "Inbound lorry departs" },
    { t: 13, clock: "09:47", text: "Pick generated — order #4521" },
    { t: 16, clock: "09:49", text: "Picked from bay B-14" },
    { t: 19, clock: "09:52", text: "Staged for outbound loading" },
    { t: 22, clock: "10:15", text: "Outbound lorry arrives — Dock 7" },
    { t: 25, clock: "10:18", text: "Loaded onto outbound lorry" },
    { t: 28, clock: "10:22", text: "Departs for store" },
  ];

  var INBOUND_DOCK = { x: 40, y: 150 };
  var GOODS_IN = { x: 160, y: 150 };
  var RACK_BAY = { x: 320, y: 92 };
  var PICK_FACE = { x: 320, y: 150 };
  var OUTBOUND_STAGING = { x: 460, y: 150 };
  var OUTBOUND_DOCK = { x: 580, y: 150 };
  var OFFSCREEN_LEFT = { x: -40, y: 150 };
  var OFFSCREEN_RIGHT = { x: 680, y: 150 };

  // Where the pallet sits as of each event time. Positions carry
  // forward between waypoints (piecewise-linear interpolation), so an
  // event that doesn't move the pallet (e.g. "pick generated") just
  // repeats the previous position.
  var PALLET_WAYPOINTS = [
    { t: 0, pos: INBOUND_DOCK },
    { t: 3, pos: GOODS_IN },
    { t: 6, pos: RACK_BAY },
    { t: 10, pos: RACK_BAY },
    { t: 13, pos: RACK_BAY },
    { t: 16, pos: PICK_FACE },
    { t: 19, pos: OUTBOUND_STAGING },
    { t: 22, pos: OUTBOUND_STAGING },
    { t: 25, pos: OUTBOUND_DOCK },
    { t: 28, pos: OFFSCREEN_RIGHT },
  ];

  function lerp(a, b, f) {
    return a + (b - a) * f;
  }

  function smoothstep(f) {
    return f * f * (3 - 2 * f);
  }

  function clamp01(f) {
    return f < 0 ? 0 : f > 1 ? 1 : f;
  }

  function positionAt(t, start, end, from, to) {
    var f = smoothstep(clamp01((t - start) / (end - start)));
    return { x: lerp(from.x, to.x, f), y: lerp(from.y, to.y, f) };
  }

  function palletPosition(t) {
    for (var i = 0; i < PALLET_WAYPOINTS.length - 1; i++) {
      var a = PALLET_WAYPOINTS[i];
      var b = PALLET_WAYPOINTS[i + 1];
      if (t >= a.t && t < b.t) {
        return positionAt(t, a.t, b.t, a.pos, b.pos);
      }
    }
    return t < PALLET_WAYPOINTS[0].t
      ? PALLET_WAYPOINTS[0].pos
      : PALLET_WAYPOINTS[PALLET_WAYPOINTS.length - 1].pos;
  }

  // Inbound lorry: docked 0-10, drives off 10-13, off-screen until it
  // drives back in for the final few seconds of the loop.
  function inboundLorryPosition(t) {
    if (t < 10) return INBOUND_DOCK;
    if (t < 13) return positionAt(t, 10, 13, INBOUND_DOCK, OFFSCREEN_LEFT);
    if (t < 27) return OFFSCREEN_LEFT;
    return positionAt(t, 27, CYCLE, OFFSCREEN_LEFT, INBOUND_DOCK);
  }

  // Outbound lorry: off-screen until it drives in for the pick, docked
  // 22-28, then drives off again as the loop ends.
  function outboundLorryPosition(t) {
    if (t < 19) return OFFSCREEN_RIGHT;
    if (t < 22) return positionAt(t, 19, 22, OFFSCREEN_RIGHT, OUTBOUND_DOCK);
    if (t < 28) return OUTBOUND_DOCK;
    return positionAt(t, 28, CYCLE, OUTBOUND_DOCK, OFFSCREEN_RIGHT);
  }

  var pallet = document.getElementById("pallet");
  var inboundLorry = document.getElementById("inbound-lorry");
  var outboundLorry = document.getElementById("outbound-lorry");
  var log = document.getElementById("witron-log");

  function setPos(el, pos) {
    el.setAttribute("transform", "translate(" + pos.x + "," + pos.y + ")");
  }

  function renderScene(t) {
    var p = palletPosition(t);
    pallet.setAttribute("x", p.x - 7);
    pallet.setAttribute("y", p.y - 7);
    setPos(inboundLorry, inboundLorryPosition(t));
    setPos(outboundLorry, outboundLorryPosition(t));
  }

  function appendLogLine(event) {
    var line = document.createElement("p");
    var time = document.createElement("time");
    time.textContent = event.clock;
    line.appendChild(time);
    line.appendChild(document.createTextNode(" — " + event.text));
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  if (!pallet || !inboundLorry || !outboundLorry || !log) return;

  inboundLorry.style.opacity = 1;
  outboundLorry.style.opacity = 1;

  var revealed = 0;
  var prevCyclePos = 0;
  var start = null;

  function frame(timestamp) {
    if (start === null) start = timestamp;
    var elapsed = (timestamp - start) / 1000;
    var cyclePos = elapsed % CYCLE;

    if (cyclePos < prevCyclePos) {
      log.innerHTML = "";
      revealed = 0;
    }
    prevCyclePos = cyclePos;

    renderScene(cyclePos);

    while (revealed < EVENTS.length && EVENTS[revealed].t <= cyclePos) {
      appendLogLine(EVENTS[revealed]);
      revealed++;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
