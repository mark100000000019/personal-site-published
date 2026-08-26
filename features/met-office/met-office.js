(function () {
  "use strict";

  var CYCLE = 30; // seconds per loop

  var BASE =
    "Keswick: cloudy with heavy showers this morning, 80% chance of " +
    "rain, easing during the afternoon before a clear evening.";
  var WITH_TEMP = BASE + " Max 14C min 6C.";
  var FULL = WITH_TEMP + " Wind southwesterly 25mph, gusting 40mph at times.";
  var TRIM1 = WITH_TEMP + " Wind southwesterly 25mph.";
  var TRIM2 = WITH_TEMP + " Wind SW 25mph.";
  var BUDGET = 160;

  var CHECK_PLACEHOLDER = "≤160 chars?";

  // Single source of truth, exactly like the Witron feature: each event
  // carries a log line, the node it activates, and (where relevant) the
  // draft text/character count as of that moment. Both panes are derived
  // purely from how many events have fired, so they can't drift apart.
  var EVENTS = [
    { t: 0, log: "Data in — Keswick, 06:00 forecast run", draft: "", count: 0 },
    {
      t: 3,
      log: "Rain prob 80% → include shower clause",
      draft: BASE,
      count: BASE.length,
    },
    {
      t: 6,
      log: "Gust 40mph → include wind detail",
      draft: FULL,
      count: FULL.length,
    },
    {
      t: 9,
      log: "Draft assembled — " + FULL.length + " chars",
      draft: FULL,
      count: FULL.length,
    },
    {
      t: 12,
      log: "Over budget: " + FULL.length + "/" + BUDGET + " — trimming required",
      draft: FULL,
      count: FULL.length,
      checkId: "mo-check-1",
      checkText: "FAIL — " + FULL.length + "/" + BUDGET,
      checkClass: "fail",
    },
    {
      t: 15,
      log: "Drop gust clause (lowest priority) → " + TRIM1.length + " chars",
      draft: TRIM1,
      count: TRIM1.length,
    },
    {
      t: 18,
      log: "Still over: " + TRIM1.length + "/" + BUDGET + " — simplify further",
      draft: TRIM1,
      count: TRIM1.length,
      checkId: "mo-check-2",
      checkText: "FAIL — " + TRIM1.length + "/" + BUDGET,
      checkClass: "fail",
    },
    {
      t: 21,
      log: "Wind clause shortened → " + TRIM2.length + " chars",
      draft: TRIM2,
      count: TRIM2.length,
    },
    {
      t: 24,
      log: "Fits: " + TRIM2.length + "/" + BUDGET + " — approved for send",
      draft: TRIM2,
      count: TRIM2.length,
      checkId: "mo-check-3",
      checkText: "PASS — " + TRIM2.length + "/" + BUDGET,
      checkClass: "pass",
    },
    {
      t: 27,
      log: "“" + TRIM2 + "” — SENT",
      draft: TRIM2,
      count: TRIM2.length,
      sent: true,
    },
  ];

  var nodes = [];
  for (var n = 0; n < EVENTS.length; n++) {
    nodes.push(document.getElementById("mo-node-" + n));
  }

  var draftText = document.getElementById("mo-draft-text");
  var budgetFill = document.getElementById("mo-budget-fill");
  var budgetCount = document.getElementById("mo-budget-count");
  var log = document.getElementById("mo-log");

  if (!log || nodes.indexOf(null) !== -1) return;

  function updateNodes(revealedCount) {
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      el.classList.remove("pending", "active", "done");
      if (i < revealedCount - 1) {
        el.classList.add("done");
      } else if (i === revealedCount - 1) {
        el.classList.add("active");
      } else {
        el.classList.add("pending");
      }
    }
  }

  function setDraft(text, count, sent) {
    draftText.textContent = text || "Composing…";
    budgetCount.textContent = count + " / " + BUDGET;
    budgetFill.style.width = Math.min(100, (count / BUDGET) * 100) + "%";
    budgetFill.classList.toggle("over", count > BUDGET);
    budgetFill.classList.toggle("sent", !!sent);
  }

  function resetChecks() {
    ["mo-check-1", "mo-check-2", "mo-check-3"].forEach(function (id) {
      var el = document.getElementById(id);
      el.textContent = CHECK_PLACEHOLDER;
      el.parentNode.classList.remove("fail", "pass");
    });
  }

  function appendLogLine(event) {
    var line = document.createElement("p");
    line.textContent = event.log;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function applyEvent(event) {
    setDraft(event.draft, event.count, event.sent);
    appendLogLine(event);
    if (event.checkId) {
      var el = document.getElementById(event.checkId);
      el.textContent = event.checkText;
      el.parentNode.classList.add(event.checkClass);
    }
  }

  var revealed = 0;
  var prevCyclePos = 0;
  var start = null;

  updateNodes(0);
  resetChecks();

  function frame(timestamp) {
    if (start === null) start = timestamp;
    var elapsed = (timestamp - start) / 1000;
    var cyclePos = elapsed % CYCLE;

    if (cyclePos < prevCyclePos) {
      log.innerHTML = "";
      revealed = 0;
      setDraft("", 0, false);
      resetChecks();
      updateNodes(0);
    }
    prevCyclePos = cyclePos;

    while (revealed < EVENTS.length && EVENTS[revealed].t <= cyclePos) {
      applyEvent(EVENTS[revealed]);
      revealed++;
      updateNodes(revealed);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
