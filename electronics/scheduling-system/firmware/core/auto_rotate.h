// auto_rotate.h
// Connects the schedule to the drum. When a dose becomes due, the drum turns to its colour by itself
// ("pre-positioning"). The dose is dispensed only after the user taps TAKE.

#ifndef AUTO_ROTATE_H
#define AUTO_ROTATE_H

#include "core/rotation.h"
#include "schedule.h"

// The dispensing mechanism (pin, blades, tongue) and the verification are not part of this folder.
// They plug in here. main.cpp uses a fake one that always says VERIFIED after 3 seconds.
class Dispenser {
public:
    virtual ~Dispenser() {}
    virtual bool start(Color c, int pills) = 0;   // false if the mechanism says no
    virtual bool finished(Verdict* verdict) = 0;  // true when the dispense is over, the verdict is written to *verdict
};

enum AutoState {
    AUTO_START,         // nothing started yet
    AUTO_HOMING,        // looking for the home position
    AUTO_IDLE,          // homed, waiting for a dose
    AUTO_POSITIONING,   // the drum is turning to the due colour
    AUTO_READY,         // the drum is at the colour, waiting for the tap
    AUTO_DISPENSING,    // the pill is being dispensed
    AUTO_PARKING,       // the drum goes back to the park station
    AUTO_FAULT          // something went wrong
};

struct AutoConfig {
    bool prePosition;   // turn to the due colour as soon as the dose is due
    bool parkAfter;     // go back to the park station after each dose
    Color parkColor;    // the park station

    AutoConfig();       // default values
};

class AutoRotate {
private:
    Scheduler* schedule;
    Rotation* rotation;
    Dispenser* dispenser;
    AutoConfig cfg;

    AutoState state;
    uint8_t takingId;    // the dose that is being taken
    Color takeColor;
    int takePills;       // how many pills the dose has
    bool takeQueued;     // true when the tap came before the drum arrived
    const char* message; // the last problem, "" if none

    void startDispense();
    void failTake(const char* why);
    void goIdle();
    static bool interlockCheck(void* self);

public:
    AutoRotate(Scheduler* schedulePtr, Rotation* rotationPtr, Dispenser* dispenserPtr,
               AutoConfig config = AutoConfig());

    void begin();                  // starts the home search
    void update(uint32_t nowUs);   // call this in every loop() pass
    bool takePressed();            // the user tapped TAKE. Returns true if it was accepted
    void recover();                // after a fault: clear it and home again

    AutoState getState() { return state; }
    const char* stateName();
    const char* getMessage() { return message; }
};

#endif
