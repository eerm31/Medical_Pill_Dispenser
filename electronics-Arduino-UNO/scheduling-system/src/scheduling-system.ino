// scheduling-system.ino
// Dose schedule for an Arduino Uno with ONE cartridge, no pin and no sensors (not tested on a real board yet).
// When a scheduled time comes, the stepper turns the cartridge 30 degrees for every pill of the dose.
// The schedule is set from the UI System page (scheduler-ui/index.html) over USB and kept in the Uno's memory.
// Open the serial monitor at 115200 baud and type "help" if you want to type the commands yourself.
// The other files in this folder are the schedule and rotation code. Arduino IDE builds them together with this file.

#include <stdlib.h>
#include <string.h>
#include "config.h"
#include "schedule.h"
#include "cartridge_turn.h"
#include "uln2003_stepper.h"
#include "eeprom_store.h"
#include "dose_log.h"
#include "RefillingSystem.h"
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
uint32_t clockBaseSeconds = 8UL * 3600;
uint32_t lastSecond = 0;

uint8_t turnDoseId = 0;     // the dose that is being dispensed, 0 when none (or a test move)
uint32_t turnSeconds = 0;   // its scheduled time (a recurring dose moves its own time when it ends)
uint32_t turnStarted = 0;   // the clock when it started
uint8_t turnPills = 0;      // pills the dose needs
uint8_t turnReported = 0;   // pills of the dose already confirmed
bool testMove = false;      // true while a "step" test move is turning

// the time between two pills is never shorter than this
#define MIN_PILL_INTERVAL_MS 5000UL

// The single ring of this board is RED. Its pill count is shared by all doses and only goes down when a pill is confirmed.
#define RING RED

void printTimeText(uint32_t secondsOfDay) {
    char text[9];
    Scheduler::formatTime(secondsOfDay, text);
    Serial.print(text);
}

// EMPTY is about the pills in the ring. A FINISHED dose is a different thing: the ring can still hold pills.
void printRing() {
    int pills = schedule.ringPills(RING);
    Serial.print(F("ring "));
    Serial.print(pills);
    Serial.println(pills == 0 ? F(" EMPTY") : F(" READY"));
}

const __FlashStringHelper* logStatusText(uint8_t status) {
    if (status == LOG_COMPLETED) {
        return F("COMPLETED");
    }
    if (status == LOG_INCOMPLETE) {
        return F("INCOMPLETE");
    }
    if (status == LOG_FAILED) {
        return F("FAILED");
    }
    return F("FINISHED");
}

// "dose end #id HH:MM:SS RESULT done/needed left N": the UI System turns this into a line of the dosage history.
// The event also goes into the log in the board's memory, which keeps only the last LOG_MAX events.
void reportDoseEnd(uint8_t id, uint32_t scheduled, LogStatus status, int done, int needed) {
    uint32_t now = schedule.getClock();
    LogRecord r = {id, (uint8_t)status, (uint8_t)done, (uint8_t)needed, scheduled, status == LOG_FINISHED ? now : turnStarted, now};
    logAdd(store, LOG_ADDRESS, r);

    Serial.print(F("dose end #"));
    Serial.print(id);
    Serial.print(' ');
    printTimeText(scheduled);
    Serial.print(' ');
    Serial.print(logStatusText(status));
    Serial.print(' ');
    Serial.print(done);
    Serial.print('/');
    Serial.print(needed);
    Serial.print(F(" left "));
    Serial.println(schedule.ringPills(RING));
}

// "log N" and then one line per kept event, oldest first
void printLog() {
    Serial.print(F("log "));
    Serial.println(logCount(store, LOG_ADDRESS));
    LogRecord r;
    for (int i = 0; logGet(store, LOG_ADDRESS, i, &r); i++) {
        Serial.print(F("log #"));
        Serial.print(r.id);
        Serial.print(' ');
        printTimeText(r.scheduled);
        Serial.print(' ');
        printTimeText(r.started);
        Serial.print(' ');
        printTimeText(r.ended);
        Serial.print(' ');
        Serial.print(logStatusText(r.status));
        Serial.print(' ');
        Serial.print(r.done);
        Serial.print('/');
        Serial.println(r.needed);
    }
}

