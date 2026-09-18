(function () {
  "use strict";

  // Same pattern as the test-cricket widget: a scrubber-driven stage index
  // rather than a one-way elapsed-time clock. Feature.scrubber owns the
  // chart, strip, status, log, autoplay and range input; this file is the
  // race data plus the text and scale that describe it.
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

  var GAP_MAX = 150; // seconds, top of the chart
  var GAP_MIN = -60; // seconds, bottom of the chart
  var CHART_Y_TOP = 20;
  var CHART_Y_BOTTOM = 170;

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

  function stageName(i) {
    return "Stage " + (i + 1);
  }

  Feature.scrubber({
    prefix: "tdf",
    items: STAGES,
    stepMs: 1600,
    value: function (s) { return s.gap; },
    yAt: yAt,
    baselineY: yAt(0),
    markers: [
      { index: 0, label: "Wk 1" },
      { index: 7, label: "Wk 2" },
      { index: 14, label: "Wk 3" },
    ],
    stripClass: function (s) { return "tdf-strip-cell " + s.type; },
    stripTitle: function (s, i) { return stageName(i) + " — " + TYPE_LABEL[s.type]; },
    label: function (s, i) { return stageName(i); },
    statusLines: function (s, i) {
      return [
        { text: stageName(i) + " of " + STAGES.length + " — ", strong: TYPE_LABEL[s.type] },
        { text: "General classification: ", strong: gapPhrase(s.gap) },
      ];
    },
    logLine: function (s, i) { return stageName(i) + " — " + s.log; },
  });
})();
