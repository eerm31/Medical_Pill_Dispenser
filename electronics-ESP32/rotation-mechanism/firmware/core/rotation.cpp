// rotation.cpp

#include <stddef.h>
#include "rotation.h"

// ---------- default settings ----------
RotationConfig::RotationConfig() {
    stepsPerRev = 4096;
    homeOffsetDeg = 3.66f;
    overshootDeg = 3.0f;
    unidirectional = true;
    searchLimitPercent = 125;
    startIntervalUs = 4000;
    minIntervalUs = 1500;
    rampSteps = 120;
    releaseWhenIdle = true;
}

// % can give a negative result in C++, this one never does.
static int positiveMod(int a, int n) {
    int r = a % n;
    if (r < 0) {
        r = r + n;
    }
    return r;
}

// ---------- constructor ----------
Rotation::Rotation(StepperPort* stepperPtr, HomeSensor* hallPtr, RotationConfig config) {
    stepper = stepperPtr;
    hall = hallPtr;
    cfg = config;
    interlock = NULL;
    interlockContext = NULL;
    state = ROT_UNHOMED;
    fault = FAULT_NONE;
    job = JOB_NONE;
    pos = -1;
    seg[0] = 0;
    seg[1] = 0;
    segCount = 0;
    segIndex = 0;
    remaining = 0;
    searched = 0;
    stepsDone = 0;
    dir = 1;
    nextUs = 0;
    timing = false;
}

void Rotation::setInterlock(bool (*allowed)(void*), void* context) {
    interlock = allowed;
    interlockContext = context;
}

bool Rotation::interlockAllows() {
    if (interlock == NULL) {
        return true;   // no interlock set
    }
    return interlock(interlockContext);
}

// ---------- stations and planning ----------
int Rotation::stationSteps(Color c, int stepsPerRev) {
    if (c >= COLOR_COUNT) {
        return -1;
    }
    // the stations are a quarter turn apart
    return positiveMod((c * stepsPerRev + 2) / 4, stepsPerRev);
}

int Rotation::planIndex(int from, int to, int n, int overshoot, bool unidirectional, int seg[2]) {
    // s is the shortest way from "from" to "to" (positive = counter-clockwise)
    int s = positiveMod(to - from, n);
    if (s * 2 > n) {
        s = s - n;
    }

    if (s == 0) {
        return 0;   // already there
    }

    // counter-clockwise, or we do not care about the direction: one piece
    if (s > 0 || unidirectional == false) {
        seg[0] = s;
        return 1;
    }

    // clockwise but we want to arrive counter-clockwise:
    // go past the target and come back
    seg[0] = s - overshoot;
    seg[1] = overshoot;
    return 2;
}

Color Rotation::atStation() {
    if (state != ROT_IDLE || pos < 0) {
        return NO_COLOR;
    }
    int i;
    for (i = 0; i < COLOR_COUNT; i++) {
        Color c = (Color)i;
        if (stationSteps(c, cfg.stepsPerRev) == pos) {
            return c;
        }
    }
    return NO_COLOR;
}

// ---------- requests ----------
bool Rotation::requestHome() {
    if (isBusy() || interlockAllows() == false) {
        return false;
    }

    state = ROT_HOMING;
    fault = FAULT_NONE;
    pos = -1;
    searched = 0;
    stepsDone = 0;
    dir = 1;
    timing = false;

    // if the magnet is already over the sensor we cannot see its edge, so leave it first
    if (hall->active()) {
        job = JOB_LEAVE_MAGNET;
    } else {
        job = JOB_SEARCH;
    }
    return true;
}

bool Rotation::requestIndex(Color c) {
    if (c >= COLOR_COUNT || state != ROT_IDLE || interlockAllows() == false) {
        return false;
    }

    int n = cfg.stepsPerRev;
    int overshoot = (int)(cfg.overshootDeg * n / 360.0f + 0.5f);
    int target = stationSteps(c, n);

    segCount = planIndex(pos, target, n, overshoot, cfg.unidirectional, seg);
    if (segCount == 0) {
        return true;   // already at the station, nothing to do
    }

    segIndex = 0;
    state = ROT_MOVING;
    job = JOB_INDEX;
    timing = false;
    beginSegment();
    return true;
}