void reportFinished(uint8_t id, uint32_t scheduled) {
    Serial.print(F("schedule FINISHED #"));
    Serial.print(id);
    Serial.print(' ');
    printTimeText(scheduled);
    Serial.println();
}

// prints the clock, all the doses and the turn settings (the UI System reads these lines)
void printList() {
    const Entry* list[MAX_ENTRIES];
    int n = schedule.sorted(list);
    char timeText[9];

    Scheduler::formatTime(schedule.getClock(), timeText);
    Serial.print(F("clock "));
    Serial.println(timeText);

    for (int i = 0; i < n; i++) {
        Scheduler::formatTime(list[i]->seconds, timeText);
        Serial.print(F("  #"));
        Serial.print(list[i]->id);
        Serial.print(' ');
        Serial.print(timeText);
        Serial.print(F(" x"));
        Serial.print(list[i]->pills);
        Serial.print(' ');
        Serial.print(Scheduler::statusName(list[i]->status));
        if (list[i]->tomorrow) {
            Serial.print(F(" (tomorrow)"));
        }
        Serial.println();
    }

    TurnConfig c = turner.getConfig();
    Serial.print(F("turn "));
    Serial.print(c.degreesPerPill);
    Serial.print(' ');
    Serial.print((long)(c.pauseUs / 1000));
    Serial.print(' ');
    Serial.print((long)c.stepIntervalUs);
    Serial.print(' ');
    Serial.println(c.direction);
    printRing();
}

// keeps the schedule, the ring count and the turn settings in the Uno's memory (the ring count is stored with the doses)
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
    Serial.print(F("saved "));
    Serial.print(schedule.getCount());
    Serial.println(F(" dose(s)"));
}

// Stops the cartridge. A dose with no pill out goes back to DUE, one with some pills out is INCOMPLETE and never restarts.
void interruptDose(bool dropped = false) {
    turner.stop();
    if (turnDoseId != 0) {
        uint8_t id = turnDoseId;
        turnDoseId = 0;
        schedule.abortTake(id, turnReported);
        if (turnReported > 0 || dropped) {
            reportDoseEnd(id, turnSeconds, LOG_INCOMPLETE, turnReported, turnPills);
        }
    }
    testMove = false;
}

// ---------- the Refilling System: this is all the board program knows about it ----------
const __FlashStringHelper* refillStatusText(RefillStatus s) {
    switch (s) {
        case RefillStatus::READY: return F("READY");
        case RefillStatus::REFILL_MODE: return F("REFILL_MODE");
        case RefillStatus::POSITIONING: return F("POSITIONING");
        case RefillStatus::WAITING_FOR_REFILL: return F("WAITING_FOR_REFILL");
        case RefillStatus::SAVING_INVENTORY: return F("SAVING_INVENTORY");
        case RefillStatus::COMPLETED: return F("COMPLETED");
        case RefillStatus::CANCELLED: return F("CANCELLED");
        case RefillStatus::ERROR: return F("ERROR");
    }
    return F("ERROR");
}

const __FlashStringHelper* refillErrorText(RefillError e) {
    switch (e) {
        case RefillError::NONE: return F("NONE");
        case RefillError::NOT_IDLE: return F("NOT_IDLE");
        case RefillError::BAD_RING: return F("BAD_RING");
        case RefillError::RING_FULL: return F("RING_FULL");
        case RefillError::CARTRIDGE_BUSY: return F("CARTRIDGE_BUSY");
        case RefillError::WRONG_STATE: return F("WRONG_STATE");
        case RefillError::BAD_AMOUNT: return F("BAD_AMOUNT");
        case RefillError::MOVE_REFUSED: return F("MOVE_REFUSED");
        case RefillError::STORE_FAILED: return F("STORE_FAILED");
        case RefillError::TIMEOUT: return F("TIMEOUT");
    }
    return F("NONE");
}

