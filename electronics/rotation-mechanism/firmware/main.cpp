// Serial-console test rig for the rotation mechanism on an ESP32-S3 (ASSUMED / NOT_VALIDATED).
// Open a serial monitor at 115200 baud and type "help".
#include <Arduino.h>

#include "config.h"
#include "core/rotation.h"
#include "hw/uln2003_stepper.h"

using namespace dispenser;

static Uln2003Stepper stepper;
static Hall hall;
static RotationConfig config;
static Rotation rotation(stepper, hall, config);

static void printStatus() {
  static const char* const states[] = {"UNHOMED", "HOMING", "IDLE", "MOVING", "FAULT"};
  Serial.printf("state %s  position %ld steps  at %s%s\n", states[rotation.state()], static_cast<long>(rotation.position()),
                colorName(rotation.atStation()), rotation.fault() == FAULT_HOME_NOT_FOUND ? "  (home sensor not found)" : "");
}

static void handle(char* line) {
  char* cmd = strtok(line, " ");
  char* arg = strtok(nullptr, " ");
  Color color;
  if (!cmd) return;
  if (!strcmp(cmd, "help")) {
    Serial.println("home | index <red|blue|green|orange> | status | recover");
  } else if (!strcmp(cmd, "home")) {
    Serial.println(rotation.requestHome() ? "homing" : "refused");
  } else if (!strcmp(cmd, "index") && arg && colorFromName(arg, &color)) {
    Serial.println(rotation.requestIndex(color) ? "indexing" : "refused (home first, or busy)");
  } else if (!strcmp(cmd, "status")) {
    printStatus();
  } else if (!strcmp(cmd, "recover")) {
    rotation.clearFault();
    Serial.println(rotation.requestHome() ? "homing" : "refused");
  } else {
    Serial.println("?  (type help)");
  }
}

void setup() {
  Serial.begin(115200);
  stepper.begin();
  hall.begin();
  Serial.println("rotation mechanism ready (type help)");
}

void loop() {
  static char line[32];
  static uint8_t len = 0;
  static bool wasBusy = false;

  rotation.update(micros());
  if (wasBusy && !rotation.busy()) printStatus();
  wasBusy = rotation.busy();

  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      line[len] = '\0';
      if (len) handle(line);
      len = 0;
    } else if (len < sizeof(line) - 1) {
      line[len++] = c;
    }
  }
}
