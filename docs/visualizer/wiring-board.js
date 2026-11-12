/* Board choice for the wiring views and the software flowchart: ESP32-S3 or Arduino UNO.
   Loads right after wiring-spec.js (the ESP32 spec) and swaps window.DispenserWiringSpec for the chosen board before any
   wiring code reads it. The UNO spec is derived from the ESP32 one and follows electronics-Arduino-UNO/scheduling-system/src/config.h.
   The board comes from ?board=uno|esp32 in the page URL, else from localStorage, else ESP32. ASSUMED / NOT_VALIDATED. */
(function () {
  'use strict';
  var ESP = window.DispenserWiringSpec;
  if (!ESP) return;
  var KEY = 'dispenser-board';
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  ESP.board_id = 'esp32';
  ESP.mcu_name = 'ESP32-S3';
  ESP.pin_prefix = 'GPIO';
  ESP.in_place = true;
  ESP.reserved_text = 'No signal uses a strapping, USB, flash/PSRAM, JTAG, UART0 or on-board LED pin';
  ESP.hud_foot = 'Red +5 V · grey GND · hall OUT also has a 10 kΩ pull-up to 3V3';

  var UNO = clone(ESP);
  UNO.board_id = 'uno';
  UNO.mcu_name = 'Arduino UNO';
  UNO.pin_prefix = 'D';
  UNO.in_place = false;
  UNO.board = 'Arduino UNO (ATmega328P); D-numbers are the silkscreen digital pin numbers';
  UNO.notice = 'Concept wiring of the Arduino UNO firmware build: rotation and schedule only, no servos and no barcode reader. Pins follow config.h. Nothing was built, measured or powered; part values are assumptions.';
  UNO.reserved_text = 'No signal uses D0 or D1 (the USB serial pins)';
  UNO.hud_foot = 'Red +5 V · grey GND · hall OUT uses the UNO internal pull-up';
  UNO.reserved_gpio = [{ gpio: [0, 1], why: 'USB serial (D0 RX / D1 TX), used by the host link' }];
  UNO.planned_gpio = [];
  UNO.group_parents = UNO.group_parents.filter(function (p) { return p.id !== 'scanner'; });
  UNO.groups = UNO.groups.filter(function (g) { return g.id === 'rotation' || g.id === 'power'; });
  UNO.groups.forEach(function (g) { if (g.id === 'power') g.note = 'USB supply, +5 V and GND'; });
  UNO.components = UNO.components.filter(function (c) { return ['usbc', 'hall', 'esp32', 'uln2003', 'stepper'].indexOf(c.id) >= 0; });
  UNO.components.forEach(function (c) {
    if (c.id === 'usbc') c.label = 'USB 5 V supply';
    if (c.id === 'hall') c.extra = ['internal pull-up (INPUT_PULLUP)', 'C1 100 nF across VCC / GND'];
    if (c.id === 'esp32') {
      c.label = 'Arduino UNO controller';
      c.pins = [
        { id: '5V', name: '5V', side: 'l', type: 'power', net: '5V' },
        { id: 'GND', name: 'GND', side: 'l', type: 'gnd', net: 'GND' },
        { id: 'D2', name: 'D2', side: 'l', type: 'signal', gpio: 2 },
        { id: 'D8', name: 'D8', side: 'r', type: 'signal', gpio: 8 },
        { id: 'D9', name: 'D9', side: 'r', type: 'signal', gpio: 9 },
        { id: 'D10', name: 'D10', side: 'r', type: 'signal', gpio: 10 },
        { id: 'D11', name: 'D11', side: 'r', type: 'signal', gpio: 11 }
      ];
    }
  });
  UNO.signals = [8, 9, 10, 11].map(function (n, i) {
    return { id: 'STEP_IN' + (i + 1), group: 'rotation', fn: 'coil' + (i + 1), gpio: n, from: 'esp32.D' + n, to: 'uln2003.IN' + (i + 1), role: 'stepper coil ' + 'ABCD'.charAt(i), dir: 'out' };
  }).concat([{ id: 'HALL_HOME', group: 'rotation', fn: 'hall', gpio: 2, from: 'hall.OUT', to: 'esp32.D2', role: 'home hall sensor, LOW at home', dir: 'in' }]);
  UNO.loads_ma = { esp32: 50, stepper_per_coil: 100, hall: 5, budget: 500, budget_note: 'assumes a 5 V / 500 mA USB 2.0 port' };
  UNO.power = [
    { net: '5V', label: '+5 V', source: 'usbc.VBUS', note: 'the UNO is powered over its USB port; the ULN2003, stepper and hall sensor run from its 5V pin' },
    { net: 'GND', label: 'GND', source: 'usbc.GND', note: 'single common ground' }
  ];

  var specs = { esp32: ESP, uno: UNO }, board = 'esp32';
  var fromUrl = /[?&]board=(uno|esp32)\b/.exec(window.location.search);
  if (fromUrl) board = fromUrl[1];
  else { try { if (window.localStorage.getItem(KEY) === 'uno') board = 'uno'; } catch (e) { /* storage blocked: stay on ESP32 */ } }
  window.DispenserWiringSpecs = specs;
  window.DispenserWiringBoard = board;
  window.DispenserWiringSpec = specs[board];
  window.DispenserBoardKey = KEY;
}());