// The refill borrows the cartridge for ONE move; its status is printed whenever it changes.
class SketchRefillHost : public RefillHost {
public:
    bool cartridgeFree() { return turnDoseId == 0 && turner.isBusy() == false; }
    bool moveOneSlot() { return turner.start(1); }
    bool moveDone() { return turner.getPillsDone() >= 1; }   // a finished move, not a finished hold
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
    Serial.print(F("refill status "));
    Serial.print(refillStatusText(refill.getRefillStatus()));
    Serial.print(F(" ring "));
    Serial.print(refill.getRefillRing());
    Serial.print(F(" pills "));
    Serial.print(refill.getRefillRing() >= 0 ? refillHost.ringPills(refill.getRefillRing()) : 0);
    if (refill.getRefillStatus() == RefillStatus::WAITING_FOR_REFILL) {
        Serial.print(F(" slot "));
        Serial.print(refillHost.cartridgeSlot());   // counted by the motor, no sensor has measured it
    }
    Serial.println();
    refillReported = refill.getRefillStatus();
}

void printRefillResult(const __FlashStringHelper* word) {
    Serial.print(F("refill "));
    Serial.print(word);
    Serial.print(F(" ring "));
    Serial.print(refill.getRefillRing());
    Serial.print(F(" prev "));
    Serial.print(refill.getPreviousPills());
    Serial.print(F(" added "));
    Serial.print(refill.getPillsAdded());
    Serial.print(F(" new "));
    Serial.println(refill.getUpdatedPills());
}

void refillCommand(const char* sub, const char* value) {
    bool ok = true;
    if (sub == NULL || strcmp(sub, "status") == 0) {
        printRefillStatus();
        return;
    }
    if (strcmp(sub, "list") == 0) {
        for (int r = 0; r < REFILL_RING_COUNT; r++) {
            Serial.print(F("refill ring "));
            Serial.print(r);
            Serial.print(' ');
            Serial.print(refillHost.ringPills(r));
            Serial.print(' ');
            Serial.println(REFILL_MAX_PILLS);
        }
        printRefillStatus();
        return;
    }
    if (strcmp(sub, "request") == 0) {
        ok = refill.requestRefill(value != NULL ? atoi(value) : 0);
    } else if (strcmp(sub, "start") == 0) {
        ok = refill.startRefill();
    } else if (strcmp(sub, "add") == 0 && value != NULL) {
        ok = refill.updateRefillInventory(atoi(value));
        if (ok) {
            printRefillResult(F("saved"));
            printRing();
        }
    } else if (strcmp(sub, "finish") == 0) {
        ok = refill.finishRefill();
        if (ok) {
            printRefillResult(F("done"));
        }
    } else if (strcmp(sub, "cancel") == 0) {
        ok = refill.cancelRefill();
    } else {
        Serial.println(F("refill list | request <ring> | start | add <pills> | finish | cancel | status"));
        return;
    }
    if (ok == false) {
        Serial.print(F("refill error "));
        Serial.println(refillErrorText(refill.getRefillError()));
    }
}

