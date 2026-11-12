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
    nextMoves = 0;
    returnMoves = 0;
    returnBack = false;
    returnStarted = false;
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
           status == RefillStatus::WAITING_FOR_REFILL || status == RefillStatus::SAVING_INVENTORY ||
           status == RefillStatus::RETURNING;
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
    nextMoves = 0;
    returnStarted = false;
    restartTimer = true;
    status = RefillStatus::REFILL_MODE;
    return true;
}

bool RefillingSystem::startRefill(int movesFirst) {
    if (status != RefillStatus::REFILL_MODE || movesAsked > 0) {
        error = RefillError::WRONG_STATE;
        return false;
    }
    if (movesFirst < 0 || movesFirst >= REFILL_MAX_PILLS) {
        error = RefillError::BAD_AMOUNT;   // nothing turned, the person can start again
        return false;
    }
    error = RefillError::NONE;
    restartTimer = true;
    if (movesFirst == 0) {
        status = RefillStatus::WAITING_FOR_REFILL;   // the filling hole is assumed to be empty: nothing turns
        return true;
    }
    movesAsked = movesFirst;   // one request, one batch of moves: nothing here asks for a second batch
    if (host->moveSlots(movesFirst, true) == false) {
        error = RefillError::MOVE_REFUSED;
        release(RefillStatus::ERROR);
        return false;
    }
    status = RefillStatus::POSITIONING;
    return true;
}

// The person is ready for the next pill: the cartridge turns one move so a free position meets the filling hole.
// The first pill needs no move, so there is at most one move less than the ring has room for.
bool RefillingSystem::moveNext() {
    if (status != RefillStatus::WAITING_FOR_REFILL) {
        error = RefillError::WRONG_STATE;
        return false;
    }
    if (nextMoves >= REFILL_MAX_PILLS - host->ringPills(ring) - 1) {
        error = RefillError::BAD_AMOUNT;   // no room for another pill
        return false;
    }
    if (host->cartridgeFree() == false) {
        error = RefillError::CARTRIDGE_BUSY;   // still holding its last position: nothing changes, ask again in a moment
        return false;
    }
    if (host->moveSlots(1, false) == false) {
        error = RefillError::MOVE_REFUSED;
        release(RefillStatus::ERROR);
        return false;
    }
    nextMoves++;
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
    if (status == RefillStatus::RETURNING) {
        if (returnStarted == false) {
            if (host->cartridgeFree()) {   // the last move may still be holding its position
                returnStarted = true;
                if (host->moveSlots(returnMoves, returnBack) == false) {
                    error = RefillError::MOVE_REFUSED;
                    release(RefillStatus::ERROR);
                }
            }
        } else if (host->moveDone()) {
            release(RefillStatus::COMPLETED);
        }
        return;
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
    // Only a cartridge that already held pills goes back to where it started: the moves against the dispensing
    // direction before the first pill minus the moves with it after each pill. An empty one stays where it is.
    int net = nextMoves - movesAsked;
    if (previous == 0 || net == 0) {
        release(RefillStatus::COMPLETED);
        return true;
    }
    returnMoves = net > 0 ? net : -net;
    returnBack = net > 0;
    returnStarted = false;
    status = RefillStatus::RETURNING;
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
