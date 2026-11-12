// main.cpp
// Dose schedule for the ESP32-S3 with ONE cartridge, no pin and no sensors (not tested on a real board yet).
// When a scheduled time comes, the stepper turns the cartridge 30 degrees for every pill of the dose.
// The schedule is set from the UI System page (scheduler-ui/index.html) over USB and kept in the board's memory.
// Open the serial monitor at 115200 baud and type "help" if you want to type the commands yourself.

#include <Arduino.h>
#include <stdlib.h>
#include <string.h>
#include "config.h"
#include "core/schedule.h"
#include "core/cartridge_turn.h"
#include "hw/uln2003_stepper.h"
#include "hw/eeprom_store.h"
#include "core/dose_log.h"
#include "core/RefillingSystem.h"
#include "my_schedule.h"

Uln2003Stepper stepper;
Store store;
Scheduler schedule;

// the turn settings start from my_schedule.h (the UI System can change them and save them)
TurnConfig makeTurnConfig() {
    TurnConfig c;
    c.stepsPerRev = STEPS_PER_REV;
    c.degreesPerPill = DEGREES_PER_PILL;
    c.stepIntervalUs = STEP_INTERVAL_US;
    c.pauseUs = (uint32_t)PAUSE_MS_AFTER_MOVE * 1000UL;
    c.direction = TURN_DIRECTION;
    return c;
}
CartridgeTurner turner(&stepper, makeTurnConfig());

// The clock: seconds since midnight = clockBaseSeconds + the time since the clock was set.
// The UI System sets it from the computer's clock when it connects.
uint32_t clockBaseMs = 0;
uint32_t clockBaseSeconds = 8 * 3600;
uint32_t lastSecond = 0;

uint8_t turnDoseId = 0;     // the dose that is being dispensed, 0 when none (or a test move)
uint16_t turnMinutes = 0;   // its scheduled time
uint32_t turnStarted = 0;   // the clock when it started
uint8_t turnPills = 0;      // pills the dose needs
uint8_t turnReported = 0;   // pills of the dose already confirmed
bool testMove = false;      // true while a "step" test move is turning

// the time between two pills is never shorter than this
#define MIN_PILL_INTERVAL_MS 5000UL

// The single ring of this board is RED. Its pill count is shared by all doses and only goes down when a pill is confirmed.
#define RING RED

// EMPTY is about the pills in the ring. A FINISHED dose is a different thing: the ring can still hold pills.
void printRing() {
    int pills = schedule.ringPills(RING);
    Serial.printf("ring %d %s\n", pills, pills == 0 ? "EMPTY" : "READY");
}

const char* logStatusText(uint8_t status) {
    if (status == LOG_COMPLETED) {
        return "COMPLETED";
    }
    if (status == LOG_INCOMPLETE) {
        return "INCOMPLETE";
    }
    if (status == LOG_FAILED) {
        return "FAILED";
    }
    return "FINISHED";
}

// "dose end #id HH:MM:SS RESULT done/needed left N": the UI System turns this into a line of the dosage history.
// The event also goes into the log in the board's memory, which keeps only the last LOG_MAX events.
void reportDoseEnd(uint8_t id, uint16_t minutes, LogStatus status, int done, int needed) {
    uint32_t now = schedule.getClock();
    LogRecord r = {id, (uint8_t)status, (uint8_t)done, (uint8_t)needed, (uint32_t)minutes * 60, status == LOG_FINISHED ? now : turnStarted, now};
    logAdd(store, LOG_ADDRESS, r);
    Serial.printf("dose end #%d %02d:%02d:00 %s %d/%d left %d\n", id, minutes / 60, minutes % 60, logStatusText(status), done, needed, schedule.ringPills(RING));
}

// "log N" and then one line per kept event, oldest first
void printLog() {
    Serial.printf("log %d\n", logCount(store, LOG_ADDRESS));
    LogRecord r;
    for (int i = 0; logGet(store, LOG_ADDRESS, i, &r); i++) {
        Serial.printf("log #%d %02lu:%02lu:%02lu %02lu:%02lu:%02lu %02lu:%02lu:%02lu %s %d/%d\n", r.id,
                      (unsigned long)(r.scheduled / 3600), (unsigned long)(r.scheduled % 3600 / 60), (unsigned long)(r.scheduled % 60),
                      (unsigned long)(r.started / 3600), (unsigned long)(r.started % 3600 / 60), (unsigned long)(r.started % 60),
                      (unsigned long)(r.ended / 3600), (unsigned long)(r.ended % 3600 / 60), (unsigned long)(r.ended % 60),
                      logStatusText(r.status), r.done, r.needed);
    }
}

