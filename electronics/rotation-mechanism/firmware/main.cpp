// main.cpp
// Test program for the rotation mechanism on the ESP32-S3 (not tested on a real board yet).
// Open the serial monitor at 115200 baud and type "help".

#include <Arduino.h>
#include <string.h>
#include "config.h"
#include "core/rotation.h"
#include "hw/uln2003_stepper.h"

Uln2003Stepper stepper;
Hall hall;
RotationConfig config;
Rotation rotation(&stepper, &hall, config);

// prints the state of the drum
void printStatus() {
    const char* stateNames[] = {"UNHOMED", "HOMING", "IDLE", "MOVING", "FAULT"};

    Serial.printf("state %s  position %d steps  at %s\n",
                  stateNames[rotation.getState()],
                  rotation.getPosition(),
                  colorName(rotation.atStation()));

    if (rotation.getFault() == FAULT_HOME_NOT_FOUND) {
        Serial.println("fault: home sensor not found");
    }
}

// runs one command that was typed in the serial monitor
void handleCommand(char* line) {
    char* command = strtok(line, " ");
    char* argument = strtok(NULL, " ");
    Color color;

    if (command == NULL) {
        return;
    }

    if (strcmp(command, "help") == 0) {
        Serial.println("home | index <red|blue|green|orange> | status | recover");
    } else if (strcmp(command, "home") == 0) {
        if (rotation.requestHome()) {
            Serial.println("homing");
        } else {
            Serial.println("refused");
        }
    } else if (strcmp(command, "index") == 0 && argument != NULL && colorFromName(argument, &color)) {
        if (rotation.requestIndex(color)) {
            Serial.println("indexing");
        } else {
            Serial.println("refused (home first, or busy)");
        }
    } else if (strcmp(command, "status") == 0) {
        printStatus();
    } else if (strcmp(command, "recover") == 0) {
        rotation.clearFault();
        if (rotation.requestHome()) {
            Serial.println("homing");
        } else {
            Serial.println("refused");
        }
    } else {
        Serial.println("unknown command (type help)");
    }
}

void setup() {
    Serial.begin(115200);
    stepper.begin();
    hall.begin();
    Serial.println("rotation mechanism ready (type help)");
}

char inputLine[32];
int inputLength = 0;
bool wasBusy = false;

void loop() {
    // keep the drum moving
    rotation.update(micros());

    // print the status when a move has just finished
    if (wasBusy && rotation.isBusy() == false) {
        printStatus();
    }
    wasBusy = rotation.isBusy();

    // read the serial monitor, one character at a time
    while (Serial.available()) {
        char c = Serial.read();
        if (c == '\n' || c == '\r') {
            inputLine[inputLength] = '\0';
            if (inputLength > 0) {
                handleCommand(inputLine);
            }
            inputLength = 0;
        } else if (inputLength < 31) {
            inputLine[inputLength] = c;
            inputLength++;
        }
    }
}
