/*
 * Shared engine for the interactive feature pages. Loaded before a
 * feature's own script via the page's `scripts` front matter.
 *
 * Ambient, looping features (Witron, Met Office, NMR, Ozone):
 *
 *   Feature.loop(cycleSeconds, { onReset, onFrame }) -> controller
 *     Runs a requestAnimationFrame loop. Each frame it computes the
 *     elapsed time since the first frame, wraps it to the cycle, calls
 *     onReset() when the clock has just wrapped, then onFrame(t, elapsed)
 *     with t in [0, cycle). No catch-up logic: everything visible is
 *     derived from t. The controller's pause()/resume() freeze and
 *     restart the clock where it stopped.
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
 *
 * Scrubbable, index-driven features (Test cricket, Tour de France):
 *
 *   Feature.scrubber(config) -> controller
 *     The feature supplies data and text; the engine owns the DOM (see
 *     the config comment below). Its pure render(index) rebuilds every
 *     visible thing from scratch, so autoplay and dragging the range
 *     input backwards both just call render.
 *
 * Both kinds:
 *
 *   Feature.playPause(controller, elements, options)
 *     Adds a Play/Pause button and pauses the controller while none of
 *     `elements` is on screen (IntersectionObserver), so nothing animates
 *     in the background. The visitor's own choice wins: once they press
 *     Pause (or scrub, for the scrubber), scrolling back into view
 *     doesn't restart anything until they press Play.
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

// Monotonic clock on the same scale as requestAnimationFrame timestamps;
// only ever used for differences, so the Date fallback is safe.
function featureNow() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

Feature.loop = function (cycle, handlers) {
  var start = null;
  var prevPos = 0;
  var running = false;
  var rafId = null;
  var pausedAt = null;

  function frame(timestamp) {
    rafId = null;
    if (!running) return;
    if (start === null) start = timestamp;
    var elapsed = (timestamp - start) / 1000;
    var pos = elapsed % cycle;

    if (pos < prevPos && handlers.onReset) handlers.onReset();
    prevPos = pos;

    handlers.onFrame(pos, elapsed);
    rafId = requestAnimationFrame(frame);
  }

  var controller = {
    resume: function () {
      if (running) return;
      running = true;
      // Shift the origin by however long we were paused, so the clock
      // carries on from where it stopped rather than jumping ahead.
      if (pausedAt !== null && start !== null) start += featureNow() - pausedAt;
      pausedAt = null;
      rafId = requestAnimationFrame(frame);
    },
    pause: function () {
      if (!running) return;
      running = false;
      pausedAt = featureNow();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };

  controller.resume();
  return controller;
};

/*
 * Feature.scrubber config:
 *   prefix       id prefix, e.g. "tc"; elements are <prefix>-chart,
 *                -area, -line, -reveal-rect, -playhead, -markers, -strip,
 *                -status, -log, -scrubber, -scrubber-label
 *   items        array of data points, one per index
 *   value(item)  number charted for that item
 *   yAt(value)   chart y for a value (feature-specific scale)
 *   baselineY    chart y of the zero line (closes the area path)
 *   markers      [{ index, label }] vertical gridlines with a label
 *   stepMs       autoplay interval
 *   stripClass(item, i)   extra classes for the strip cell
 *   stripTitle(item, i)   tooltip for the strip cell
 *   label(item, i)        text beside the scrubber
 *   statusLines(item, i)  [{ text, strong }] lines for the status box
 *   logLine(item, i)      text of the log line for that item
 */