// runs one command that was typed in the serial monitor or sent by the UI System
void handleCommand(char* line) {
    char* command = strtok(line, " ");
    char* arg1 = strtok(NULL, " ");
    char* arg2 = strtok(NULL, " ");
    char* arg3 = strtok(NULL, " ");
    char* arg4 = strtok(NULL, " ");
    int pills = 1;

    if (command == NULL) {
        return;
    }

    if (strcmp(command, "help") == 0) {
        Serial.println(F("time HH:MM:SS | add HH:MM:SS [pills] | rm <id> | clear | save | pills <0-11> | log [clear] | set <deg> <pauseMs> <stepUs> <dir> | list | step | stop"));
    } else if (strcmp(command, "time") == 0 && arg1 != NULL) {
        uint32_t sec;
        if (Scheduler::parseTime(arg1, &sec)) {
            clockBaseSeconds = sec;
            clockBaseMs = millis();
            schedule.setClock(clockBaseSeconds);
            printList();
        } else {
            Serial.println(F("bad time format, use HH:MM:SS or HH:MM"));
        }
    } else if (strcmp(command, "add") == 0 && arg1 != NULL) {
        uint32_t sec;
        uint32_t recur = 0;
        if (Scheduler::parseTime(arg1, &sec)) {
            if (arg2 != NULL) {
                pills = atoi(arg2);
            }
            if (arg3 != NULL) {
                recur = (uint32_t)atoi(arg3);
            }
            AddResult result = schedule.add(RED, sec, NULL, pills, recur);
            if (result == ADD_OK) {
                Serial.println(F("added"));
            } else if (result == ADD_FULL) {
                Serial.println(F("schedule full"));
            } else if (result == ADD_DUPLICATE) {
                Serial.println(F("already scheduled"));
            } else if (result == ADD_BAD_PILLS) {
                Serial.print(F("pills must be 1 to "));
                Serial.println(MAX_PILLS);
            } else {
                Serial.println(F("could not add"));
            }
        } else {
            Serial.println(F("bad time format, use HH:MM:SS or HH:MM"));

        }
    } else if (strcmp(command, "rm") == 0 && arg1 != NULL) {
        // the schedule is deleted: its dose stops at once (pills already out stay counted) and it never comes back
        uint8_t id = (uint8_t)atoi(arg1);
        if (id != 0 && id == turnDoseId) {
            interruptDose(true);
        }
        if (schedule.remove(id)) {
            persist();
            Serial.print(F("removed #"));
            Serial.println(id);
        } else {
            Serial.println(F("no such dose"));
        }
    } else if (strcmp(command, "clear") == 0) {
        if (turnDoseId != 0) {
            interruptDose(true);   // the dose that is turning would lose its entry; the pills already out stay counted
        }
        schedule.clear();
        Serial.println(F("cleared"));
    } else if (strcmp(command, "save") == 0) {
        saveToMemory();
    } else if (strcmp(command, "refill") == 0) {
        refillCommand(arg1, arg2);
    } else if (strcmp(command, "pills") == 0 && arg1 != NULL) {
        // how many pills are in the ring now (after loading or refilling it)
        if (turner.isBusy() || refill.isRefillActive()) {
            Serial.println(F("the cartridge is turning or being refilled, try again when it is done"));
        } else if (schedule.setRingPills(RING, atoi(arg1))) {
            persist();
            printRing();
        } else {
            Serial.print(F("pills must be 0 to "));
            Serial.println(RING_CAPACITY);
        }
    } else if (strcmp(command, "set") == 0 && arg1 != NULL && arg2 != NULL && arg3 != NULL && arg4 != NULL) {
        TurnConfig c = turner.getConfig();
        c.degreesPerPill = atoi(arg1);
        c.pauseUs = (uint32_t)atoi(arg2) * 1000UL;
        c.stepIntervalUs = (uint32_t)atoi(arg3);
        c.direction = atoi(arg4);
        if (c.pauseUs < MIN_PILL_INTERVAL_MS * 1000UL) {
            Serial.println(F("the time between pills must be at least 5000 ms"));
        } else if (turner.setConfig(c)) {
            Serial.println(F("settings ok"));
        } else {
            Serial.println(F("bad settings (or the cartridge is turning)"));
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
            Serial.println(F("a refill is going on"));
        } else if (turner.start(1)) {
            turnDoseId = 0;
            testMove = true;
            Serial.println(F("test move"));
        }
    } else if (strcmp(command, "stop") == 0) {
        if (turner.isBusy()) {
            if (refill.getRefillStatus() == RefillStatus::POSITIONING) {
                refill.motorFault();   // the move was cut short, so the position is not known any more
            }
            interruptDose();
            Serial.println(F("stopped"));
        }
    } else {
        Serial.println(F("unknown command (type help)"));
    }
}