void Rotation::clearFault() {
    if (state == ROT_FAULT) {
        state = ROT_UNHOMED;
        fault = FAULT_NONE;
    }
}

// ---------- helpers for update() ----------
// starts the piece of the move that segIndex points to
void Rotation::beginSegment() {
    int s = seg[segIndex];
    if (s > 0) {
        dir = 1;
        remaining = s;
    } else {
        dir = -1;
        remaining = -s;
    }
    stepsDone = 0;
}

// Time between two steps. It starts slow, gets faster and slows down again before the end.
uint32_t Rotation::intervalUs() {
    int r = stepsDone;   // steps since the start of this piece
    if (job == JOB_INDEX || job == JOB_OFFSET) {
        if (remaining < r) {
            r = remaining;   // close to the end: use the steps that are left
        }
    }
    if (r > cfg.rampSteps) {
        r = cfg.rampSteps;
    }
    uint32_t span = cfg.startIntervalUs - cfg.minIntervalUs;
    return cfg.startIntervalUs - span * (uint32_t)r / cfg.rampSteps;
}

void Rotation::finishHome() {
    job = JOB_NONE;
    pos = 0;   // we are at the RED station now
    state = ROT_IDLE;
    if (cfg.releaseWhenIdle) {
        stepper->release();
    }
}

void Rotation::finishIndex() {
    job = JOB_NONE;
    state = ROT_IDLE;
    if (cfg.releaseWhenIdle) {
        stepper->release();
    }
}

// ---------- the main function, called all the time ----------
void Rotation::update(uint32_t nowUs) {
    if (job == JOB_NONE) {
        return;   // nothing to do
    }

    if (timing == false) {
        timing = true;
        nextUs = nowUs;
    }

    // Is it time for the next step? (The cast to int32_t also works when micros() wraps around.)
    if ((int32_t)(nowUs - nextUs) < 0) {
        return;
    }

    // make one step
    stepper->step(dir);
    stepsDone++;

    int limit = (int)((long)cfg.stepsPerRev * cfg.searchLimitPercent / 100);   // long: 16-bit int boards overflow here

    if (job == JOB_LEAVE_MAGNET || job == JOB_SEARCH) {
        searched++;
        bool foundEdge = false;

        if (job == JOB_LEAVE_MAGNET) {
            if (hall->active() == false) {
                job = JOB_SEARCH;   // off the magnet, now look for its edge
            }
        } else {
            if (hall->active()) {
                foundEdge = true;
            }
        }

        if (foundEdge) {
            // the RED station is homeOffsetDeg further on
            remaining = (int)(cfg.homeOffsetDeg * cfg.stepsPerRev / 360.0f + 0.5f);
            stepsDone = 0;
            job = JOB_OFFSET;
            if (remaining == 0) {
                finishHome();
            }
        } else if (searched >= limit) {
            // searched too long, the sensor or magnet must be missing
            job = JOB_NONE;
            state = ROT_FAULT;
            fault = FAULT_HOME_NOT_FOUND;
            stepper->release();
        }
    } else if (job == JOB_OFFSET) {
        remaining--;
        if (remaining <= 0) {
            finishHome();
        }
    } else if (job == JOB_INDEX) {
        pos = positiveMod(pos + dir, cfg.stepsPerRev);
        remaining--;
        if (remaining <= 0) {
            segIndex++;
            if (segIndex < segCount) {
                beginSegment();   // second piece of the move (the way back after an overshoot)
            } else {
                finishIndex();
            }
        }
    }

    // work out when the next step is due
    uint32_t interval = intervalUs();
    nextUs = nextUs + interval;

    // if we fell far behind, do not try to catch up with a burst of steps
    if ((int32_t)(nowUs - nextUs) > (int32_t)(interval * 4)) {
        nextUs = nowUs + interval;
    }
}
