// config.h
// Pins and constants for the ESP32-S3 (not tested on a real board yet).
// The GPIO numbers are the silkscreen numbers of an ESP32-S3-DevKitC-1 style board and match
// docs/visualizer/wiring-spec.js:
//   STEP_IN1..4 = GPIO 4..7 (ULN2003 IN1..IN4), HALL_HOME = GPIO 1 (A3144, LOW at the magnet)
// Check every pin against your own board before building!

#ifndef CONFIG_H
#define CONFIG_H

#define PIN_STEP_IN1 4
#define PIN_STEP_IN2 5
#define PIN_STEP_IN3 6
#define PIN_STEP_IN4 7
#define PIN_HALL_HOME 1   // open-collector sensor, needs an external 10k pull-up to 3V3

// The 28BYJ-48 needs 2048 full steps for one turn, so 4096 half-steps.
#define STEPS_PER_REV 4096

// TODO: a battery-backed RTC (I2C) is needed for real use. Its pins are not chosen yet
// (GPIO 8, 9 and 10 are planned for Feature 006).

#endif
