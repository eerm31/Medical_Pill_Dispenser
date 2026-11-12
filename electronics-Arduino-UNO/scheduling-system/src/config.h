// config.h
// Pins and constants for the Arduino Uno (not tested on a real board yet).
// CHECK THESE AGAINST YOUR WIRING and change the numbers if your wires go to other pins.
//   ULN2003 IN1..IN4 -> Uno pins 8, 9, 10, 11
//   A3144 Hall sensor OUT -> Uno pin 2 (the Uno's own pull-up is switched on in the code)
// Pins 0 and 1 are the USB serial port, do not use them.

#ifndef CONFIG_H
#define CONFIG_H

#define PIN_STEP_IN1 8
#define PIN_STEP_IN2 9
#define PIN_STEP_IN3 10
#define PIN_STEP_IN4 11
#define PIN_HALL_HOME 2

// The 28BYJ-48 needs 2048 full steps for one turn, so 4096 half-steps.
#define STEPS_PER_REV 4096

#endif
