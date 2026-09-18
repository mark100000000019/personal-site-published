/*
 * Shared engine for the scrubbable, index-driven features (Test cricket,
 * Tour de France). Loaded before the feature's own script via the page's
 * `scripts` front matter.
 *
 *   Feature.scrubber(config)
 *
 * The feature supplies data and text; the engine owns the DOM: it builds
 * the chart path and area from the data, the static markers, the strip
 * of cells, and then a pure render(index) that rebuilds every visible
 * thing from scratch, so autoplay and dragging the range input
 * backwards both just call render. Element ids are derived from
 * config.prefix: <prefix>-chart, -area, -line, -reveal-rect, -playhead,
 * -markers, -strip, -status, -log, -scrubber, -scrubber-label.
 *
 * config:
 *   prefix       id prefix, e.g. "tc"
 *   items        array of data points, one per index
 *   value(item)  number charted for that item
 *   yAt(value)   chart y for a value (feature-specific scale)
 *   baselineY    chart y of the zero line (closes the area path)
 *   markers      [{ index, label }] vertical gridlines with a label
 *   stepMs       autoplay interval; the first scrubber drag stops it
 *   stripClass(item, i)   extra classes for the strip cell
 *   stripTitle(item, i)   tooltip for the strip cell
 *   label(item, i)        text beside the scrubber
 *   statusLines(item, i)  [{ text, strong }] lines for the status box
 *   logLine(item, i)      text of the log line for that item
 */
var Feature = window.Feature = window.Feature || {};

Feature.scrubber = function (config) {
  var SVG_NS = "http://www.w3.org/2000/svg";
  var CHART_X0 = 20;
  var CHART_X1 = 380;
  var items = config.items;

  function byId(suffix) {
    return document.getElementById(config.prefix + "-" + suffix);
  }

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

  if (!byId("chart") || !areaPath || !linePath || !revealRect || !playhead ||
      !markersGroup || !strip || !statusEl || !logEl || !scrubber || !scrubberLabel) {
    return;
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

  function stopAutoplay() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(function () {
      currentIndex = (currentIndex + 1) % items.length;
      render(currentIndex);
    }, config.stepMs);
  }

  scrubber.addEventListener("input", function () {
    stopAutoplay();
    currentIndex = parseInt(scrubber.value, 10);
    render(currentIndex);
  });

  render(0);
  startAutoplay();
};
