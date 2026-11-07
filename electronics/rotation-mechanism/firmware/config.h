// Pin plan and constants for the ESP32-S3 (ASSUMED / NOT_VALIDATED).
// GPIO numbers are the silkscreen numbers of an ESP32-S3-DevKitC-1 style module and match docs/visualizer/wiring-spec.js:
// STEP_IN1..4 = GPIO 4..7 (ULN2003 IN1..IN4), HALL_HOME = GPIO 1 (A3144, LOW at the magnet).
// Check every pin against your module's reserved pins before any build.
#pragma once

#define PIN_STEP_IN1 4
#define PIN_STEP_IN2 5
#define PIN_STEP_IN3 6
#define PIN_STEP_IN4 7
#define PIN_HALL_HOME 1  // open-collector output with an external 10 k pull-up to 3V3

// 28BYJ-48 geared output: 2048 full steps per turn, 4096 half-steps.
#define STEPS_PER_REV 4096

// A battery-backed RTC (I2C) is needed for real use. Its pins are not assigned here: GPIO 8, 9 and 10 are planned for Feature 006.
// Until then the clock is set from the serial console ("time HH:MM") and counted with millis().
