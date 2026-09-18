/*
 * Shared engine for the ambient, looping features (Witron, Met Office,
 * NMR, Ozone). Loaded before the feature's own script via the page's
 * `scripts` front matter.
 *
 *   Feature.loop(cycleSeconds, { onReset, onFrame })
 *     Runs a requestAnimationFrame loop. Each frame it computes the
 *     elapsed time since the first frame, wraps it to the cycle, calls
 *     onReset() when the clock has just wrapped, then onFrame(t, elapsed)
 *     with t in [0, cycle). No catch-up logic: everything visible is
 *     derived from t, so a tab that was in the background simply jumps
 *     to wherever the clock now is.
 *
 *   Feature.eventLog(logEl, events, apply)
 *     A cursor over a time-ordered array of events ({ t, ... }).
 *     advance(t) applies every not-yet-applied event with event.t <= t,
 *     in order, via apply(event, index); reset() empties the log panel
 *     and rewinds the cursor. The default apply appends event.log as a
 *     line of the log panel.
 *
 *   Feature.appendLogLine(logEl, text)
 *     Appends a <p> to a log panel and keeps it scrolled to the bottom.
 */
var Feature = window.Feature = window.Feature || {};

Feature.appendLogLine = function (logEl, text) {
  var line = document.createElement("p");
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
  return line;
};

Feature.eventLog = function (logEl, events, apply) {
  var revealed = 0;
  if (!apply) {
    apply = function (event) {
      Feature.appendLogLine(logEl, event.log);
    };
  }
  return {
    advance: function (t) {
      while (revealed < events.length && events[revealed].t <= t) {
        apply(events[revealed], revealed);
        revealed++;
      }
    },
    reset: function () {
      logEl.innerHTML = "";
      revealed = 0;
    },
  };
};

Feature.loop = function (cycle, handlers) {
  var start = null;
  var prevPos = 0;

  function frame(timestamp) {
    if (start === null) start = timestamp;
    var elapsed = (timestamp - start) / 1000;
    var pos = elapsed % cycle;

    if (pos < prevPos && handlers.onReset) handlers.onReset();
    prevPos = pos;

    handlers.onFrame(pos, elapsed);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
};
