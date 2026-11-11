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

uint8_t turnDoseId = 0;   // the dose that is being dispensed, 0 for a test move

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
}

// keeps the schedule and the turn settings in the board's memory
void saveToMemory() {
    uint8_t scheduleBytes[SCHEDULE_BYTES];
    uint8_t settingsBytes[SETTINGS_BYTES];

    size_t n = schedule.save(scheduleBytes, sizeof(scheduleBytes));
    store.write(SCHEDULE_ADDRESS, scheduleBytes, n);
    size_t m = turner.getConfig().save(settingsBytes, sizeof(settingsBytes));
    store.write(SETTINGS_ADDRESS, settingsBytes, m);
    Serial.printf("saved %d dose(s)\n", schedule.getCount());
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
        Serial.println("time HH:MM | add HH:MM [pills] | rm <id> | clear | save | set <deg> <pauseMs> <stepUs> <dir> | list | step | stop");
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
        if (schedule.remove(atoi(arg1))) {
            Serial.println("removed");
        } else {
            Serial.println("no such entry");
        }
    } else if (strcmp(command, "clear") == 0) {
        schedule.clear();
        Serial.println("cleared");
    } else if (strcmp(command, "save") == 0) {
        saveToMemory();
    } else if (strcmp(command, "set") == 0 && arg1 != NULL && arg2 != NULL && arg3 != NULL && arg4 != NULL) {
        TurnConfig c = turner.getConfig();
        c.degreesPerPill = atoi(arg1);
        c.pauseUs = (uint32_t)atoi(arg2) * 1000UL;
        c.stepIntervalUs = (uint32_t)atoi(arg3);
        c.direction = atoi(arg4);
        if (turner.setConfig(c)) {
            Serial.println("settings ok");
        } else {
            Serial.println("bad settings (or the cartridge is turning)");
        }
    } else if (strcmp(command, "list") == 0) {
        printList();
    } else if (strcmp(command, "step") == 0) {
        // one move to check the motor and its direction
        if (turner.start(1)) {
            turnDoseId = 0;
            Serial.println("test move");
        }
    } else if (strcmp(command, "stop") == 0) {
        if (turner.isBusy()) {
            turner.stop();
            if (turnDoseId != 0) {
                schedule.abortTake(turnDoseId);   // the dose goes back to DUE and starts again
            }
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
        turner.setConfig(saved);
    }

    if (schedule.load(scheduleBytes, sizeof(scheduleBytes))) {
        Serial.printf("loaded %d saved dose(s)\n", schedule.getCount());
    } else {
        Serial.println("no saved schedule, using my_schedule.h");
        loadDefaultDoses();
    }

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

    // a dose is due and the cartridge is free: start it
    if (turner.isBusy() == false) {
        const Entry* d = schedule.due();
        if (d != NULL && schedule.beginTake(d->id)) {
            Serial.printf("dose #%d: %d pill(s)\n", d->id, d->pills);
            turnDoseId = d->id;
            turner.start(d->pills);
        }
    }

    // the cartridge has finished all the moves of a dose
    if (turner.finished()) {
        if (turnDoseId != 0) {
            // there is no sensor, so we just trust that the pills came out
            schedule.finishTake(turnDoseId, VERIFIED);
            Serial.println("dose done");
        } else {
            Serial.println("test move done");
        }
        turnDoseId = 0;
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
