// cartridge_turn.h
// Turns the cartridge one move of "degreesPerPill" (30) for every pill of a dose, with a short pause after each
// move so the pill can fall out. There is no pin or sensor: turning the cartridge IS the dispensing.
//
// How it works: call update() over and over (for example in loop()). Each call makes at most one half-step,
// so the rest of the program keeps running.

#ifndef CARTRIDGE_TURN_H
#define CARTRIDGE_TURN_H

#include <stdint.h>
#include <stddef.h>
#include "rotation.h"

struct TurnConfig {
    int stepsPerRev;            // half-steps for one full turn of the cartridge (28BYJ-48: 4096)
    int degreesPerPill;         // one pill = one move of this many degrees (30 degrees = 12 windows)
    uint32_t stepIntervalUs;    // time between two half-steps (smaller = faster)
    uint32_t pauseUs;           // time from the start of one move to the start of the next (one pill every pauseUs)
    int direction;              // +1 or -1

    TurnConfig();               // fills in the default values

    bool isValid() const;       // true if the numbers make sense (degrees must divide 360)
    // The settings as 7 bytes, so they can be kept in the board's memory. Returns the number of bytes, 0 if too small.
    size_t save(uint8_t* buffer, size_t capacity) const;
    // Reads the bytes made by save(). Returns false (and changes nothing) if they are not valid settings.
    bool load(const uint8_t* buffer, size_t length);
};

class CartridgeTurner {
private:
    StepperPort* stepper;
    TurnConfig cfg;

    int slots;              // how many moves make one full turn (360 / degreesPerPill)
    int slot;               // which slot the cartridge is at, 0 to slots - 1
    int pillsLeft;          // moves still to do for this dose
    int pillsDone;          // moves finished for this dose
    long stepsLeft;         // half-steps left in the current move
    bool busy;
    bool moving;            // true while turning, false while pausing
    bool needTime;          // true until update() has seen the clock for the first time in a move
    bool finishedFlag;      // set when a dose is complete, cleared by finished()
    uint32_t nextStepUs;    // when the next half-step is due
    uint32_t moveStartUs;   // when the current move made its first half-step
    uint32_t pauseEndUs;    // when the pause ends

    void beginMove();

public:
    CartridgeTurner(StepperPort* stepperPtr, TurnConfig config = TurnConfig());

    bool start(int pills);          // false if it is busy or pills is below 1
    void stop();                    // stops at once and switches the coils off, the dose does not count as finished
    void update(uint32_t nowUs);    // call this as often as possible

    // Changes the settings. Refused while turning or if the numbers are not valid. The slot counter starts again at 0.
    bool setConfig(const TurnConfig& config);
    TurnConfig getConfig() { return cfg; }

    bool isBusy() { return busy; }
    bool finished();                // true ONCE after a dose is complete
    int getPillsDone() { return pillsDone; }
    int getSlot() { return slot; }
};

#endif
