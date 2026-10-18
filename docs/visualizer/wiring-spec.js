window.DispenserWiringSpec = {
  "status": "ASSUMED / NOT_VALIDATED",
  "title": "Electronics wiring (concept)",
  "board": "ESP32-S3-DevKitC-1 style module; GPIO numbers are the silkscreen numbers",
  "notice": "Concept wiring for the parts drawn so far. Nothing was built, measured or powered; part values are assumptions.",
  "pwm": {
    "period_us": 20000,
    "min_us": 500,
    "max_us": 2500,
    "range_deg": 180,
    "center_deg": 90
  },
  "stepper": {
    "half_steps_per_rev": 4096,
    "sequence": [[1, 0, 0, 0], [1, 1, 0, 0], [0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 0], [0, 0, 1, 1], [0, 0, 0, 1], [1, 0, 0, 1]],
    "idle": "all four inputs low when the drum is not moving"
  },
  "hall": {
    "active_low": true,
    "home_window_rad": 0.07
  },
  "loads_ma": {
    "esp32": 90,
    "stepper_per_coil": 100,
    "servo_idle": 10,
    "servo_moving": 150,
    "reader_idle": 40,
    "reader_scan": 140,
    "hall": 5,
    "budget": 1500,
    "budget_note": "assumes a 5 V / 1.5 A USB-C supply"
  },
  "reserved_gpio": [
    { "gpio": [0, 3, 45, 46], "why": "boot / strapping pins" },
    { "gpio": [19, 20], "why": "native USB D- / D+" },
    { "gpio": [26, 27, 28, 29, 30, 31, 32], "why": "flash / PSRAM SPI bus" },
    { "gpio": [33, 34, 35, 36, 37], "why": "octal PSRAM on N8R8 / N16R8 modules" },
    { "gpio": [38, 48], "why": "on-board RGB LED (board revision dependent)" },
    { "gpio": [39, 40, 41, 42], "why": "JTAG" },
    { "gpio": [43, 44], "why": "UART0 console" }
  ],
  "planned_gpio": [
    { "gpio": 8, "why": "Feature 006 (parked): load-cell amplifier data" },
    { "gpio": 9, "why": "Feature 006 (parked): load-cell amplifier clock" },
    { "gpio": 10, "why": "Feature 006 (parked): lift-pad servo signal" }
  ],
  "group_parents": [
    { "id": "dispensing", "label": "Subsystem 1 · Dispensing mechanism" },
    { "id": "scanner", "label": "Subsystem 2 · Barcode scanner" },
    { "id": "shared", "label": "Shared" }
  ],
  "groups": [
    { "id": "rotation", "parent": "dispensing", "label": "Rotation mechanism", "note": "28BYJ-48 stepper, ULN2003, hall sensor" },
    { "id": "blades", "parent": "dispensing", "label": "Blade pull", "note": "pin-lever servo S1" },
    { "id": "tongue", "parent": "dispensing", "label": "Tongue gate", "note": "tongue-lever servo S2" },
    { "id": "scanner", "parent": "scanner", "label": "Barcode reader", "note": "UART link to the reader" },
    { "id": "power", "parent": "shared", "label": "Power supply", "note": "USB-C inlet, +5 V and GND" }
  ],
  "components": [
    {
      "id": "usbc", "group": "power", "label": "USB-C 5 V inlet", "viewer_label": "USB-C 5 V inlet", "kind": "supply", "box": [30, 30, 210],
      "pins": [
        { "id": "VBUS", "name": "VBUS", "side": "r", "type": "power", "net": "5V" },
        { "id": "CC1", "name": "CC1", "side": "r", "type": "passive", "note": "5.1 kΩ to GND" },
        { "id": "CC2", "name": "CC2", "side": "r", "type": "passive", "note": "5.1 kΩ to GND" },
        { "id": "GND", "name": "GND", "side": "r", "type": "gnd", "net": "GND" }
      ]
    },
    {
      "id": "hall", "group": "rotation", "label": "Hall sensor A3144", "viewer_label": "Hall sensor A3144", "kind": "hall", "box": [30, 230, 210],
      "extra": ["R1 10 kΩ pull-up OUT to 3V3", "C1 100 nF across VCC / GND"],
      "pins": [
        { "id": "VCC", "name": "VCC", "side": "r", "type": "power", "net": "5V" },
        { "id": "OUT", "name": "OUT (open collector)", "side": "r", "type": "signal" },
        { "id": "GND", "name": "GND", "side": "r", "type": "gnd", "net": "GND" }
      ]
    },
    {
      "id": "reader", "group": "scanner", "label": "Barcode reader (external)", "viewer_label": "Barcode reader", "kind": "reader", "box": [30, 450, 210], "external": true,
      "extra": ["UART, 3.3 V TTL assumed", "cable and connector not designed"],
      "pins": [
        { "id": "VCC", "name": "VCC", "side": "r", "type": "power", "net": "5V" },
        { "id": "GND", "name": "GND", "side": "r", "type": "gnd", "net": "GND" },
        { "id": "RXD", "name": "RXD", "side": "r", "type": "signal" },
        { "id": "TXD", "name": "TXD", "side": "r", "type": "signal" }
      ]
    },
    {
      "id": "esp32", "group": "core", "label": "ESP32-S3 controller", "viewer_label": "ESP32 controller", "kind": "mcu", "box": [450, 30, 220],
      "pins": [
        { "id": "5V", "name": "5V", "side": "l", "type": "power", "net": "5V" },
        { "id": "3V3", "name": "3V3", "side": "l", "type": "power", "net": "3V3" },
        { "id": "GND", "name": "GND", "side": "l", "type": "gnd", "net": "GND" },
        { "id": "G1", "name": "GPIO1", "side": "l", "type": "signal", "gpio": 1 },
        { "id": "G17", "name": "GPIO17 (TX1)", "side": "l", "type": "signal", "gpio": 17 },
        { "id": "G18", "name": "GPIO18 (RX1)", "side": "l", "type": "signal", "gpio": 18 },
        { "id": "G4", "name": "GPIO4", "side": "r", "type": "signal", "gpio": 4 },
        { "id": "G5", "name": "GPIO5", "side": "r", "type": "signal", "gpio": 5 },
        { "id": "G6", "name": "GPIO6", "side": "r", "type": "signal", "gpio": 6 },
        { "id": "G7", "name": "GPIO7", "side": "r", "type": "signal", "gpio": 7 },
        { "id": "G15", "name": "GPIO15", "side": "r", "type": "signal", "gpio": 15 },
        { "id": "G16", "name": "GPIO16", "side": "r", "type": "signal", "gpio": 16 }
      ]
    },
    {
      "id": "uln2003", "group": "rotation", "label": "ULN2003 driver board", "viewer_label": "ULN2003 driver board", "kind": "driver", "box": [880, 30, 210],
      "pins": [
        { "id": "IN1", "name": "IN1", "side": "l", "type": "signal" },
        { "id": "IN2", "name": "IN2", "side": "l", "type": "signal" },
        { "id": "IN3", "name": "IN3", "side": "l", "type": "signal" },
        { "id": "IN4", "name": "IN4", "side": "l", "type": "signal" },
        { "id": "VCC", "name": "+5V", "side": "l", "type": "power", "net": "5V" },
        { "id": "GND", "name": "GND", "side": "l", "type": "gnd", "net": "GND" },
        { "id": "O1", "name": "OUT1 blue", "side": "r", "type": "signal" },
        { "id": "O2", "name": "OUT2 pink", "side": "r", "type": "signal" },
        { "id": "O3", "name": "OUT3 yellow", "side": "r", "type": "signal" },
        { "id": "O4", "name": "OUT4 orange", "side": "r", "type": "signal" },
        { "id": "COM", "name": "+5V red", "side": "r", "type": "power", "net": "5V" }
      ]
    },
    {
      "id": "stepper", "group": "rotation", "label": "28BYJ-48 stepper", "viewer_label": "28BYJ-48 stepper", "kind": "stepper", "box": [1140, 30, 170],
      "pins": [
        { "id": "BLUE", "name": "blue", "side": "l", "type": "signal" },
        { "id": "PINK", "name": "pink", "side": "l", "type": "signal" },
        { "id": "YELLOW", "name": "yellow", "side": "l", "type": "signal" },
        { "id": "ORANGE", "name": "orange", "side": "l", "type": "signal" },
        { "id": "RED", "name": "red (+5V)", "side": "l", "type": "power", "net": "5V" }
      ]
    },
    {
      "id": "s1", "group": "blades", "label": "Micro servo S1 (pin lever)", "viewer_label": "Micro servo S1 (pin)", "kind": "servo", "box": [880, 270, 210],
      "pins": [
        { "id": "SIG", "name": "SIG (orange)", "side": "l", "type": "signal" },
        { "id": "VCC", "name": "V+ (red)", "side": "l", "type": "power", "net": "5V" },
        { "id": "GND", "name": "GND (brown)", "side": "l", "type": "gnd", "net": "GND" }
      ]
    },
    {
      "id": "s2", "group": "tongue", "label": "Micro servo S2 (tongue lever)", "viewer_label": "Micro servo S2 (tongue)", "kind": "servo", "box": [880, 490, 210],
      "pins": [
        { "id": "SIG", "name": "SIG (orange)", "side": "l", "type": "signal" },
        { "id": "VCC", "name": "V+ (red)", "side": "l", "type": "power", "net": "5V" },
        { "id": "GND", "name": "GND (brown)", "side": "l", "type": "gnd", "net": "GND" }
      ]
    }
  ],
  "signals": [
    { "id": "STEP_IN1", "group": "rotation", "fn": "coil1", "gpio": 4, "from": "esp32.G4", "to": "uln2003.IN1", "role": "stepper coil A", "dir": "out" },
    { "id": "STEP_IN2", "group": "rotation", "fn": "coil2", "gpio": 5, "from": "esp32.G5", "to": "uln2003.IN2", "role": "stepper coil B", "dir": "out" },
    { "id": "STEP_IN3", "group": "rotation", "fn": "coil3", "gpio": 6, "from": "esp32.G6", "to": "uln2003.IN3", "role": "stepper coil C", "dir": "out" },
    { "id": "STEP_IN4", "group": "rotation", "fn": "coil4", "gpio": 7, "from": "esp32.G7", "to": "uln2003.IN4", "role": "stepper coil D", "dir": "out" },
    { "id": "S1_PWM", "group": "blades", "fn": "servo1", "gpio": 15, "from": "esp32.G15", "to": "s1.SIG", "role": "pin-lever servo PWM (LEDC ch 0)", "dir": "out" },
    { "id": "S2_PWM", "group": "tongue", "fn": "servo2", "gpio": 16, "from": "esp32.G16", "to": "s2.SIG", "role": "tongue-lever servo PWM (LEDC ch 1)", "dir": "out" },
    { "id": "HALL_HOME", "group": "rotation", "fn": "hall", "gpio": 1, "from": "hall.OUT", "to": "esp32.G1", "role": "home hall sensor, LOW at home", "dir": "in" },
    { "id": "RDR_TX", "group": "scanner", "fn": "uart_tx", "gpio": 17, "from": "esp32.G17", "to": "reader.RXD", "role": "UART1 TX to reader", "dir": "out" },
    { "id": "RDR_RX", "group": "scanner", "fn": "uart_rx", "gpio": 18, "from": "reader.TXD", "to": "esp32.G18", "role": "UART1 RX from reader", "dir": "in" }
  ],
  "links": [
    { "id": "M_BLUE", "group": "rotation", "fn": "coil1", "color": "#438de8", "from": "uln2003.O1", "to": "stepper.BLUE", "role": "motor plug" },
    { "id": "M_PINK", "group": "rotation", "fn": "coil2", "color": "#f08cc0", "from": "uln2003.O2", "to": "stepper.PINK", "role": "motor plug" },
    { "id": "M_YELLOW", "group": "rotation", "fn": "coil3", "color": "#f2d14a", "from": "uln2003.O3", "to": "stepper.YELLOW", "role": "motor plug" },
    { "id": "M_ORANGE", "group": "rotation", "fn": "coil4", "color": "#ef963f", "from": "uln2003.O4", "to": "stepper.ORANGE", "role": "motor plug" },
    { "id": "M_COM", "group": "rotation", "fn": "common", "color": "#ef555c", "from": "uln2003.COM", "to": "stepper.RED", "role": "motor plug common +5V" }
  ],
  "power": [
    { "net": "5V", "label": "+5 V", "source": "usbc.VBUS", "note": "USB-C VBUS feeds the ESP32 5V pin; the board must not also be fed from its own USB port" },
    { "net": "3V3", "label": "3V3", "source": "esp32.3V3", "note": "from the ESP32 board regulator; only the hall pull-up uses it" },
    { "net": "GND", "label": "GND", "source": "usbc.GND", "note": "single common ground; a 470 µF bulk capacitor on the 5 V rail near the servos is assumed" }
  ]
};
