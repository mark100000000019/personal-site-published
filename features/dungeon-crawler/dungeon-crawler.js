(function () {
  "use strict";

  // Unlike Witron/NMR/Met Office/Ozone, this is input-driven, not an
  // ambient render(t) loop: state changes only on a move/turn/attack, and
  // redraw() rebuilds the scene from current state. Movement snaps to
  // grid cells (no tweening) and turns snap to 90 degrees.

  // The corridor below the door is single-file on purpose: door (D) ->
  // goblin (G) -> treasure (T) is the only route, so the encounter can't
  // be walked around.
  var MAP = [
    "#######",
    "#S....#",
    "#.##.##",
    "#.##D##",
    "#L##G##",
    "#.##.T#",
    "#######",
  ];
  var START = { x: 1, y: 1 };
  var START_FACING = 1; // 0=N, 1=E, 2=S, 3=W

  var FORWARD = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  var SVG_NS = "http://www.w3.org/2000/svg";
  var CX = 200,
    CY = 120;
  var DEPTH = 5;
  var SHRINK = 0.62;
  var NEAR_HALF_W = 190;
  var NEAR_HALF_H = 108;

  var HALF_W = [],
    HALF_H = [];
  for (var d = 0; d <= DEPTH; d++) {
    HALF_W[d] = NEAR_HALF_W * Math.pow(SHRINK, d);
    HALF_H[d] = NEAR_HALF_H * Math.pow(SHRINK, d);
  }

  function boundary(i) {
    return {
      left: CX - HALF_W[i],
      right: CX + HALF_W[i],
      top: CY - HALF_H[i],
      bottom: CY + HALF_H[i],
    };
  }

  var scene = document.getElementById("dc-scene");
  var minimap = document.getElementById("dc-minimap");
  var logEl = document.getElementById("dc-log");
  var hpEl = document.getElementById("dc-hp");
  var enemyHpEl = document.getElementById("dc-enemy-hp");
  var encounterEl = document.getElementById("dc-encounter");
  var attackBtn = document.getElementById("dc-attack-btn");

  if (!scene || !minimap || !logEl || !hpEl || !enemyHpEl || !encounterEl || !attackBtn) {
    return;
  }

  var state = {
    pos: { x: START.x, y: START.y },
    facing: START_FACING,
    doorOpen: false,
    goblinDefeated: false,
    treasureFound: false,
    playerHP: 3,
    enemyHP: 3,
    encounterActive: false,
  };

  function tileAt(x, y) {
    if (y < 0 || y >= MAP.length || x < 0 || x >= MAP[0].length) return "#";
    return MAP[y].charAt(x);
  }

  function isWall(ch) {
    if (ch === "#") return true;
    if (ch === "D") return !state.doorOpen;
    if (ch === "G") return !state.goblinDefeated;
    return false;
  }

  function wallClass(ch) {
    if (ch === "D") return "dc-wall-door";
    if (ch === "G") return "dc-wall-monster";
    return "dc-wall-plain";
  }

  function log(text) {
    var p = document.createElement("p");
    p.textContent = text;
    logEl.appendChild(p);
    while (logEl.children.length > 30) {
      logEl.removeChild(logEl.firstChild);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function el(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    for (var key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  }

  function pointsAttr(pts) {
    return pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
  }

  function sidePoints(side, i) {
    var a = boundary(i),
      b = boundary(i + 1);
    if (side === "R") {
      return [[a.right, a.top], [b.right, b.top], [b.right, b.bottom], [a.right, a.bottom]];
    }
    return [[a.left, a.top], [b.left, b.top], [b.left, b.bottom], [a.left, a.bottom]];
  }

  function floorPoints() {
    var a = boundary(0),
      b = boundary(DEPTH);
    return [[a.left, a.bottom], [a.right, a.bottom], [b.right, b.bottom], [b.left, b.bottom]];
  }

  function ceilingPoints() {
    var a = boundary(0),
      b = boundary(DEPTH);
    return [[a.left, a.top], [a.right, a.top], [b.right, b.top], [b.left, b.top]];
  }

  function cellAt(pos, fwd, depth, right, offset) {
    var x = pos.x + fwd.dx * depth + right.dx * offset;
    var y = pos.y + fwd.dy * depth + right.dy * offset;
    return tileAt(x, y);
  }

  // Lever and treasure markers sit on the floor of their cell, drawn only
  // when the cell is straight ahead (offset 0): the view has no floor
  // quads for lateral cells, and every approach in this map is head-on.
  function floorMarker(depth, ch) {
    var near = boundary(depth);
    var far = boundary(depth + 1);
    var yMid = (near.bottom + far.bottom) / 2;
    var hw = HALF_W[depth + 1] * 0.3;
    var hh = (near.bottom - far.bottom) * 0.3;
    var height = HALF_H[depth + 1] * 0.6;
    var g;

    if (ch === "L") {
      g = el("g", { class: "dc-lever" + (state.doorOpen ? " pulled" : "") });
      g.appendChild(el("polygon", {
        points: pointsAttr([
          [CX - hw, yMid + hh], [CX + hw, yMid + hh],
          [CX + hw * 0.7, yMid - hh], [CX - hw * 0.7, yMid - hh],
        ]),
      }));
      var tipX = CX + (state.doorOpen ? 1 : -1) * hw * 0.8;
      var tipY = yMid - height;
      g.appendChild(el("line", { x1: CX, y1: yMid, x2: tipX, y2: tipY }));
      g.appendChild(el("circle", { cx: tipX, cy: tipY, r: Math.max(1.5, hw * 0.25) }));
      return g;
    }

    g = el("g", { class: "dc-treasure" + (state.treasureFound ? " found" : "") });
    var top = yMid - height;
    g.appendChild(el("rect", {
      x: CX - hw, y: top, width: 2 * hw, height: yMid + hh - top, rx: 1,
    }));
    var lidY = top + (yMid + hh - top) * 0.35;
    g.appendChild(el("line", { x1: CX - hw, y1: lidY, x2: CX + hw, y2: lidY }));
    return g;
  }

  function redraw() {
    while (scene.firstChild) scene.removeChild(scene.firstChild);

    scene.appendChild(el("polygon", { points: pointsAttr(ceilingPoints()), class: "dc-ceiling" }));
    scene.appendChild(el("polygon", { points: pointsAttr(floorPoints()), class: "dc-floor" }));

    var fwd = FORWARD[state.facing];
    var right = FORWARD[(state.facing + 1) % 4];

    for (var i = DEPTH - 1; i >= 0; i--) {
      var leftCell = cellAt(state.pos, fwd, i, right, -1);
      var rightCell = cellAt(state.pos, fwd, i, right, 1);
      if (isWall(leftCell)) {
        scene.appendChild(el("polygon", { points: pointsAttr(sidePoints("L", i)), class: wallClass(leftCell) }));
      }
      if (isWall(rightCell)) {
        scene.appendChild(el("polygon", { points: pointsAttr(sidePoints("R", i)), class: wallClass(rightCell) }));
      }

      var frontCell = cellAt(state.pos, fwd, i + 1, right, 0);
      if (isWall(frontCell)) {
        var b = boundary(i + 1);
        scene.appendChild(el("rect", {
          x: b.left, y: b.top, width: b.right - b.left, height: b.bottom - b.top,
          class: wallClass(frontCell),
        }));
      } else if ((frontCell === "L" || frontCell === "T") && i + 1 < DEPTH) {
        // Nearer front walls are drawn on later iterations, so a marker
        // behind a wall gets covered rather than needing a visibility test.
        scene.appendChild(floorMarker(i + 1, frontCell));
      }
    }

    redrawMinimap();
    hpEl.textContent = state.playerHP;
  }

  function minimapClass(ch) {
    if (ch === "#") return "dc-mm-wall";
    if (ch === "D") return state.doorOpen ? "dc-mm-door" : "dc-mm-wall";
    if (ch === "G") return state.goblinDefeated ? "dc-mm-floor" : "dc-mm-monster";
    if (ch === "L") return "dc-mm-lever";
    if (ch === "T") return "dc-mm-treasure";
    return "dc-mm-floor";
  }

  function redrawMinimap() {
    while (minimap.firstChild) minimap.removeChild(minimap.firstChild);
    var cell = 8;
    var cols = MAP[0].length,
      rows = MAP.length;
    var x0 = 400 - cols * cell - 8,
      y0 = 8;

    minimap.appendChild(el("rect", {
      x: x0 - 3, y: y0 - 3, width: cols * cell + 6, height: rows * cell + 6,
      class: "dc-mm-backdrop",
    }));

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var ch = MAP[y].charAt(x);
        minimap.appendChild(el("rect", {
          x: x0 + x * cell, y: y0 + y * cell, width: cell - 1, height: cell - 1,
          class: minimapClass(ch),
        }));
      }
    }

    var pcx = x0 + state.pos.x * cell + cell / 2;
    var pcy = y0 + state.pos.y * cell + cell / 2;
    var fwd = FORWARD[state.facing];
    var tip = [pcx + fwd.dx * 4, pcy + fwd.dy * 4];
    var back1 = [pcx - fwd.dx * 2 + fwd.dy * 2.5, pcy - fwd.dy * 2 + fwd.dx * 2.5];
    var back2 = [pcx - fwd.dx * 2 - fwd.dy * 2.5, pcy - fwd.dy * 2 - fwd.dx * 2.5];
    minimap.appendChild(el("polygon", {
      points: pointsAttr([tip, back1, back2]),
      class: "dc-mm-player",
    }));
  }

  function onEnter(tile) {
    if (tile === "L" && !state.doorOpen) {
      state.doorOpen = true;
      log("You pull the lever. Somewhere nearby, a door grinds open.");
    } else if (tile === "T" && !state.treasureFound) {
      state.treasureFound = true;
      log("Treasure! Demo complete — feel free to keep wandering.");
    }
  }

  function tryMove(dir) {
    if (state.encounterActive) return;
    var fwd = FORWARD[state.facing];
    var tx = state.pos.x + fwd.dx * dir,
      ty = state.pos.y + fwd.dy * dir;
    var tile = tileAt(tx, ty);

    if (tile === "#") {
      log("You bump into solid rock.");
      return;
    }
    if (tile === "D" && !state.doorOpen) {
      log("The door is shut fast.");
      return;
    }
    if (tile === "G" && !state.goblinDefeated) {
      startEncounter();
      return;
    }

    state.pos = { x: tx, y: ty };
    onEnter(tile);
    redraw();
  }

  function turn(dir) {
    if (state.encounterActive) return;
    state.facing = (state.facing + dir + 4) % 4;
    redraw();
  }

  function startEncounter() {
    state.encounterActive = true;
    encounterEl.classList.add("active");
    enemyHpEl.textContent = state.enemyHP;
    log("A goblin steps out, blocking the passage.");
  }

  function endEncounter() {
    state.encounterActive = false;
    encounterEl.classList.remove("active");
  }

  function respawn() {
    state.pos = { x: START.x, y: START.y };
    state.facing = START_FACING;
    state.playerHP = 3;
    state.enemyHP = 3;
  }

  function attack() {
    state.enemyHP -= 1;
    enemyHpEl.textContent = Math.max(state.enemyHP, 0);
    log("You strike the goblin. (" + Math.max(state.enemyHP, 0) + " HP left)");

    if (state.enemyHP <= 0) {
      state.goblinDefeated = true;
      log("The goblin collapses. The way to the treasure is clear.");
      endEncounter();
      redraw();
      return;
    }

    state.playerHP -= 1;
    log("The goblin claws back. (you: " + Math.max(state.playerHP, 0) + " HP left)");
    hpEl.textContent = Math.max(state.playerHP, 0);

    if (state.playerHP <= 0) {
      log("You black out, and wake back at the entrance...");
      respawn();
      endEncounter();
      redraw();
    }
  }

  document.getElementById("dc-btn-forward").addEventListener("click", function () { tryMove(1); });
  document.getElementById("dc-btn-back").addEventListener("click", function () { tryMove(-1); });
  document.getElementById("dc-btn-left").addEventListener("click", function () { turn(-1); });
  document.getElementById("dc-btn-right").addEventListener("click", function () { turn(1); });
  attackBtn.addEventListener("click", attack);

  // Keyboard input is scoped to the widget (it's focusable via tabindex)
  // rather than the whole document, so arrow keys still scroll the page
  // elsewhere and typing "w"/"d" in the wrong place doesn't move you.
  // Clicking anywhere in the widget focuses it explicitly: Safari doesn't
  // give focus to clicked buttons, so bubbling from a button isn't enough.
  var widget = document.querySelector(".dc-widget");
  if (!widget) return;

  widget.addEventListener("click", function () {
    if (!widget.contains(document.activeElement)) widget.focus();
  });

  widget.addEventListener("keydown", function (evt) {
    switch (evt.key) {
      case "ArrowUp":
      case "w":
      case "W":
        evt.preventDefault();
        tryMove(1);
        break;
      case "ArrowDown":
      case "s":
      case "S":
        evt.preventDefault();
        tryMove(-1);
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        evt.preventDefault();
        turn(-1);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        evt.preventDefault();
        turn(1);
        break;
      default:
        break;
    }
  });

  log("You step into the dungeon entrance.");
  redraw();
})();
