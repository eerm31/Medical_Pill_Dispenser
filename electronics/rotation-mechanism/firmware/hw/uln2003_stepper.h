// ULN2003 + 28BYJ-48 half-step driver and the A3144 home sensor. Arduino only: this file is not built by the host tests.
#pragma once
#include <Arduino.h>

#include "config.h"
#include "core/rotation.h"

namespace dispenser {

class Uln2003Stepper : public StepperPort {
 public:
  void begin() {
    const uint8_t pins[4] = {PIN_STEP_IN1, PIN_STEP_IN2, PIN_STEP_IN3, PIN_STEP_IN4};
    for (uint8_t i = 0; i < 4; i++) {
      pins_[i] = pins[i];
      pinMode(pins_[i], OUTPUT);
      digitalWrite(pins_[i], LOW);
    }
  }

  // Eight-phase half-step sequence; dir +1 walks it forward (counter-clockwise on the drum, as wired in the viewer).
  void step(int dir) override {
    static const uint8_t seq[8] = {0b0001, 0b0011, 0b0010, 0b0110, 0b0100, 0b1100, 0b1000, 0b1001};
    phase_ = (phase_ + (dir > 0 ? 1 : 7)) & 7;
    for (uint8_t i = 0; i < 4; i++) digitalWrite(pins_[i], (seq[phase_] >> i) & 1);
  }

  void release() override {
    for (uint8_t i = 0; i < 4; i++) digitalWrite(pins_[i], LOW);
  }

 private:
  uint8_t pins_[4] = {0, 0, 0, 0};
  uint8_t phase_ = 0;
};

class Hall : public HomeSensor {
 public:
  void begin() { pinMode(PIN_HALL_HOME, INPUT); }  // the pull-up is external
  bool active() override { return digitalRead(PIN_HALL_HOME) == LOW; }
};

}  // namespace dispenser
