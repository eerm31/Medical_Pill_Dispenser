// rotation.h
// Controls the rotation of the drum. It finds the home position with the Hall sensor
// and then turns the drum to one of the four colour stations.
// Based on docs/visualizer/rotation-controller.js (not tested on real hardware yet).
//
// How the motion works: the code is "non-blocking". Call update() over and over (for example
// in loop()). Each call makes at most one half-step, so the rest of the program keeps running.

#ifndef ROTATION_H
#define ROTATION_H

#include <stdint.h>
#include "colors.h"

// ---------- hardware interfaces ----------
// These are abstract classes. The real ESP32 code and the fake drum in the tests both fill them in.

class StepperPort {
public:
    virtual ~StepperPort() {}
    virtual void step(int dir) = 0;   // one half-step. dir = +1 is counter-clockwise, -1 is clockwise
    virtual void release() = 0;       // switch all the coils off so nothing gets hot
};

class HomeSensor {
public:
    virtual ~HomeSensor() {}
    virtual bool active() = 0;        // true while the magnet is over the sensor
};

// ---------- states ----------
enum RotState {
    ROT_UNHOMED,   // position not known yet
    ROT_HOMING,    // looking for the Hall sensor
    ROT_IDLE,      // homed and standing still
    ROT_MOVING,    // turning to a station
    ROT_FAULT      // something went wrong (see RotFault)
};

enum RotFault {
    FAULT_NONE,
    FAULT_HOME_NOT_FOUND   // turned 125% of a turn and never saw the magnet
};

// ---------- settings ----------
struct RotationConfig {
    int stepsPerRev;               // half-steps for one full turn (28BYJ-48: 2048 x 2 = 4096)
    float homeOffsetDeg;           // degrees from the Hall edge to the RED station
    float overshootDeg;            // clockwise moves go this far past the target and come back
    bool unidirectional;           // always finish moving counter-clockwise (takes out gear lash)
    int searchLimitPercent;        // give up the home search after this much of a turn
    uint32_t startIntervalUs;      // time between steps at the start (slow)
    uint32_t minIntervalUs;        // time between steps at full speed
    int rampSteps;                 // how many steps the speed-up takes
    bool releaseWhenIdle;          // coils off when the drum stands still

    RotationConfig();              // fills in the default values
};

// ---------- the controller ----------
class Rotation {
private:
    // the jobs that update() can be busy with
    enum Job {
        JOB_NONE,
        JOB_LEAVE_MAGNET,   // the drum started on the magnet, so first get off it
        JOB_SEARCH,         // turn until the sensor sees the magnet
        JOB_OFFSET,         // move from the sensor edge to the RED station
        JOB_INDEX           // move to a colour station
    };

    StepperPort* stepper;
    HomeSensor* hall;
    RotationConfig cfg;

    bool (*interlock)(void*);   // returns false when turning is not allowed
    void* interlockContext;

    RotState state;
    RotFault fault;
    Job job;
    int pos;                // position in steps counted from RED, -1 when unknown
    int seg[2];             // the (at most two) pieces of the current move
    int segCount;
    int segIndex;
    int remaining;          // steps left in the current piece
    int searched;           // steps taken during the home search
    int stepsDone;          // steps taken in the current piece (used for the speed ramp)
    int dir;                // +1 or -1
    uint32_t nextUs;        // when the next step is due
    bool timing;            // false until the first update() of a job

    bool interlockAllows();
    void beginSegment();
    void finishHome();
    void finishIndex();
    uint32_t intervalUs();

public:
    Rotation(StepperPort* stepperPtr, HomeSensor* hallPtr, RotationConfig config = RotationConfig());

    // Stops the drum from turning while the dispenser is busy (the callback returns false).
    void setInterlock(bool (*allowed)(void*), void* context);

    bool requestHome();          // false if busy or the interlock says no
    bool requestIndex(Color c);  // false if not homed, busy, in a fault or the interlock says no
    void clearFault();           // after a fault the drum has to be homed again
    void update(uint32_t nowUs); // call this as often as possible

    RotState getState() { return state; }
    RotFault getFault() { return fault; }
    bool isBusy() { return state == ROT_HOMING || state == ROT_MOVING; }
    int getPosition() { return pos; }
    int getStepsPerRev() { return cfg.stepsPerRev; }
    Color atStation();           // NO_COLOR while moving, not homed or between stations

    // Step position of a colour station, counted from RED.
    static int stationSteps(Color c, int stepsPerRev);

    // Plans a move on a circle of n steps. Writes at most two pieces into seg[] and returns how many.
    // With unidirectional = true a clockwise move is split into "go past the target, then come back counter-clockwise".
    static int planIndex(int from, int to, int n, int overshoot, bool unidirectional, int seg[2]);
};

#endif
