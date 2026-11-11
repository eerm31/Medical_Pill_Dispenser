// fake_drive.h
// A fake drum for the tests on the laptop. It counts the half-steps and switches the "Hall sensor"
// on while the magnet is over the sensor. The magnet starts at step "edge" and is "window" steps wide.

#ifndef FAKE_DRIVE_H
#define FAKE_DRIVE_H

#include <stdint.h>
#include "rotation.h"

class FakeDrive : public StepperPort, public HomeSensor {
public:
    int n;            // steps in one full turn
    int phys;         // where the drum really is (in steps)
    int edge;         // where the magnet starts
    int window;       // how wide the magnet is, in steps
    int lastDir;      // direction of the last step
    long total;       // how many steps were made in total
    bool hallDead;    // set this to true to simulate a broken sensor
    bool released;    // true when the coils are off

    FakeDrive(int stepsPerRev, int start, int magnetEdge, int magnetWindow) {
        n = stepsPerRev;
        phys = start;
        edge = magnetEdge;
        window = magnetWindow;
        lastDir = 0;
        total = 0;
        hallDead = false;
        released = false;
    }

    void step(int dir) {
        phys = ((phys + dir) % n + n) % n;
        lastDir = dir;
        total++;
        released = false;
    }

    void release() {
        released = true;
    }

    bool active() {
        if (hallDead) {
            return false;
        }
        int distance = ((phys - edge) % n + n) % n;
        return distance < window;
    }

    // where the RED station really is, if it is offsetSteps after the magnet edge
    int redPosition(int offsetSteps) {
        return (edge + offsetSteps) % n;
    }
};

// The time in microseconds. The tests move it forward by hand.
static uint32_t clockUs = 0;

#endif