void reportFinished(uint8_t id, uint16_t minutes) {
    Serial.printf("schedule FINISHED #%d %02d:%02d:00\n", id, minutes / 60, minutes % 60);
}

// prints the clock, all the doses and the turn settings (the UI System reads these lines)
void printList() {
    const Entry* list[MAX_ENTRIES];
    int n = schedule.sorted(list);
    char timeText[6];

    Scheduler::formatTime(schedule.getClock() / 60, timeText);
    Serial.printf("clock %s\n", timeText);

    for (int i = 0; i < n; i++) {
        Scheduler::formatTime(list[i]->minutes, timeText);
        const char* note = "";
        if (list[i]->tomorrow) {
            note = " (tomorrow)";
        }
        Serial.printf("  #%d %s x%d %s%s\n", list[i]->id, timeText, list[i]->pills,
                      Scheduler::statusName(list[i]->status), note);
    }

    TurnConfig c = turner.getConfig();
    Serial.printf("turn %d %lu %lu %d\n", c.degreesPerPill, (unsigned long)(c.pauseUs / 1000),
                  (unsigned long)c.stepIntervalUs, c.direction);
    printRing();
}

// keeps the schedule, the ring count and the turn settings in the board's memory (the ring count is stored with the doses)
void persist() {
    uint8_t scheduleBytes[SCHEDULE_BYTES];
    uint8_t settingsBytes[SETTINGS_BYTES];

    size_t n = schedule.save(scheduleBytes, sizeof(scheduleBytes));
    store.write(SCHEDULE_ADDRESS, scheduleBytes, n);
    size_t m = turner.getConfig().save(settingsBytes, sizeof(settingsBytes));
    store.write(SETTINGS_ADDRESS, settingsBytes, m);
}

void saveToMemory() {
    persist();
    Serial.printf("saved %d dose(s)\n", schedule.getCount());
}

// Stops the cartridge. A dose with no pill out goes back to DUE, one with some pills out is INCOMPLETE and never restarts.
void interruptDose(bool dropped = false) {
    turner.stop();
    if (turnDoseId != 0) {
        uint8_t id = turnDoseId;
        turnDoseId = 0;
        schedule.abortTake(id, turnReported);
        if (turnReported > 0 || dropped) {
            reportDoseEnd(id, turnMinutes, LOG_INCOMPLETE, turnReported, turnPills);
        }
    }
    testMove = false;
}

// ---------- the Refilling System: this is all the board program knows about it ----------
const char* refillStatusText(RefillStatus s) {
    switch (s) {
        case RefillStatus::READY: return "READY";
        case RefillStatus::REFILL_MODE: return "REFILL_MODE";
        case RefillStatus::POSITIONING: return "POSITIONING";
        case RefillStatus::WAITING_FOR_REFILL: return "WAITING_FOR_REFILL";
        case RefillStatus::SAVING_INVENTORY: return "SAVING_INVENTORY";
        case RefillStatus::COMPLETED: return "COMPLETED";
        case RefillStatus::CANCELLED: return "CANCELLED";
        case RefillStatus::ERROR: return "ERROR";
    }
    return "ERROR";
}

const char* refillErrorText(RefillError e) {
    switch (e) {
        case RefillError::NONE: return "NONE";
        case RefillError::NOT_IDLE: return "NOT_IDLE";
        case RefillError::BAD_RING: return "BAD_RING";
        case RefillError::RING_FULL: return "RING_FULL";
        case RefillError::CARTRIDGE_BUSY: return "CARTRIDGE_BUSY";
        case RefillError::WRONG_STATE: return "WRONG_STATE";
        case RefillError::BAD_AMOUNT: return "BAD_AMOUNT";
        case RefillError::MOVE_REFUSED: return "MOVE_REFUSED";
        case RefillError::STORE_FAILED: return "STORE_FAILED";
        case RefillError::TIMEOUT: return "TIMEOUT";
    }
    return "NONE";
}

