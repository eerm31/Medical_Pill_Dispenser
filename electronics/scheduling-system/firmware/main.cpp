// Serial-console test rig for the scheduling system on an ESP32-S3 (ASSUMED / NOT_VALIDATED).
// It runs the real scheduler, rotation and auto-rotate code; the dispenser is a stub that reports VERIFIED after 3 s.
// Open a serial monitor at 115200 baud and type "help".
#include <Arduino.h>
#include <stdlib.h>

#include "config.h"
#include "core/auto_rotate.h"
#include "hw/uln2003_stepper.h"

using namespace dispenser;

// Stand-in for Subsystem 1 (pin, blades, tongue) and Subsystem 3 (verification).
class StubDispenser : public Dispenser {
 public:
  bool start(Color) override { startedMs_ = millis(); running_ = true; return true; }
  bool finished(Verdict* v) override {
    if (!running_ || millis() - startedMs_ < 3000) return false;
    running_ = false;
    *v = VERIFIED;
    return true;
  }
 private:
  uint32_t startedMs_ = 0;
  bool running_ = false;
};

static Uln2003Stepper stepper;
static Hall hall;
static StubDispenser stubDispenser;
static Scheduler schedule;
static RotationConfig rotationConfig;
static Rotation rotation(stepper, hall, rotationConfig);
static AutoRotate autoRotate(schedule, rotation, stubDispenser);

static uint32_t clockBaseMs = 0;       // millis() at the moment the clock was last set
static uint32_t clockBaseSeconds = 8UL * 3600UL;

static void printList() {
  const Entry* list[Scheduler::MAX_ENTRIES];
  uint8_t n = schedule.sorted(list);
  char t[6];
  Scheduler::formatTime(schedule.clock() / 60, t);
  Serial.printf("clock %s  state %s  drum at %s\n", t, autoRotate.stateName(), colorName(rotation.atStation()));
  for (uint8_t i = 0; i < n; i++) {
    Scheduler::formatTime(list[i]->minutes, t);
    Serial.printf("  #%u %s %s %s%s\n", list[i]->id, t, colorName(list[i]->color), Scheduler::statusName(list[i]->status),
                  list[i]->tomorrow ? " (tomorrow)" : "");
  }
}

static void handle(char* line) {
  char* cmd = strtok(line, " ");
  char* a = strtok(nullptr, " ");
  char* b = strtok(nullptr, " ");
  if (!cmd) return;
  uint16_t minutes;
  Color color;
  if (!strcmp(cmd, "help")) {
    Serial.println("time HH:MM | add <colour> HH:MM | rm <id> | list | take | home | index <colour> | recover");
  } else if (!strcmp(cmd, "time") && a && Scheduler::parseTime(a, &minutes)) {
    clockBaseSeconds = minutes * 60UL;
    clockBaseMs = millis();
    schedule.setClock(clockBaseSeconds);
    printList();
  } else if (!strcmp(cmd, "add") && a && b && colorFromName(a, &color) && Scheduler::parseTime(b, &minutes)) {
    static const char* const why[] = {"added", "bad colour", "bad time", "schedule full", "already scheduled"};
    Serial.println(why[schedule.add(color, minutes)]);
  } else if (!strcmp(cmd, "rm") && a) {
    Serial.println(schedule.remove(atoi(a)) ? "removed" : "no such entry");
  } else if (!strcmp(cmd, "list")) {
    printList();
  } else if (!strcmp(cmd, "take")) {
    Serial.println(autoRotate.takePressed() ? "taking" : autoRotate.message());
  } else if (!strcmp(cmd, "home")) {
    Serial.println(rotation.requestHome() ? "homing" : "refused");
  } else if (!strcmp(cmd, "index") && a && colorFromName(a, &color)) {
    Serial.println(rotation.requestIndex(color) ? "indexing" : "refused");
  } else if (!strcmp(cmd, "recover")) {
    autoRotate.recover();
  } else {
    Serial.println("?  (type help)");
  }
}

void setup() {
  Serial.begin(115200);
  stepper.begin();
  hall.begin();
  clockBaseMs = millis();
  autoRotate.begin();
  Serial.println("scheduling system ready (type help)");
}

void loop() {
  static uint32_t lastSecond = 0;
  static char line[48];
  static uint8_t len = 0;

  autoRotate.update(micros());

  uint32_t seconds = clockBaseSeconds + (millis() - clockBaseMs) / 1000;
  if (seconds != lastSecond) {  // once a second is plenty for a dose schedule
    lastSecond = seconds;
    schedule.setClock(seconds);
  }

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
