// cartridge_turn.cpp

#include "cartridge_turn.h"

TurnConfig::TurnConfig() {
    stepsPerRev = 4096;
    degreesPerPill = 30;
    stepIntervalUs = 1500;
    pauseUs = 1000000UL;
    direction = 1;
}

#define SETTINGS_MAGIC 0xA7   // first byte of the saved settings, used to recognise them

bool TurnConfig::isValid() const {
    if (stepsPerRev < 1) {
        return false;
    }
    if (degreesPerPill < 5 || degreesPerPill > 180 || 360 % degreesPerPill != 0) {
        return false;
    }
    if (stepIntervalUs < 1000 || stepIntervalUs > 10000) {
        return false;
    }
    if (pauseUs > 10000000UL) {
        return false;
    }
    return direction == 1 || direction == -1;
}

// bytes: magic, degrees, pause in ms (2 bytes), step interval in us (2 bytes), direction (1 = +1, 2 = -1)
size_t TurnConfig::save(uint8_t* buffer, size_t capacity) const {
    if (capacity < 7) {
        return 0;
    }
    uint32_t pauseMs = pauseUs / 1000;
    buffer[0] = SETTINGS_MAGIC;
    buffer[1] = (uint8_t)degreesPerPill;
    buffer[2] = (uint8_t)(pauseMs & 0xFF);
    buffer[3] = (uint8_t)(pauseMs >> 8);
    buffer[4] = (uint8_t)(stepIntervalUs & 0xFF);
    buffer[5] = (uint8_t)(stepIntervalUs >> 8);
    buffer[6] = (direction > 0) ? 1 : 2;
    return 7;
}

bool TurnConfig::load(const uint8_t* buffer, size_t length) {
    if (length < 7 || buffer[0] != SETTINGS_MAGIC) {
        return false;
    }
    TurnConfig c = *this;
    c.degreesPerPill = buffer[1];
    c.pauseUs = ((uint32_t)buffer[2] + ((uint32_t)buffer[3] << 8)) * 1000UL;
    c.stepIntervalUs = (uint32_t)buffer[4] + ((uint32_t)buffer[5] << 8);
    if (buffer[6] == 1) {
        c.direction = 1;
    } else if (buffer[6] == 2) {
        c.direction = -1;
    } else {
        return false;
    }
    if (c.isValid() == false) {
        return false;
    }
    *this = c;
    return true;
}

CartridgeTurner::CartridgeTurner(StepperPort* stepperPtr, TurnConfig config) {
    stepper = stepperPtr;
    cfg = config;
    slots = 360 / cfg.degreesPerPill;
    slot = 0;
    pillsLeft = 0;
    pillsDone = 0;
    stepsLeft = 0;
    busy = false;
    moving = false;
    needTime = false;
    finishedFlag = false;
    nextStepUs = 0;
    moveStartUs = 0;
    pauseEndUs = 0;
}

bool CartridgeTurner::setConfig(const TurnConfig& config) {
    if (busy || config.isValid() == false) {
        return false;
    }
    cfg = config;
    slots = 360 / cfg.degreesPerPill;
    slot = 0;
    return true;
}

// Starts the next move. The half-steps of a move are worked out from the slot number, so the moves add up to
// exactly stepsPerRev after a full turn (341 + 341 + 342 + ... = 4096) and the cartridge never drifts.
void CartridgeTurner::beginMove() {
    long from = (long)slot * cfg.stepsPerRev / slots;
    long to = (long)(slot + 1) * cfg.stepsPerRev / slots;
    stepsLeft = to - from;
    moving = true;
    needTime = true;
}

bool CartridgeTurner::start(int pills) {
    if (busy || pills < 1) {
        return false;
    }
    pillsLeft = pills;
    pillsDone = 0;
    finishedFlag = false;
    busy = true;
    beginMove();
    return true;
}

void CartridgeTurner::stop() {
    if (busy) {
        busy = false;
        moving = false;
        stepper->release();
    }
}

bool CartridgeTurner::finished() {
    if (finishedFlag) {
        finishedFlag = false;
        return true;
    }
    return false;
}

void CartridgeTurner::update(uint32_t nowUs) {
    if (busy == false) {
        return;
    }

    if (moving) {
        if (needTime) {
            needTime = false;
            nextStepUs = nowUs;   // the first half-step of a move is made right away
            moveStartUs = nowUs;
        }

        // is it time for the next half-step? (the int32_t cast also works when micros() wraps around)
        if ((int32_t)(nowUs - nextStepUs) < 0) {
            return;
        }

        stepper->step(cfg.direction);
        stepsLeft--;
        nextStepUs = nextStepUs + cfg.stepIntervalUs;

        // if we fell far behind, do not try to catch up with a burst of steps
        if ((int32_t)(nowUs - nextStepUs) > (int32_t)(cfg.stepIntervalUs * 4)) {
            nextStepUs = nowUs + cfg.stepIntervalUs;
        }

        if (stepsLeft <= 0) {
            // move finished: the pill is released. The next move starts pauseUs after this one started, coils stay on meanwhile
            slot = (slot + 1) % slots;
            pillsLeft--;
            pillsDone++;
            moving = false;
            pauseEndUs = moveStartUs + cfg.pauseUs;
        }
    } else {
        if ((int32_t)(nowUs - pauseEndUs) < 0) {
            return;
        }
        if (pillsLeft > 0) {
            beginMove();
        } else {
            busy = false;
            finishedFlag = true;
            stepper->release();
        }
    }
}