// The refill borrows the cartridge: the moves the page asks for before the first pill (none when nothing was dispensed),
// then one more for every pill the person confirms. Its status is printed whenever it changes.
class SketchRefillHost : public RefillHost {
public:
    int asked = 0;   // moves of the batch in progress
    bool cartridgeFree() { return turnDoseId == 0 && turner.isBusy() == false; }
    bool moveSlots(int count) {
        asked = count;
        return turner.start(count);
    }
    bool moveDone() { return turner.getPillsDone() >= asked; }   // finished moves, not a finished hold
    int ringPills(int r) { return schedule.ringPills((Color)r); }
    bool storePills(int r, int pills) {
        if (schedule.setRingPills((Color)r, pills) == false) {
            return false;
        }
        persist();
        return true;
    }
    int cartridgeSlot() { return turner.getSlot(); }
};
SketchRefillHost refillHost;
RefillingSystem refill;
static_assert(REFILL_MAX_PILLS == RING_CAPACITY, "the refill limit and the ring capacity must be the same");
RefillStatus refillReported = RefillStatus::READY;

void printRefillStatus() {
    int r = refill.getRefillRing();
    Serial.printf("refill status %s ring %d pills %d", refillStatusText(refill.getRefillStatus()), r, r >= 0 ? refillHost.ringPills(r) : 0);
    if (refill.getRefillStatus() == RefillStatus::WAITING_FOR_REFILL) {
        Serial.printf(" slot %d", refillHost.cartridgeSlot());   // counted by the motor, no sensor has measured it
    }
    Serial.println();
    refillReported = refill.getRefillStatus();
}

void printRefillResult(const char* word) {
    Serial.printf("refill %s ring %d prev %d added %d new %d\n", word, refill.getRefillRing(), refill.getPreviousPills(),
                  refill.getPillsAdded(), refill.getUpdatedPills());
}

void refillCommand(const char* sub, const char* value) {
    bool ok = true;
    if (sub == NULL || strcmp(sub, "status") == 0) {
        printRefillStatus();
        return;
    }
    if (strcmp(sub, "list") == 0) {
        for (int r = 0; r < REFILL_RING_COUNT; r++) {
            Serial.printf("refill ring %d %d %d\n", r, refillHost.ringPills(r), REFILL_MAX_PILLS);
        }
        printRefillStatus();
        return;
    }
    if (strcmp(sub, "request") == 0) {
        ok = refill.requestRefill(value != NULL ? atoi(value) : 0);
    } else if (strcmp(sub, "start") == 0) {
        ok = refill.startRefill(value != NULL ? atoi(value) : 0);   // moves to make before the first pill
    } else if (strcmp(sub, "pill") == 0) {
        ok = refill.pillIn();   // one pill went in: the cartridge turns one move
    } else if (strcmp(sub, "add") == 0 && value != NULL) {
        ok = refill.updateRefillInventory(atoi(value));
        if (ok) {
            printRefillResult("saved");
            printRing();
        }
    } else if (strcmp(sub, "finish") == 0) {
        ok = refill.finishRefill();
        if (ok) {
            printRefillResult("done");
        }
    } else if (strcmp(sub, "cancel") == 0) {
        ok = refill.cancelRefill();
    } else {
        Serial.println("refill list | request <ring> | start [moves] | pill | add <pills> | finish | cancel | status");
        return;
    }
    if (ok == false) {
        Serial.printf("refill error %s\n", refillErrorText(refill.getRefillError()));
    }
}

