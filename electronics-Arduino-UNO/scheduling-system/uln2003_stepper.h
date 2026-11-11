// uln2003_stepper.h
// Drivers for the real hardware: the 28BYJ-48 stepper with a ULN2003 board, and the A3144 Hall sensor.
// This file needs the Arduino library, so the laptop tests do not build it.

#ifndef ULN2003_STEPPER_H
#define ULN2003_STEPPER_H

#include <Arduino.h>
#include "config.h"
#include "rotation.h"

class Uln2003Stepper : public StepperPort {
private:
    int pins[4];   // the four pins that go to IN1..IN4
    int phase;     // which of the 8 half-step phases we are in

public:
    Uln2003Stepper() {
        pins[0] = PIN_STEP_IN1;
        pins[1] = PIN_STEP_IN2;
        pins[2] = PIN_STEP_IN3;
        pins[3] = PIN_STEP_IN4;
        phase = 0;
    }

    // call this once in setup()
    void begin() {
        for (int i = 0; i < 4; i++) {
            pinMode(pins[i], OUTPUT);
            digitalWrite(pins[i], LOW);
        }
    }

    void step(int dir) {
        // which coils are on in each of the 8 half-step phases
        static const int phases[8][4] = {
            {1, 0, 0, 0},
            {1, 1, 0, 0},
            {0, 1, 0, 0},
            {0, 1, 1, 0},
            {0, 0, 1, 0},
            {0, 0, 1, 1},
            {0, 0, 0, 1},
            {1, 0, 0, 1}
        };

        if (dir > 0) {
            phase = (phase + 1) % 8;
        } else {
            phase = (phase + 7) % 8;   // one step back
        }

        for (int i = 0; i < 4; i++) {
            digitalWrite(pins[i], phases[phase][i]);
        }
    }

    void release() {
        for (int i = 0; i < 4; i++) {
            digitalWrite(pins[i], LOW);
        }
    }
};

class Hall : public HomeSensor {
public:
    // call this once in setup()
    void begin() {
        pinMode(PIN_HALL_HOME, INPUT_PULLUP);   // the Uno has its own pull-up, no resistor needed
    }

    bool active() {
        return digitalRead(PIN_HALL_HOME) == LOW;   // the sensor pulls the pin LOW at the magnet
    }
};

#endif
