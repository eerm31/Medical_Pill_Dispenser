// RefillingSystem.h
// The Refilling System: lets a person refill a ring by hand. It is independent of the dispensing code.
// It never touches the motor or the memory itself. It asks the board program through the small RefillHost interface,
// and the board program asks it back (isRefillActive) before it starts to dispense.
//
// One refill goes: requestRefill -> startRefill -> (the cartridge turns ONE move of 30 degrees) -> updateRefillInventory
// -> finishRefill. cancelRefill ends it earlier. While it is active the cartridge belongs to the Refilling System.
//
// There is no position sensor in this build: the cartridge counts its own half-steps, so "positioned" means one move of
// the motor was made, not that something measured it.

#ifndef REFILLING_SYSTEM_H
#define REFILLING_SYSTEM_H

#include <stdint.h>
#include <stddef.h>

#define REFILL_RING_COUNT 1             // rings this board really has
#define REFILL_MAX_PILLS 11             // 12 positions, one of them is the exit hole
#define REFILL_TIMEOUT_MS 600000UL      // a refill nobody finishes ends by itself, so it never blocks the doses for ever

enum class RefillStatus {
    READY,                // a refill can begin
    REFILL_MODE,          // a ring is chosen, the cartridge is locked for the refill
    POSITIONING,          // the cartridge turns one move
    WAITING_FOR_REFILL,   // the move is done, waiting for the pills and their count
    SAVING_INVENTORY,     // the count is saved, waiting for "refill complete"
    COMPLETED,
    CANCELLED,
    ERROR
};

enum class RefillError {
    NONE,
    NOT_IDLE,        // another refill is going on
    BAD_RING,        // there is no such ring
    RING_FULL,       // the ring already holds the most it can
    CARTRIDGE_BUSY,  // a dose is turning
    WRONG_STATE,     // the step is not allowed now
    BAD_AMOUNT,      // 0 or less pills, or more than the ring can take
    MOVE_REFUSED,    // the cartridge did not accept the move
    STORE_FAILED,    // the new count could not be saved
    TIMEOUT          // nobody finished the refill in time
};

// What the Refilling System needs from the board program.
class RefillHost {
public:
    virtual bool cartridgeFree() = 0;                  // no dose is turning and no other move is going on
    virtual bool moveOneSlot() = 0;                    // ONE move of 30 degrees, false if it was refused
    virtual bool moveDone() = 0;                       // the move that was asked for has finished
    virtual int ringPills(int ring) = 0;
    virtual bool storePills(int ring, int pills) = 0;  // keeps the new count in the board's memory
    virtual int cartridgeSlot() = 0;                   // which of the 12 positions the cartridge counts itself at
};

class RefillingSystem {
private:
    RefillHost* host;
    RefillStatus status;
    RefillError error;
    int ring;
    int previous;          // pills before the refill
    int added;
    int updated;
    int movesAsked;        // moves asked in this refill, never more than 1
    uint32_t lastActionMs;
    bool restartTimer;     // the next update() starts the timeout again

    void release(RefillStatus end);

public:
    RefillingSystem();

    void initializeRefillingSystem(RefillHost* hostPtr);
    bool requestRefill(int ringID);
    bool startRefill();
    bool updateRefillInventory(int pillsAdded);
    bool finishRefill();
    bool cancelRefill();
    // The cartridge was stopped from outside (for example by the stop command): its position can no longer be trusted.
    void motorFault();
    // Call this often with the time in milliseconds: it notices the end of the move and the timeout.
    void update(uint32_t nowMs);

    bool isRefillActive() const;
    RefillStatus getRefillStatus() const { return status; }
    RefillError getRefillError() const { return error; }
    int getRefillRing() const { return ring; }
    int getPreviousPills() const { return previous; }
    int getPillsAdded() const { return added; }
    int getUpdatedPills() const { return updated; }
    int getMovesAsked() const { return movesAsked; }
};

#endif
