// rotation-mechanism.ino
// Test program for the rotation mechanism on an Arduino Uno (not tested on a real board yet).
// Open the serial monitor at 115200 baud and type "help".
// The other files in this folder are the rotation code. Arduino IDE builds them together with this file.

#include <string.h>
#include "config.h"
#include "rotation.h"
#include "uln2003_stepper.h"

Uln2003Stepper stepper;
Hall hall;
RotationConfig config;
Rotation rotation(&stepper, &hall, config);

// prints the state of the drum
void printStatus() {
    const char* stateNames[] = {"UNHOMED", "HOMING", "IDLE", "MOVING", "FAULT"};

    Serial.print(F("state "));
    Serial.print(stateNames[rotation.getState()]);
    Serial.print(F("  position "));
    Serial.print(rotation.getPosition());
    Serial.print(F(" steps  at "));
    Serial.println(colorName(rotation.atStation()));

    if (rotation.getFault() == FAULT_HOME_NOT_FOUND) {
        Serial.println(F("fault: home sensor not found"));
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
        Serial.println(F("home | index <red|blue|green|orange> | status | recover"));
    } else if (strcmp(command, "home") == 0) {
        if (rotation.requestHome()) {
            Serial.println(F("homing"));
        } else {
            Serial.println(F("refused"));
        }
    } else if (strcmp(command, "index") == 0 && argument != NULL && colorFromName(argument, &color)) {
        if (rotation.requestIndex(color)) {
            Serial.println(F("indexing"));
        } else {
            Serial.println(F("refused (home first, or busy)"));
        }
    } else if (strcmp(command, "status") == 0) {
        printStatus();
    } else if (strcmp(command, "recover") == 0) {
        rotation.clearFault();
        if (rotation.requestHome()) {
            Serial.println(F("homing"));
        } else {
            Serial.println(F("refused"));
        }
    } else {
        Serial.println(F("unknown command (type help)"));
    }
}

void setup() {
    Serial.begin(115200);
    stepper.begin();
    hall.begin();
    Serial.println(F("rotation mechanism ready (type help)"));
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
