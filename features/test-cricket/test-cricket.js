(function () {
  "use strict";

  // Unlike Witron/Met Office/NMR/Ozone (a single elapsed-time clock that
  // only ever moves forward), this widget is driven by a session index
  // that a scrubber can move in either direction. Feature.scrubber owns
  // the chart, strip, status, log, autoplay and range input; this file
  // is the match data plus the text and scale that describe it.
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

  var CHART_BASELINE_Y = 95;
  var MOMENTUM_SCALE = 1.5; // 50 momentum points -> 75px, keeps ±50 within the 20..170 box

  function momentumPhrase(momentum) {
    if (momentum === 0) return "Even";
    var team = momentum > 0 ? "Home" : "Away";
    return team + " ahead (" + (momentum > 0 ? "+" : "") + momentum + ")";
  }

  function sessionName(s) {
    return "Day " + s.day + ", " + s.session;
  }

  // One gridline per day, at its Morning session.
  var dayMarkers = [];
  for (var i = 0; i < SESSIONS.length; i++) {
    if (SESSIONS[i].session === "Morning") {
      dayMarkers.push({ index: i, label: "D" + SESSIONS[i].day });
    }
  }

  Feature.scrubber({
    prefix: "tc",
    items: SESSIONS,
    stepMs: 2200,
    value: function (s) { return s.momentum; },
    yAt: function (momentum) { return CHART_BASELINE_Y - momentum * MOMENTUM_SCALE; },
    baselineY: CHART_BASELINE_Y,
    markers: dayMarkers,
    stripClass: function (s) { return "tc-strip-cell " + s.battingTeam; },
    stripTitle: function (s) {
      return sessionName(s) + " — " + (s.battingTeam === "home" ? "Home" : "Away") + " batting";
    },
    label: sessionName,
    statusLines: function (s) {
      return [
        { strong: s.innings },
        { text: "Score: ", strong: s.score },
        { text: "Momentum: ", strong: momentumPhrase(s.momentum) },
      ];
    },
    logLine: function (s) { return sessionName(s) + " — " + s.log; },
  });
})();