// runs one command that was typed in the serial monitor or sent by the UI System
void handleCommand(char* line) {
    char* command = strtok(line, " ");
    char* arg1 = strtok(NULL, " ");
    char* arg2 = strtok(NULL, " ");
    char* arg3 = strtok(NULL, " ");
    char* arg4 = strtok(NULL, " ");
    int minutes;
    int pills = 1;

    if (command == NULL) {
        return;
    }

    if (strcmp(command, "help") == 0) {
        Serial.println("time HH:MM | add HH:MM [pills] | rm <id> | clear | save | pills <0-11> | log [clear] | set <deg> <pauseMs> <stepUs> <dir> | list | step | stop");
    } else if (strcmp(command, "time") == 0 && arg1 != NULL && Scheduler::parseTime(arg1, &minutes)) {
        clockBaseSeconds = (uint32_t)minutes * 60;
        clockBaseMs = millis();
        schedule.setClock(clockBaseSeconds);
        printList();
    } else if (strcmp(command, "add") == 0 && arg1 != NULL && Scheduler::parseTime(arg1, &minutes)) {
        if (arg2 != NULL) {
            pills = atoi(arg2);
        }
        AddResult result = schedule.add(RED, minutes, NULL, pills);
        if (result == ADD_OK) {
            Serial.println("added");
        } else if (result == ADD_FULL) {
            Serial.println("schedule full");
        } else if (result == ADD_DUPLICATE) {
            Serial.println("already scheduled");
        } else if (result == ADD_BAD_PILLS) {
            Serial.printf("pills must be 1 to %d\n", MAX_PILLS);
        } else {
            Serial.println("could not add");
        }
    } else if (strcmp(command, "rm") == 0 && arg1 != NULL) {
        // the schedule is deleted: its dose stops at once (pills already out stay counted) and it never comes back
        uint8_t id = (uint8_t)atoi(arg1);
        if (id != 0 && id == turnDoseId) {
            interruptDose(true);
        }
        if (schedule.remove(id)) {
            persist();
            Serial.printf("removed #%d\n", id);
        } else {
            Serial.println("no such dose");
        }
    } else if (strcmp(command, "clear") == 0) {
        if (turnDoseId != 0) {
            interruptDose(true);   // the dose that is turning would lose its entry; the pills already out stay counted
        }
        schedule.clear();
        Serial.println("cleared");
    } else if (strcmp(command, "save") == 0) {
        saveToMemory();
    } else if (strcmp(command, "refill") == 0) {
        refillCommand(arg1, arg2);
    } else if (strcmp(command, "pills") == 0 && arg1 != NULL) {
        // how many pills are in the ring now (after loading or refilling it)
        if (turner.isBusy() || refill.isRefillActive()) {
            Serial.println("the cartridge is turning or being refilled, try again when it is done");
        } else if (schedule.setRingPills(RING, atoi(arg1))) {
            persist();
            printRing();
        } else {
            Serial.printf("pills must be 0 to %d\n", RING_CAPACITY);
        }
    } else if (strcmp(command, "set") == 0 && arg1 != NULL && arg2 != NULL && arg3 != NULL && arg4 != NULL) {
        TurnConfig c = turner.getConfig();
        c.degreesPerPill = atoi(arg1);
        c.pauseUs = (uint32_t)atoi(arg2) * 1000UL;
        c.stepIntervalUs = (uint32_t)atoi(arg3);
        c.direction = atoi(arg4);
        if (c.pauseUs < MIN_PILL_INTERVAL_MS * 1000UL) {
            Serial.println("the time between pills must be at least 5000 ms");
        } else if (turner.setConfig(c)) {
            Serial.println("settings ok");
        } else {
            Serial.println("bad settings (or the cartridge is turning)");
        }
    } else if (strcmp(command, "list") == 0) {
        printList();
    } else if (strcmp(command, "log") == 0) {
        if (arg1 != NULL && strcmp(arg1, "clear") == 0) {
            logClear(store, LOG_ADDRESS);
        }
        printLog();
    } else if (strcmp(command, "step") == 0) {
        // one move to check the motor and its direction
        if (refill.isRefillActive()) {
            Serial.println("a refill is going on");
        } else if (turner.start(1)) {
            turnDoseId = 0;
            testMove = true;
            Serial.println("test move");
        }
    } else if (strcmp(command, "stop") == 0) {
        if (turner.isBusy()) {
            if (refill.getRefillStatus() == RefillStatus::POSITIONING) {
                refill.motorFault();   // the move was cut short, so the position is not known any more
            }
            interruptDose();
            Serial.println("stopped");
        }
    } else {
        Serial.println("unknown command (type help)");
    }
}

// puts the doses of my_schedule.h into the schedule
void loadDefaultDoses() {
    for (unsigned int i = 0; i < MY_DOSE_COUNT; i++) {
        int minutes;
        if (Scheduler::parseTime(MY_DOSES[i].time, &minutes) == false) {
            Serial.printf("bad time in my_schedule.h: %s\n", MY_DOSES[i].time);
        } else if (schedule.add(MY_DOSES[i].color, minutes, NULL, MY_DOSES[i].pills) != ADD_OK) {
            Serial.printf("could not add dose %u from my_schedule.h\n", i + 1);
        }
    }
}

