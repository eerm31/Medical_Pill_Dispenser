// auto_rotate.cpp

#include <stddef.h>
#include "auto_rotate.h"

AutoConfig::AutoConfig() {
    prePosition = true;
    parkAfter = true;
    parkColor = RED;
}

AutoRotate::AutoRotate(Scheduler* schedulePtr, Rotation* rotationPtr, Dispenser* dispenserPtr, AutoConfig config) {
    schedule = schedulePtr;
    rotation = rotationPtr;
    dispenser = dispenserPtr;
    cfg = config;
    state = AUTO_START;
    takingId = 0;
    takeColor = NO_COLOR;
    takePills = 1;
    takeQueued = false;
    message = "";

    // the drum must not turn while a pill is being dispensed
    rotation->setInterlock(interlockCheck, this);
}

bool AutoRotate::interlockCheck(void* self) {
    AutoRotate* me = (AutoRotate*)self;
    return me->state != AUTO_DISPENSING;
}

const char* AutoRotate::stateName() {
    if (state == AUTO_START) {
        return "START";
    }
    if (state == AUTO_HOMING) {
        return "HOMING";
    }
    if (state == AUTO_IDLE) {
        return "IDLE";
    }
    if (state == AUTO_POSITIONING) {
        return "POSITIONING";
    }
    if (state == AUTO_READY) {
        return "READY";
    }
    if (state == AUTO_DISPENSING) {
        return "DISPENSING";
    }
    if (state == AUTO_PARKING) {
        return "PARKING";
    }
    return "FAULT";
}

void AutoRotate::begin() {
    if (state != AUTO_START) {
        return;
    }
    if (rotation->requestHome()) {
        state = AUTO_HOMING;
    } else {
        message = "home search refused";
    }
}

void AutoRotate::recover() {
    if (state != AUTO_FAULT) {
        return;
    }
    rotation->clearFault();
    message = "";
    state = AUTO_START;
    begin();
}

void AutoRotate::goIdle() {
    takeQueued = false;
    state = AUTO_IDLE;
}

// Something went wrong with a dose that was being taken: put it back to DUE and remember why.
void AutoRotate::failTake(const char* why) {
    if (takeQueued || state == AUTO_DISPENSING) {
        schedule->abortTake(takingId);
    }
    message = why;
    takeQueued = false;
}

void AutoRotate::startDispense() {
    takeQueued = false;
    if (dispenser->start(takeColor, takePills)) {
        state = AUTO_DISPENSING;
        message = "";
    } else {
        schedule->abortTake(takingId);
        message = "dispenser refused";
        goIdle();
    }
}

// ---------- the tap on TAKE ----------
bool AutoRotate::takePressed() {
    // only possible when the drum is homed and not busy dispensing
    if (state != AUTO_IDLE && state != AUTO_POSITIONING && state != AUTO_READY) {
        message = "not ready";
        return false;
    }

    const Entry* d = schedule->due();
    if (d == NULL) {
        message = "no dose is due";
        return false;
    }

    takingId = d->id;
    takeColor = d->color;
    takePills = d->pills;
    if (schedule->beginTake(takingId) == false) {
        return false;
    }
    message = "";

    // the drum is already at the right colour: dispense now
    if (rotation->atStation() == takeColor) {
        startDispense();
        return state == AUTO_DISPENSING;
    }

    // the drum is already turning there (pre-positioning): the dispense starts when it arrives
    if (state == AUTO_POSITIONING && rotation->isBusy()) {
        takeQueued = true;
        return true;
    }

    // otherwise start turning now
    if (rotation->requestIndex(takeColor)) {
        takeQueued = true;
        state = AUTO_POSITIONING;
        return true;
    }

    schedule->abortTake(takingId);
    message = "drum cannot turn now";
    return false;
}

// ---------- the state machine ----------
void AutoRotate::update(uint32_t nowUs) {
    rotation->update(nowUs);

    // a rotation fault stops everything
    if (rotation->getState() == ROT_FAULT && state != AUTO_FAULT) {
        failTake("rotation fault: home sensor not found");
        state = AUTO_FAULT;
        return;
    }

    if (state == AUTO_HOMING) {
        if (rotation->getState() == ROT_IDLE) {
            goIdle();
        }
    } else if (state == AUTO_IDLE) {
        const Entry* d = schedule->due();
        if (d != NULL) {
            if (rotation->atStation() == d->color) {
                state = AUTO_READY;
            } else if (cfg.prePosition && rotation->requestIndex(d->color)) {
                state = AUTO_POSITIONING;
            }
        }
    } else if (state == AUTO_POSITIONING) {
        if (rotation->getState() == ROT_IDLE) {
            if (takeQueued) {
                // the user already tapped, so dispense as soon as the drum has arrived
                if (rotation->atStation() == takeColor) {
                    startDispense();
                } else {
                    failTake("drum missed the station");
                    goIdle();
                }
            } else {
                state = AUTO_IDLE;   // arrived; the IDLE state decides what happens next
            }
        }
    } else if (state == AUTO_READY) {
        // go back to IDLE if the dose was missed or another colour is due first
        const Entry* d = schedule->due();
        if (d == NULL || rotation->atStation() != d->color) {
            state = AUTO_IDLE;
        }
    } else if (state == AUTO_DISPENSING) {
        Verdict verdict = VERDICT_NONE;
        if (dispenser->finished(&verdict)) {
            schedule->finishTake(takingId, verdict);
            goIdle();   // the interlock opens again as soon as we leave DISPENSING

            // go back to the park station
            if (cfg.parkAfter && rotation->atStation() != cfg.parkColor) {
                if (rotation->requestIndex(cfg.parkColor)) {
                    state = AUTO_PARKING;
                }
            }
        }
    } else if (state == AUTO_PARKING) {
        if (rotation->getState() == ROT_IDLE) {
            goIdle();
        }
    }
}
