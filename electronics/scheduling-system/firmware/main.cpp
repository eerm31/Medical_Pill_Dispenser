// main.cpp
// Dose schedule for the ESP32-S3 with ONE cartridge, no pin and no sensors (not tested on a real board yet).
// When a scheduled time comes, the stepper spins the cartridge for a few seconds per pill and then stops.
// Open the serial monitor at 115200 baud and type "help".

#include <Arduino.h>
#include <stdlib.h>
#include <string.h>
#include "config.h"
#include "core/schedule.h"
#include "hw/uln2003_stepper.h"
#include "my_schedule.h"

Uln2003Stepper stepper;
Scheduler schedule;

// The clock: seconds since midnight = clockBaseSeconds + the time since the clock was set.
// TODO: replace this with a real RTC.
uint32_t clockBaseMs = 0;
uint32_t clockBaseSeconds = 8 * 3600;
uint32_t lastSecond = 0;

// the cartridge spin
bool spinning = false;
uint32_t spinEndMs = 0;
uint32_t lastStepUs = 0;
uint8_t spinDoseId = 0;   // the dose that is being dispensed, 0 for a test spin

// starts spinning the cartridge for the given time
void startSpin(uint32_t milliseconds, uint8_t doseId) {
    spinning = true;
    spinEndMs = millis() + milliseconds;
    spinDoseId = doseId;
}

// prints the clock and all the doses
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
}

// runs one command that was typed in the serial monitor
void handleCommand(char* line) {
    char* command = strtok(line, " ");
    char* arg1 = strtok(NULL, " ");
    char* arg2 = strtok(NULL, " ");
    int minutes;
    int pills = 1;

    if (command == NULL) {
        return;
    }

    if (strcmp(command, "help") == 0) {
        Serial.println("time HH:MM | add HH:MM [pills] | rm <id> | list | spin | stop");
    } else if (strcmp(command, "time") == 0 && arg1 != NULL && Scheduler::parseTime(arg1, &minutes)) {
        clockBaseSeconds = minutes * 60;
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
    } else if (strcmp(command, "list") == 0) {
        printList();
    } else if (strcmp(command, "spin") == 0) {
        // a 3 second test spin to check the motor
        if (spinning == false) {
            startSpin(3000, 0);
            Serial.println("test spin");
        }
    } else if (strcmp(command, "stop") == 0) {
        if (spinning) {
            spinning = false;
            stepper.release();
            if (spinDoseId != 0) {
                schedule.abortTake(spinDoseId);   // the dose goes back to DUE and starts again
            }
            Serial.println("stopped");
        }
    } else {
        Serial.println("unknown command (type help)");
    }
}

void setup() {
    Serial.begin(115200);
    stepper.begin();

    // set the start time, then load the doses from my_schedule.h
    int startMinutes = 8 * 60;
    if (Scheduler::parseTime(START_TIME, &startMinutes) == false) {
        Serial.println("bad START_TIME in my_schedule.h, using 08:00");
    }
    clockBaseSeconds = startMinutes * 60;
    clockBaseMs = millis();
    schedule.setClock(clockBaseSeconds);

    for (unsigned int i = 0; i < MY_DOSE_COUNT; i++) {
        int minutes;
        if (Scheduler::parseTime(MY_DOSES[i].time, &minutes) == false) {
            Serial.printf("bad time in my_schedule.h: %s\n", MY_DOSES[i].time);
        } else if (schedule.add(MY_DOSES[i].color, minutes, NULL, MY_DOSES[i].pills) != ADD_OK) {
            Serial.printf("could not add dose %u from my_schedule.h\n", i + 1);
        }
    }

    Serial.println("scheduling system ready (type help)");
    printList();
}

char inputLine[48];
int inputLength = 0;

void loop() {
    // update the schedule once per second, that is plenty for a dose schedule
    uint32_t secondsNow = clockBaseSeconds + (millis() - clockBaseMs) / 1000;
    if (secondsNow != lastSecond) {
        lastSecond = secondsNow;
        schedule.setClock(secondsNow);
    }

    // a dose is due and the cartridge is free: start it
    if (spinning == false) {
        const Entry* d = schedule.due();
        if (d != NULL && schedule.beginTake(d->id)) {
            Serial.printf("dose #%d: %d pill(s)\n", d->id, d->pills);
            startSpin(d->pills * SPIN_MS_PER_PILL, d->id);
        }
    }

    // keep the cartridge spinning until the time is over
    if (spinning) {
        if ((int32_t)(millis() - spinEndMs) >= 0) {
            spinning = false;
            stepper.release();
            if (spinDoseId != 0) {
                // there is no sensor, so we just trust that the pills came out
                schedule.finishTake(spinDoseId, VERIFIED);
                Serial.println("dose done");
            } else {
                Serial.println("test spin done");
            }
        } else if (micros() - lastStepUs >= STEP_INTERVAL_US) {
            lastStepUs = micros();
            stepper.step(SPIN_DIRECTION);
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
        } else if (inputLength < 47) {
            inputLine[inputLength] = c;
            inputLength++;
        }
    }
}
