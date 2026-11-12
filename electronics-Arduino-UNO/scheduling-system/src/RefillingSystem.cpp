// RefillingSystem.cpp

#include "RefillingSystem.h"

RefillingSystem::RefillingSystem() {
    host = NULL;
    status = RefillStatus::READY;
    error = RefillError::NONE;
    ring = -1;
    previous = 0;
    added = 0;
    updated = 0;
    movesAsked = 0;
    lastActionMs = 0;
    restartTimer = true;
}

void RefillingSystem::initializeRefillingSystem(RefillHost* hostPtr) {
    host = hostPtr;
    status = RefillStatus::READY;
    error = RefillError::NONE;
    ring = -1;
}

bool RefillingSystem::isRefillActive() const {
    return status == RefillStatus::REFILL_MODE || status == RefillStatus::POSITIONING ||
           status == RefillStatus::WAITING_FOR_REFILL || status == RefillStatus::SAVING_INVENTORY;
}

// ends the refill: the lock goes away and the inventory stays as it is
void RefillingSystem::release(RefillStatus end) {
    status = end;
}

bool RefillingSystem::requestRefill(int ringID) {
    if (host == NULL || isRefillActive()) {
        error = RefillError::NOT_IDLE;
        return false;
    }
    if (ringID < 0 || ringID >= REFILL_RING_COUNT) {
        error = RefillError::BAD_RING;
        return false;
    }
    if (host->ringPills(ringID) >= REFILL_MAX_PILLS) {
        error = RefillError::RING_FULL;
        return false;
    }
    if (host->cartridgeFree() == false) {
        error = RefillError::CARTRIDGE_BUSY;
        return false;
    }
    error = RefillError::NONE;
    ring = ringID;
    previous = host->ringPills(ringID);
    added = 0;
    updated = previous;
    movesAsked = 0;
    restartTimer = true;
    status = RefillStatus::REFILL_MODE;
    return true;
}

bool RefillingSystem::startRefill() {
    if (status != RefillStatus::REFILL_MODE || movesAsked > 0) {
        error = RefillError::WRONG_STATE;
        return false;
    }
    movesAsked = 1;   // one request, one move: nothing here asks for a second one
    if (host->moveOneSlot() == false) {
        error = RefillError::MOVE_REFUSED;
        release(RefillStatus::ERROR);
        return false;
    }
    error = RefillError::NONE;
    restartTimer = true;
    status = RefillStatus::POSITIONING;
    return true;
}

void RefillingSystem::update(uint32_t nowMs) {
    if (isRefillActive() == false) {
        return;
    }
    if (restartTimer) {
        lastActionMs = nowMs;
        restartTimer = false;
    }
    if (status == RefillStatus::POSITIONING) {
        if (host->moveDone()) {
            status = RefillStatus::WAITING_FOR_REFILL;
            lastActionMs = nowMs;
        }
        return;
    }
    bool late = (int32_t)(nowMs - lastActionMs) > (int32_t)REFILL_TIMEOUT_MS;
    if (status == RefillStatus::SAVING_INVENTORY) {
        if (late) {
            release(RefillStatus::COMPLETED);   // the count is saved, only the person's "complete" is missing
        }
        return;
    }
    if (late) {
        error = RefillError::TIMEOUT;
        release(RefillStatus::CANCELLED);
    }
}

bool RefillingSystem::updateRefillInventory(int pillsAdded) {
    if (status != RefillStatus::WAITING_FOR_REFILL) {
        error = RefillError::WRONG_STATE;
        return false;
    }
    int room = REFILL_MAX_PILLS - host->ringPills(ring);
    if (pillsAdded < 1 || pillsAdded > room) {
        error = RefillError::BAD_AMOUNT;   // nothing changes and the person can try again
        return false;
    }
    previous = host->ringPills(ring);
    if (host->storePills(ring, previous + pillsAdded) == false) {
        error = RefillError::STORE_FAILED;
        release(RefillStatus::ERROR);
        return false;
    }
    added = pillsAdded;
    updated = previous + pillsAdded;
    error = RefillError::NONE;
    restartTimer = true;
    status = RefillStatus::SAVING_INVENTORY;
    return true;
}

bool RefillingSystem::finishRefill() {
    if (status != RefillStatus::SAVING_INVENTORY) {
        error = RefillError::WRONG_STATE;
        return false;
    }
    error = RefillError::NONE;
    release(RefillStatus::COMPLETED);
    return true;
}

bool RefillingSystem::cancelRefill() {
    // while the cartridge turns it cannot be called back, and a saved count cannot be taken back
    if (status != RefillStatus::REFILL_MODE && status != RefillStatus::WAITING_FOR_REFILL) {
        error = RefillError::WRONG_STATE;
        return false;
    }
    error = RefillError::NONE;
    release(RefillStatus::CANCELLED);
    return true;
}

void RefillingSystem::motorFault() {
    if (isRefillActive() && status != RefillStatus::SAVING_INVENTORY) {
        error = RefillError::MOVE_REFUSED;
        release(RefillStatus::ERROR);
    }
}