// puts the doses of my_schedule.h into the schedule
void loadDefaultDoses() {
    for (unsigned int i = 0; i < MY_DOSE_COUNT; i++) {
        uint32_t doseSeconds;
        if (Scheduler::parseTime(MY_DOSES[i].time, &doseSeconds) == false) {
            Serial.print(F("bad time in my_schedule.h: "));
            Serial.println(MY_DOSES[i].time);
        } else if (schedule.add(MY_DOSES[i].color, doseSeconds, NULL, MY_DOSES[i].pills, MY_DOSES[i].recur_interval) != ADD_OK) {
            Serial.print(F("could not add dose "));
            Serial.println(i + 1);
        }
    }
}

void setup() {
    Serial.begin(115200);
    stepper.begin();
    store.begin();

    // the clock starts at START_TIME until the UI System sets it
    uint32_t startSeconds = 8UL * 3600;  // 08:00:00
    if (Scheduler::parseTime(START_TIME, &startSeconds) == false) {
        Serial.println(F("bad START_TIME in my_schedule.h, using 08:00:00"));
    }
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
            saved.pauseUs = MIN_PILL_INTERVAL_MS * 1000UL;   // settings saved by an older sketch had a shorter pause
        }
        turner.setConfig(saved);
    }

    if (schedule.load(scheduleBytes, sizeof(scheduleBytes))) {
        Serial.print(F("loaded "));
        Serial.print(schedule.getCount());
        Serial.println(F(" saved dose(s)"));
    } else {
        Serial.println(F("no saved schedule, using my_schedule.h"));
        loadDefaultDoses();
    }

    refill.initializeRefillingSystem(&refillHost);   // a restart always comes up READY: an unfinished refill leaves the pill counts as they were
    Serial.println(F("scheduling system ready (type help)"));
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
        if (d != NULL && d->status == DELETED) {
            interruptDose();
            Serial.println(F("dose was deleted - motor stopped"));
        }
    }

    // a dose is due and the cartridge is free: start it (never while a refill has the cartridge)
    if (turner.isBusy() == false && refill.isRefillActive() == false) {
        const Entry* d = schedule.due();
        if (d != NULL) {
            uint8_t id = d->id;
            uint32_t scheduled = d->seconds;
            uint8_t needed = d->pills;
            if (schedule.beginTake(id)) {
                turnDoseId = id;
                turnSeconds = scheduled;
                turnStarted = schedule.getClock();
                turnPills = needed;
                turnReported = 0;
                testMove = false;
                Serial.print(F("dose start #"));
                Serial.print(id);
                Serial.print(' ');
                printTimeText(scheduled);
                Serial.print(' ');
                Serial.println(needed);
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
        Serial.print(F("pill #"));
        Serial.print(turnDoseId);
        Serial.print(' ');
        Serial.print(turnReported);
        Serial.print('/');
        Serial.print(turnPills);
        Serial.print(F(" left "));
        Serial.println(schedule.ringPills(RING));

        if (turnReported >= turnPills) {
            // there is no sensor, so a finished move is the only sign that the pill came out
            uint8_t id = turnDoseId;
            turnDoseId = 0;
            schedule.finishTake(id, VERIFIED);
            reportDoseEnd(id, turnSeconds, LOG_COMPLETED, turnPills, turnPills);
            const Entry* e = schedule.find(id);
            if (e != NULL && schedule.dosesLeft(e) < 1) {
                reportFinished(id, turnSeconds);
            }
            persist();
            printRing();
        }
    }

    // the cartridge has stopped holding its position after the last move
    if (turner.finished()) {
        if (testMove) {
            Serial.println(F("test move done"));
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