void setup() {
    Serial.begin(115200);
    stepper.begin();
    store.begin();

    // the clock starts at START_TIME until the UI System sets it
    int startMinutes = 8 * 60;
    if (Scheduler::parseTime(START_TIME, &startMinutes) == false) {
        Serial.println("bad START_TIME in my_schedule.h, using 08:00");
    }
    clockBaseSeconds = (uint32_t)startMinutes * 60;
    clockBaseMs = millis();
    schedule.setClock(clockBaseSeconds);

    // the saved schedule and settings from the UI System win over my_schedule.h
    uint8_t scheduleBytes[SCHEDULE_BYTES];
    uint8_t settingsBytes[SETTINGS_BYTES];
    store.read(SCHEDULE_ADDRESS, scheduleBytes, sizeof(scheduleBytes));
    store.read(SETTINGS_ADDRESS, settingsBytes, sizeof(settingsBytes));

    TurnConfig saved = turner.getConfig();
    if (saved.load(settingsBytes, sizeof(settingsBytes))) {
        if (saved.pauseUs < MIN_PILL_INTERVAL_MS * 1000UL) {
            saved.pauseUs = MIN_PILL_INTERVAL_MS * 1000UL;   // settings saved by an older program had a shorter pause
        }
        turner.setConfig(saved);
    }

    if (schedule.load(scheduleBytes, sizeof(scheduleBytes))) {
        Serial.printf("loaded %d saved dose(s)\n", schedule.getCount());
    } else {
        Serial.println("no saved schedule, using my_schedule.h");
        loadDefaultDoses();
    }

    refill.initializeRefillingSystem(&refillHost);   // a restart always comes up READY: an unfinished refill leaves the pill counts as they were
    Serial.println("scheduling system ready (type help)");
    printList();
}

char inputLine[64];
int inputLength = 0;

void loop() {
    // update the schedule once per second, that is plenty for a dose schedule
    uint32_t secondsNow = clockBaseSeconds + (millis() - clockBaseMs) / 1000;
    if (secondsNow != lastSecond) {
        lastSecond = secondsNow;
        schedule.setClock(secondsNow);
    }

    // keep the cartridge turning
    turner.update(micros());

    // the Refilling System follows its own move and its timeout; the board only prints what changed
    refill.update(millis());
    if (refill.getRefillStatus() != refillReported) {
        printRefillStatus();
    }

    // CHECK: If the active dose was deleted, abort the motor
    if (turnDoseId != 0 && turner.isBusy()) {
        const Entry* d = schedule.find(turnDoseId);
        if (d != NULL && d->status == EntryStatus::DELETED) {
            interruptDose();
            Serial.println("dose was deleted - motor stopped");
        }
    }

    // a dose is due and the cartridge is free: start it (never while a refill has the cartridge)
    if (turner.isBusy() == false && refill.isRefillActive() == false) {
        const Entry* d = schedule.due();
        if (d != NULL) {
            uint8_t id = d->id;
            uint16_t scheduled = d->minutes;
            uint8_t needed = d->pills;
            if (schedule.beginTake(id)) {
                turnDoseId = id;
                turnMinutes = scheduled;
                turnStarted = schedule.getClock();
                turnPills = needed;
                turnReported = 0;
                testMove = false;
                Serial.printf("dose start #%d %02d:%02d:00 %d\n", id, scheduled / 60, scheduled % 60, needed);
                turner.start(needed);
            } else {
                // the ring cannot give the whole dose: nothing turns and the dose is not tried again
                reportDoseEnd(id, scheduled, LOG_FINISHED, 0, needed);
                reportFinished(id, scheduled);
            }
        }
    }

    // a pill counts when its move is over, one by one; the dose is complete with its last pill
    while (turnDoseId != 0 && turnReported < turner.getPillsDone()) {
        turnReported++;
        schedule.confirmPill(turnDoseId);
        persist();   // the count must survive a power cut
        Serial.printf("pill #%d %d/%d left %d\n", turnDoseId, turnReported, turnPills, schedule.ringPills(RING));

        if (turnReported >= turnPills) {
            // there is no sensor, so a finished move is the only sign that the pill came out
            uint8_t id = turnDoseId;
            turnDoseId = 0;
            schedule.finishTake(id, VERIFIED);
            reportDoseEnd(id, turnMinutes, LOG_COMPLETED, turnPills, turnPills);
            const Entry* e = schedule.find(id);
            if (e != NULL && schedule.dosesLeft(e) < 1) {
                reportFinished(id, turnMinutes);
            }
            persist();
            printRing();
        }
    }

    // the cartridge has stopped holding its position after the last move
    if (turner.finished()) {
        if (testMove) {
            Serial.println("test move done");
            testMove = false;
        }
    }

    // read the serial monitor, one character at a time
    while (Serial.available()) {
        char c = Serial.read();
        if (c == '\n' || c == '\r') {
            inputLine[inputLength] = '\0';
            if (inputLength > 0) {
                handleCommand(inputLine);
            }
            inputLength = 0;
        } else if (inputLength < 63) {
            inputLine[inputLength] = c;
            inputLength++;
        }
    }
}
