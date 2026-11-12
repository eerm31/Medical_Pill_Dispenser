// test_refill.cpp
// Tests of the Refilling System. Part 1 runs the module alone against a fake host. Part 2 runs the real board program
// (Arduino Uno sketch, or ESP32 main.cpp with -DESP32_BOARD) on the laptop with a fake Arduino, clock and EEPROM.
// Build and run (from this folder):  make refill
// Only the cartridge's pin writes are counted, so "the cartridge did not turn" means "no pin was written".

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string>
#include <vector>
#include "Arduino.h"
#include "EEPROM.h"

uint32_t g_micros = 0;
long g_pinWrites = 0;
HostSerial Serial;
HostEeprom EEPROM;

#ifdef ESP32_BOARD
#include "../firmware/main.cpp"
#define TO_DUE_MS 60000   // this board keeps the clock to the minute: "time 07:59:50" becomes 07:59:00
#else
#include "../../src/scheduling-system.ino"
#define TO_DUE_MS 10000
#endif

int failures = 0;
int checks = 0;

#define CHECK(cond) \
    do { \
        checks++; \
        if (!(cond)) { \
            failures++; \
            printf("FAIL line %d: %s\n", __LINE__, #cond); \
        } \
    } while (0)

// ---------- part 0: the cartridge turning against the dispensing direction ----------

class RecordingStepper : public StepperPort {
public:
    long net;
    RecordingStepper() { net = 0; }
    void step(int dir) { net += dir; }
    void release() {}
};

void testReverseMoves() {
    RecordingStepper rec;
    CartridgeTurner t(&rec);   // 30 degrees, direction +1
    uint32_t now = 0;
    CHECK(t.start(1));
    while (t.isBusy()) {
        now += 500;
        t.update(now);
    }
    CHECK(rec.net == 341 && t.getSlot() == 1);   // one move forward: +1 for every half-step
    rec.net = 0;
    CHECK(t.startBack(2));
    while (t.isBusy()) {
        now += 500;
        t.update(now);
    }
    CHECK(rec.net == -(341 + 342) && t.getSlot() == 11);   // two moves back: -1 for every half-step, the slot counts down
    CHECK(t.getPillsDone() == 2);
}

// ---------- part 1: the module alone ----------

class FakeHost : public RefillHost {
public:
    bool freeCartridge;
    bool refuseMove;
    bool failStore;
    bool finished;
    int moves;
    int pills[REFILL_RING_COUNT];
    int stores;

    FakeHost() {
        freeCartridge = true;
        refuseMove = false;
        failStore = false;
        finished = false;
        moves = 0;
        stores = 0;
        pills[0] = 4;
    }
    bool cartridgeFree() { return freeCartridge; }
    bool moveSlots(int n, bool first) {
        if (refuseMove) {
            return false;
        }
        moves += first ? -n : n;   // before the first pill the cartridge turns back
        finished = false;
        return true;
    }
    bool moveDone() { return finished; }
    int ringPills(int r) { return pills[r]; }
    bool storePills(int r, int p) {
        if (failStore) {
            return false;
        }
        pills[r] = p;
        stores++;
        return true;
    }
    int cartridgeSlot() { return ((moves % 12) + 12) % 12; }
};

void testModuleAlone() {
    FakeHost host;
    RefillingSystem rs;
    rs.initializeRefillingSystem(&host);

    CHECK(rs.getRefillStatus() == RefillStatus::READY);
    CHECK(rs.isRefillActive() == false);

    // a bad ring, a busy cartridge and a full ring are refused and nothing is locked
    CHECK(rs.requestRefill(5) == false && rs.getRefillError() == RefillError::BAD_RING);
    host.freeCartridge = false;
    CHECK(rs.requestRefill(0) == false && rs.getRefillError() == RefillError::CARTRIDGE_BUSY);
    host.freeCartridge = true;
    host.pills[0] = REFILL_MAX_PILLS;
    CHECK(rs.requestRefill(0) == false && rs.getRefillError() == RefillError::RING_FULL);
    host.pills[0] = 4;
    CHECK(rs.isRefillActive() == false && host.moves == 0);

    // request: locked, but nothing moves until the person confirms
    CHECK(rs.requestRefill(0));
    CHECK(rs.getRefillStatus() == RefillStatus::REFILL_MODE && rs.isRefillActive());
    CHECK(host.moves == 0);
    CHECK(rs.requestRefill(0) == false && rs.getRefillError() == RefillError::NOT_IDLE);   // one ring at a time
    CHECK(rs.updateRefillInventory(2) == false);   // no pills before the cartridge is in place
    CHECK(rs.finishRefill() == false);

    // the moves before the first pill: from 0 up to 10, never more
    CHECK(rs.startRefill(-1) == false && rs.getRefillError() == RefillError::BAD_AMOUNT);
    CHECK(rs.startRefill(REFILL_MAX_PILLS) == false && rs.getRefillError() == RefillError::BAD_AMOUNT);
    CHECK(rs.getRefillStatus() == RefillStatus::REFILL_MODE && host.moves == 0);

    // two moves, however often it is asked for
    CHECK(rs.startRefill(2));
    CHECK(rs.getRefillStatus() == RefillStatus::POSITIONING);
    CHECK(rs.startRefill(2) == false);
    CHECK(host.moves == -2 && rs.getMovesAsked() == 2);
    CHECK(rs.cancelRefill() == false);   // the cartridge cannot be called back while it turns
    rs.update(1000);
    CHECK(rs.getRefillStatus() == RefillStatus::POSITIONING);
    host.finished = true;
    rs.update(2000);
    CHECK(rs.getRefillStatus() == RefillStatus::WAITING_FOR_REFILL);
    rs.update(3000);
    CHECK(host.moves == -2);

    // the amount: nothing below 1, nothing above the room that is left (4 + 8 would be 12)
    CHECK(rs.updateRefillInventory(0) == false && rs.getRefillError() == RefillError::BAD_AMOUNT);
    CHECK(rs.updateRefillInventory(8) == false && rs.getRefillError() == RefillError::BAD_AMOUNT);
    CHECK(rs.updateRefillInventory(-2) == false);
    CHECK(host.pills[0] == 4 && host.stores == 0);
    CHECK(rs.getRefillStatus() == RefillStatus::WAITING_FOR_REFILL);   // the person can try again

    CHECK(rs.updateRefillInventory(5));
    CHECK(host.pills[0] == 9 && host.stores == 1);
    CHECK(rs.getPreviousPills() == 4 && rs.getPillsAdded() == 5 && rs.getUpdatedPills() == 9);
    CHECK(rs.getRefillStatus() == RefillStatus::SAVING_INVENTORY && rs.isRefillActive());
    CHECK(rs.cancelRefill() == false);   // a saved count is not taken back
    CHECK(rs.updateRefillInventory(1) == false);   // and it is counted once
    // two moves back before the first pill and none after it: the cartridge turns two moves on to where it was
    CHECK(rs.finishRefill());
    CHECK(rs.getRefillStatus() == RefillStatus::RETURNING && rs.isRefillActive());
    CHECK(rs.cancelRefill() == false);
    host.freeCartridge = false;
    rs.update(4000);
    CHECK(host.moves == -2);   // waits until the cartridge is free
    host.freeCartridge = true;
    rs.update(5000);
    CHECK(host.moves == 0 && rs.getRefillStatus() == RefillStatus::RETURNING);
    host.finished = true;
    rs.update(6000);
    CHECK(rs.getRefillStatus() == RefillStatus::COMPLETED && rs.isRefillActive() == false);

    // cancel before any pill: nothing changes
    host.pills[0] = 6;
    CHECK(rs.requestRefill(0));
    CHECK(rs.cancelRefill());
    CHECK(rs.getRefillStatus() == RefillStatus::CANCELLED && rs.isRefillActive() == false);
    CHECK(host.pills[0] == 6 && host.stores == 1 && host.moves == 0);

    // no move asked for: nothing turns, straight to waiting for the pills (the filling hole is assumed to be empty)
    CHECK(rs.requestRefill(0));
    CHECK(rs.startRefill());
    CHECK(rs.getRefillStatus() == RefillStatus::WAITING_FOR_REFILL && host.moves == 0);
    CHECK(rs.startRefill() == false);
    CHECK(rs.cancelRefill());

    // a move the cartridge refuses ends in ERROR and does not stay locked
    host.refuseMove = true;
    CHECK(rs.requestRefill(0));
    CHECK(rs.startRefill(1) == false && rs.getRefillError() == RefillError::MOVE_REFUSED);
    CHECK(rs.getRefillStatus() == RefillStatus::ERROR && rs.isRefillActive() == false);
    host.refuseMove = false;

    // a count that cannot be saved ends in ERROR and the old count stays
    CHECK(rs.requestRefill(0) && rs.startRefill());
    host.finished = true;
    rs.update(10000);
    host.failStore = true;
    CHECK(rs.updateRefillInventory(2) == false && rs.getRefillError() == RefillError::STORE_FAILED);
    CHECK(rs.getRefillStatus() == RefillStatus::ERROR && rs.isRefillActive() == false);
    CHECK(host.pills[0] == 6);
    host.failStore = false;

    // nobody finishes: the lock ends by itself and the count is as it was
    CHECK(rs.requestRefill(0));
    rs.update(20000);
    CHECK(rs.isRefillActive());
    rs.update(20000 + REFILL_TIMEOUT_MS - 1000);
    CHECK(rs.isRefillActive());
    rs.update(20000 + REFILL_TIMEOUT_MS + 1000);
    CHECK(rs.getRefillStatus() == RefillStatus::CANCELLED && rs.getRefillError() == RefillError::TIMEOUT);
    CHECK(host.pills[0] == 6);

    // a motor that was stopped from outside mid-move
    CHECK(rs.requestRefill(0) && rs.startRefill(1));
    rs.motorFault();
    CHECK(rs.getRefillStatus() == RefillStatus::ERROR && rs.isRefillActive() == false);
}

// ---------- part 2: the real board program ----------

void runMs(uint32_t ms) {
    uint32_t end = g_micros + ms * 1000UL;
    while ((int32_t)(end - g_micros) > 0) {
        g_micros += 500;
        loop();
    }
}

void command(const char* text) {
    Serial.type(text);
    runMs(5);
}

std::string fmt(const char* format, ...) {
    char buffer[96];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    return buffer;
}

bool has(const std::string& text, size_t from = 0) {
    for (size_t i = from; i < Serial.lines.size(); i++) {
        if (Serial.lines[i].text == text) {
            return true;
        }
    }
    return false;
}

int countStarting(const char* prefix, size_t from = 0) {
    int n = 0;
    for (size_t i = from; i < Serial.lines.size(); i++) {
        if (Serial.lines[i].text.compare(0, strlen(prefix), prefix) == 0) {
            n++;
        }
    }
    return n;
}

void dumpSerial() {
    printf("--- serial output ---\n");
    for (size_t i = 0; i < Serial.lines.size(); i++) {
        printf("%9.3f  %s\n", Serial.lines[i].atUs / 1e6, Serial.lines[i].text.c_str());
    }
}

// the whole refill up to the point where the cartridge is in place
void refillUntilWaiting(size_t from) {
    runMs(6000);   // the cartridge still holds its last position for 5 s after a move
    command("refill request 0");
    command("refill start");
    runMs(1500);   // the move takes about half a second
    CHECK(countStarting("refill status WAITING_FOR_REFILL ring 0", from) >= 1);
}

int main() {
    testReverseMoves();
    testModuleAlone();

    setup();
    command("set 30 5000 1500 1");   // these scenarios were written for a cartridge that holds its position 5 s
    command("clear");
    command("save");   // no medication schedule at all
    command("time 07:00:00");
    CHECK(schedule.getCount() == 0);

    // ---- A: first refill with no schedule: nothing turns for the first pill, then 5 pills ----
    command("pills 0");
    size_t mark = Serial.lines.size();
    command("refill list");
    CHECK(has("refill ring 0 0 11", mark));
    long pinsBefore = g_pinWrites;
    command("refill request 0");
    CHECK(has("refill status REFILL_MODE ring 0 pills 0", mark));
    runMs(3000);
    CHECK(g_pinWrites == pinsBefore);   // choosing a ring turns nothing
    command("pills 3");
    CHECK(schedule.ringPills(RED) == 0);   // the inventory is not set while a refill is open
    command("step");
    CHECK(g_pinWrites == pinsBefore);
    command("refill start");
    CHECK(has("refill status WAITING_FOR_REFILL ring 0 pills 0 slot 0", mark));
    runMs(30000);
    CHECK(g_pinWrites == pinsBefore);   // no move at all: the filling hole is assumed to be empty
    CHECK(turner.getSlot() == 0);
    command("refill add 5");
    CHECK(has("refill saved ring 0 prev 0 added 5 new 5", mark));
    CHECK(has("ring 5 READY", mark));
    CHECK(schedule.ringPills(RED) == 5);
    command("refill finish");
    CHECK(has("refill done ring 0 prev 0 added 5 new 5", mark));
    CHECK(has("refill status COMPLETED ring 0 pills 5", mark));
    CHECK(refill.isRefillActive() == false);
    CHECK(g_pinWrites == pinsBefore);   // no move, no other ring

    // ---- F: the new count is in the board's memory, although no dose is saved ----
    Scheduler restarted;
    CHECK(restarted.load(EEPROM.bytes + SCHEDULE_ADDRESS, SCHEDULE_BYTES));
    CHECK(restarted.ringPills(RED) == 5 && restarted.getCount() == 0);

    // ---- B: a ring with 4 pills gets 5 more ----
    command("pills 4");
    mark = Serial.lines.size();
    refillUntilWaiting(mark);
    command("refill add 5");
    command("refill finish");
    CHECK(has("refill done ring 0 prev 4 added 5 new 9", mark));
    CHECK(schedule.ringPills(RED) == 9);

    // ---- C: 9 + 3 would be 12: refused, still 9, the person can try again ----
    mark = Serial.lines.size();
    refillUntilWaiting(mark);
    command("refill add 3");
    CHECK(has("refill error BAD_AMOUNT", mark));
    CHECK(schedule.ringPills(RED) == 9);
    CHECK(refill.getRefillStatus() == RefillStatus::WAITING_FOR_REFILL);
    command("refill add 0");
    CHECK(schedule.ringPills(RED) == 9);
    command("refill add 2");
    command("refill finish");
    CHECK(schedule.ringPills(RED) == 11);
    command("refill request 0");
    CHECK(has("refill error RING_FULL", mark));   // a full ring is not an empty one
    command("refill request 7");
    CHECK(has("refill error BAD_RING", mark));

    // ---- D: cancel after the cartridge is in place: nothing is added ----
    runMs(6000);
    command("pills 6");
    mark = Serial.lines.size();
    refillUntilWaiting(mark);
    command("refill cancel");
    CHECK(has("refill status CANCELLED ring 0 pills 6", mark));
    CHECK(schedule.ringPills(RED) == 6 && refill.isRefillActive() == false);
    command("refill cancel");
    CHECK(has("refill error WRONG_STATE", mark));
    command("refill add 2");
    CHECK(schedule.ringPills(RED) == 6);

    // ---- stop during the move: the position is not trusted, nothing is saved ----
    mark = Serial.lines.size();
    runMs(6000);
    command("refill request 0");
    command("refill start 1");
    runMs(100);
    command("stop");
    CHECK(has("refill status ERROR ring 0 pills 6", mark));
    CHECK(refill.isRefillActive() == false && schedule.ringPills(RED) == 6);

    // ---- E: a dose comes due while a refill is open: it waits, and goes on when the refill is cancelled ----
    command("add 08:00:00 2");
    command("time 07:59:50");
    mark = Serial.lines.size();
    refillUntilWaiting(mark);
    runMs(6000);   // the coils are switched off after the hold
    long pinsOpen = g_pinWrites;
    runMs(TO_DUE_MS + 20000);
    CHECK(countStarting("dose start", mark) == 0);
    CHECK(g_pinWrites == pinsOpen);   // no conflicting motor command
    CHECK(schedule.ringPills(RED) == 6);
    command("refill cancel");
    runMs(1000);
    CHECK(countStarting("dose start", mark) == 1);   // control went back to the dispensing
    command("refill request 0");
    CHECK(has("refill error CARTRIDGE_BUSY", mark));   // and a dose that is turning cannot be interrupted by a refill
    runMs(30000);

    // ---- a refill nobody finishes ends by itself ----
    runMs(6000);
    command("pills 3");
    mark = Serial.lines.size();
    refillUntilWaiting(mark);
    CHECK(refill.isRefillActive());
    runMs(REFILL_TIMEOUT_MS + 5000);
    CHECK(has("refill status CANCELLED ring 0 pills 3", mark));
    CHECK(refill.isRefillActive() == false && schedule.ringPills(RED) == 3);

    // ---- the cartridge turns one move, against the dispensing direction, when the person is ready for the next pill ----
    runMs(6000);
    command("pills 8");   // room for three more pills: two moves between them
    mark = Serial.lines.size();
    refillUntilWaiting(mark);
    runMs(6000);   // the cartridge is idle
    int slotBeforeNext = turner.getSlot();
    size_t markNext = Serial.lines.size();
    command("refill next");
    CHECK(has("refill status POSITIONING ring 0 pills 8", markNext));
    command("refill next");
    CHECK(has("refill error WRONG_STATE", markNext));   // not twice while it turns
    runMs(1500);
    CHECK(turner.getSlot() == (slotBeforeNext + 1) % 12);   // one move on, the way the doses turn
    CHECK(refill.getRefillStatus() == RefillStatus::WAITING_FOR_REFILL);
    command("refill next");
    CHECK(has("refill error CARTRIDGE_BUSY", markNext));   // still holding its position: ask again in a moment
    CHECK(refill.getNextMoves() == 1);
    runMs(6000);
    command("refill next");
    runMs(1500);
    CHECK(turner.getSlot() == (slotBeforeNext + 2) % 12);
    runMs(6000);
    command("refill next");
    CHECK(has("refill error BAD_AMOUNT", markNext));   // two moves between three pills, no more
    CHECK(refill.getRefillStatus() == RefillStatus::WAITING_FOR_REFILL);
    CHECK(refill.getNextMoves() == 2);
    command("refill add 3");
    command("refill finish");
    CHECK(schedule.ringPills(RED) == 11);
    CHECK(has("refill status RETURNING ring 0 pills 11", markNext));
    runMs(15000);   // two moves back to where the refill began, then it is done
    CHECK(turner.getSlot() == slotBeforeNext && refill.isRefillActive() == false);
    CHECK(has("refill done ring 0 prev 8 added 3 new 11", markNext));

    // ---- an empty cartridge is not turned back after the refill: it stays where the last pill left it ----
    runMs(6000);
    command("pills 0");
    mark = Serial.lines.size();
    refillUntilWaiting(mark);
    runMs(6000);
    int slotEmpty = turner.getSlot();
    command("refill next");
    runMs(1500);
    CHECK(turner.getSlot() == (slotEmpty + 1) % 12);
    command("refill add 2");
    command("refill finish");
    CHECK(refill.getRefillStatus() == RefillStatus::COMPLETED && has("refill done ring 0 prev 0 added 2 new 2", mark));
    runMs(15000);
    CHECK(turner.getSlot() == (slotEmpty + 1) % 12);

    // ---- the page asks for moves first (the pills dispensed since the last fill, minus one) ----
    runMs(6000);
    command("pills 4");
    mark = Serial.lines.size();
    command("refill request 0");
    int slotStart = turner.getSlot();
    command("refill start 11");
    CHECK(has("refill error BAD_AMOUNT", mark));   // never a full turn and more
    CHECK(refill.getRefillStatus() == RefillStatus::REFILL_MODE);
    command("refill start 2");
    CHECK(has("refill status POSITIONING ring 0 pills 4", mark));
    runMs(7000);   // two moves, one every 5 s here
    CHECK(turner.getSlot() == (slotStart + 10) % 12);   // two moves back
    CHECK(refill.getRefillStatus() == RefillStatus::WAITING_FOR_REFILL);
    command("refill cancel");

    printf("%d checks, %d failures\n", checks, failures);
    if (failures > 0) {
        dumpSerial();
    }
    return failures == 0 ? 0 : 1;
}