Feature.scrubber = function (config) {
  var SVG_NS = "http://www.w3.org/2000/svg";
  var CHART_X0 = 20;
  var CHART_X1 = 380;
  var items = config.items;

  function byId(suffix) {
    return document.getElementById(config.prefix + "-" + suffix);
  }

  var chart = byId("chart");
  var areaPath = byId("area");
  var linePath = byId("line");
  var revealRect = byId("reveal-rect");
  var playhead = byId("playhead");
  var markersGroup = byId("markers");
  var strip = byId("strip");
  var statusEl = byId("status");
  var logEl = byId("log");
  var scrubber = byId("scrubber");
  var scrubberLabel = byId("scrubber-label");

  if (!chart || !areaPath || !linePath || !revealRect || !playhead ||
      !markersGroup || !strip || !statusEl || !logEl || !scrubber || !scrubberLabel) {
    return null;
  }

  function xAt(i) {
    return CHART_X0 + (i / (items.length - 1)) * (CHART_X1 - CHART_X0);
  }

  function svg(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var key in attrs) el.setAttribute(key, attrs[key]);
    return el;
  }

  (function buildChart() {
    var points = [];
    for (var i = 0; i < items.length; i++) {
      points.push(xAt(i) + "," + config.yAt(config.value(items[i])));
    }
    linePath.setAttribute("d", "M" + points.join(" L"));
    areaPath.setAttribute(
      "d",
      "M" + xAt(0) + "," + config.baselineY +
      " L" + points.join(" L") +
      " L" + xAt(items.length - 1) + "," + config.baselineY + " Z"
    );

    for (var m = 0; m < config.markers.length; m++) {
      var x = xAt(config.markers[m].index);
      var g = svg("g", { class: "feature-marker" });
      g.appendChild(svg("line", { x1: x, y1: 14, x2: x, y2: 178 }));
      var text = svg("text", { x: x, y: 190 });
      text.textContent = config.markers[m].label;
      g.appendChild(text);
      markersGroup.appendChild(g);
    }
  })();

  var stripCells = [];
  (function buildStrip() {
    for (var i = 0; i < items.length; i++) {
      var cell = document.createElement("div");
      cell.className = "feature-strip-cell " + config.stripClass(items[i], i);
      cell.title = config.stripTitle(items[i], i);
      strip.appendChild(cell);
      stripCells.push(cell);
    }
  })();

  function renderStatus(item, index) {
    statusEl.innerHTML = "";
    var lines = config.statusLines(item, index);
    for (var i = 0; i < lines.length; i++) {
      var p = document.createElement("p");
      if (lines[i].text) p.appendChild(document.createTextNode(lines[i].text));
      var strong = document.createElement("strong");
      strong.textContent = lines[i].strong;
      p.appendChild(strong);
      statusEl.appendChild(p);
    }
  }

  function render(index) {
    var item = items[index];

    scrubber.value = index;
    scrubberLabel.textContent = config.label(item, index);

    var x = xAt(index);
    revealRect.setAttribute("width", x);
    playhead.setAttribute("x1", x);
    playhead.setAttribute("x2", x);

    for (var i = 0; i < stripCells.length; i++) {
      stripCells[i].classList.toggle("active", i === index);
      stripCells[i].classList.toggle("done", i < index);
    }

    renderStatus(item, index);

    logEl.innerHTML = "";
    for (var j = 0; j <= index; j++) {
      var line = document.createElement("p");
      if (j === index) line.className = "new";
      line.textContent = config.logLine(items[j], j);
      logEl.appendChild(line);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  var currentIndex = 0;
  var timer = null;

  var controller = {
    pause: function () {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
    resume: function () {
      if (timer !== null) return;
      timer = setInterval(function () {
        currentIndex = (currentIndex + 1) % items.length;
        render(currentIndex);
      }, config.stepMs);
    },
  };

  render(0);
  controller.resume();

  // The Play/Pause button sits in the scrubber row, which (unlike the
  // aria-hidden widget) is exposed to assistive technology. Dragging the
  // scrubber counts as pressing Pause: the visitor has taken over.
  var widget = chart;
  while (widget && !(widget.classList && widget.classList.contains("feature-widget"))) {
    widget = widget.parentNode;
  }
  var controls = Feature.playPause(controller, [widget || chart], {
    mount: scrubber.parentNode,
    prepend: true,
  });

  scrubber.addEventListener("input", function () {
    controls.setPaused(true);
    currentIndex = parseInt(scrubber.value, 10);
    render(currentIndex);
  });

  return controller;
};

Feature.playPause = function (controller, elements, options) {
  options = options || {};
  var userPaused = false;
  var visible = true;
  var visibility = {};

  function sync() {
    if (visible && !userPaused) controller.resume();
    else controller.pause();
  }

  var button = document.createElement("button");
  button.type = "button";
  button.className = "feature-playpause";

  function renderButton() {
    button.textContent = userPaused ? "Play" : "Pause";
    button.setAttribute("aria-label", userPaused ? "Play animation" : "Pause animation");
  }

  function setPaused(paused) {
    userPaused = paused;
    renderButton();
    sync();
  }

  button.addEventListener("click", function () {
    setPaused(!userPaused);
  });
  renderButton();

  var mount = options.mount;
  if (!mount) {
    mount = document.createElement("div");
    mount.className = "feature-controls";
    var after = elements[0];
    after.parentNode.insertBefore(mount, after.nextSibling);
  }
  if (options.prepend && mount.firstChild) mount.insertBefore(button, mount.firstChild);
  else mount.appendChild(button);

  if (typeof IntersectionObserver !== "undefined") {
    // Assume every element is visible until the observer says otherwise,
    // so a single "offscreen" report for one of several elements doesn't
    // pause the loop while the others are still in view.
    for (var v = 0; v < elements.length; v++) visibility[v] = true;
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        visibility[elements.indexOf(entries[i].target)] = entries[i].isIntersecting;
      }
      visible = false;
      for (var k in visibility) if (visibility[k]) visible = true;
      sync();
    });
    for (var e = 0; e < elements.length; e++) observer.observe(elements[e]);
  }

  return { setPaused: setPaused, button: button };
};
