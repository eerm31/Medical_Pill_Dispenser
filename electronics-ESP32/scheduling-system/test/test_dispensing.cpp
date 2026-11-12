// test_dispensing.cpp
// Runs the real ESP32 program (firmware/main.cpp) on the laptop with a fake Arduino, a fake clock and a fake EEPROM.
// It plays the example of the requirements: 5 pills in the ring, 2 pills per dose.
// Build and run (from this folder):  make dispensing
// Only the cartridge's pin writes are counted, so "the cartridge did not turn" means "no pin was written".
// This board keeps doses to the minute, so the clock is set to a whole minute and a dose starts at its minute.

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

#include "../firmware/main.cpp"

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

struct Sample {
    uint32_t atUs;
    int ring;
};
std::vector<Sample> samples;   // the ring count after every pass of loop()

void runMs(uint32_t ms) {
    uint32_t end = g_micros + ms * 1000UL;
    while ((int32_t)(end - g_micros) > 0) {
        g_micros += 500;
        loop();
        samples.push_back({g_micros, schedule.ringPills(RED)});
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

std::vector<LoggedLine> linesStarting(const char* prefix, size_t from = 0) {
    std::vector<LoggedLine> found;
    for (size_t i = from; i < Serial.lines.size(); i++) {
        if (Serial.lines[i].text.compare(0, strlen(prefix), prefix) == 0) {
            found.push_back(Serial.lines[i]);
        }
    }
    return found;
}

bool hasLine(const std::string& text, size_t from = 0) {
    for (size_t i = from; i < Serial.lines.size(); i++) {
        if (Serial.lines[i].text == text) {
            return true;
        }
    }
    return false;
}

int ringAt(uint32_t atUs) {
    int ring = -1;
    for (size_t i = 0; i < samples.size() && samples[i].atUs <= atUs; i++) {
        ring = samples[i].ring;
    }
    return ring;
}

void dumpSerial() {
    printf("--- serial output ---\n");
    for (size_t i = 0; i < Serial.lines.size(); i++) {
        printf("%9.3f  %s\n", Serial.lines[i].atUs / 1e6, Serial.lines[i].text.c_str());
    }
}

void requireLines(size_t have, size_t need, int line) {
    if (have < need) {
        printf("FAIL line %d: expected %d lines of output, got %d\n", line, (int)need, (int)have);
        dumpSerial();
        exit(1);
    }
}

int main() {
    setup();

    // ---- the ring starts with 5 pills, dose A at 08:00 and dose B at 20:00 both need 2 pills ----
    command("time 07:59:50");
    command("clear");
    command("add 08:00:00 2");
    command("add 20:00:00 2");
    const Entry* list[MAX_ENTRIES];
    schedule.sorted(list);
    const int A = list[0]->id;
    const int B = list[1]->id;
    command("pills 12");
    CHECK(schedule.ringPills(RED) == 0);   // a new ring is empty until it is refilled, and 12 is refused
    command("pills 5");
    command("save");
    CHECK(schedule.ringPills(RED) == 5);
    CHECK(hasLine("ring 5 READY"));

    // ---- first scheduled dose: 5 -> 4 -> 3, one pill every 5 seconds ----
    size_t mark = Serial.lines.size();
    long pinsBefore = g_pinWrites;
    runMs(90000);
    std::vector<LoggedLine> pills = linesStarting(fmt("pill #%d ", A).c_str(), mark);
    requireLines(pills.size(), 2, __LINE__);
    CHECK(pills[0].text == fmt("pill #%d 1/2 left 4", A));
    CHECK(pills[1].text == fmt("pill #%d 2/2 left 3", A));
    CHECK(hasLine(fmt("dose end #%d 08:00:00 COMPLETED 2/2 left 3", A), mark));
    int32_t gapUs = (int32_t)(pills[1].atUs - pills[0].atUs);
    CHECK(gapUs > 4995000 && gapUs < 5005000);
    std::vector<LoggedLine> start = linesStarting(fmt("dose start #%d ", A).c_str(), mark);
    requireLines(start.size(), 1, __LINE__);
    CHECK(ringAt(start[0].atUs) == 5);
    CHECK(ringAt(pills[0].atUs - 1000) == 5);
    CHECK(ringAt(pills[0].atUs) == 4);
    CHECK(ringAt(pills[1].atUs) == 3);
    CHECK(g_pinWrites - pinsBefore == 682 * 4 + 4);
    CHECK(schedule.dosesLeft(schedule.find(B)) == 1);

    // ---- second scheduled dose: 3 -> 2 -> 1, then FINISHED while the ring is not EMPTY ----
    mark = Serial.lines.size();
    command("time 19:59:50");
    runMs(90000);
    CHECK(hasLine(fmt("dose end #%d 20:00:00 COMPLETED 2/2 left 1", B), mark));
    CHECK(hasLine(fmt("schedule FINISHED #%d 20:00:00", B), mark));
    CHECK(hasLine("ring 1 READY", mark));
    CHECK(schedule.find(B)->status == EntryStatus::FINISHED);

    // ---- next morning: the ring cannot give 2 pills, nothing turns ----
    mark = Serial.lines.size();
    command("time 07:59:50");
    pinsBefore = g_pinWrites;
    runMs(150000);
    CHECK(hasLine(fmt("dose end #%d 08:00:00 FINISHED 0/2 left 1", A), mark));
    CHECK(linesStarting("dose start", mark).size() == 0);
    CHECK(linesStarting("pill", mark).size() == 0);
    CHECK(g_pinWrites == pinsBefore);
    CHECK(schedule.ringPills(RED) == 1);
    CHECK(schedule.find(B)->status == EntryStatus::FINISHED);

    // ---- the state survives a restart ----
    mark = Serial.lines.size();
    command("log");
    CHECK(hasLine("log 3", mark));
    CHECK(hasLine(fmt("log #%d 08:00:00 08:00:00 08:00:05 COMPLETED 2/2", A), mark));
    for (int n = 100; n < 112; n++) {
        LogRecord extra = {(uint8_t)n, LOG_COMPLETED, 1, 1, 0, 0, 0};
        logAdd(store, LOG_ADDRESS, extra);
    }
    CHECK(logCount(store, LOG_ADDRESS) == LOG_MAX);
    LogRecord oldest;
    CHECK(logGet(store, LOG_ADDRESS, 0, &oldest) && oldest.id == 102);
    command("log clear");
    CHECK(logCount(store, LOG_ADDRESS) == 0);

    // ---- the state survives a restart ----
    Scheduler restarted;
    CHECK(restarted.load(EEPROM.bytes + SCHEDULE_ADDRESS, SCHEDULE_BYTES));
    CHECK(restarted.ringPills(RED) == 1);
    CHECK(restarted.find(A)->status == EntryStatus::FINISHED);
    CHECK(restarted.find(B)->status == EntryStatus::FINISHED);

    // ---- a dose stopped part way is INCOMPLETE, never COMPLETED, and does not start again ----
    command("time 06:00:00");
    command("pills 4");
    mark = Serial.lines.size();
    command("time 07:59:50");
    runMs(62000);   // the dose starts after 60 s (the clock is set to 07:59:00) and its first pill is out half a second later
    CHECK(hasLine(fmt("pill #%d 1/2 left 3", A), mark));
    command("stop");
    CHECK(hasLine(fmt("dose end #%d 08:00:00 INCOMPLETE 1/2 left 3", A), mark));
    CHECK(schedule.find(A)->status == EntryStatus::INCOMPLETE);
    long pinsAfterStop = g_pinWrites;
    runMs(20000);
    CHECK(g_pinWrites == pinsAfterStop);

    // ---- the schedule is deleted while its dose is turning: it stops at once and is gone ----
    command("pills 6");
    command("add 22:00:00 2");
    schedule.sorted(list);
    const int F = list[schedule.getCount() - 1]->id;
    mark = Serial.lines.size();
    command("time 21:59:50");
    runMs(62000);
    CHECK(hasLine(fmt("pill #%d 1/2 left 5", F), mark));
    command(fmt("rm %d", F).c_str());
    CHECK(hasLine(fmt("dose end #%d 22:00:00 INCOMPLETE 1/2 left 5", F), mark));
    CHECK(hasLine(fmt("removed #%d", F), mark));
    CHECK(schedule.find(F) == NULL);
    long pinsAfterRemove = g_pinWrites;
    runMs(20000);
    CHECK(g_pinWrites == pinsAfterRemove);
    command("rm 99");
    CHECK(hasLine("no such dose", mark));

    // a dose that has not dropped a pill yet is reported too when its schedule is deleted
    command("add 23:00:00 1");
    schedule.sorted(list);
    const int H = list[schedule.getCount() - 1]->id;
    mark = Serial.lines.size();
    command("time 22:59:50");
    runMs(60100);
    CHECK(hasLine(fmt("dose start #%d 23:00:00 1", H), mark));
    command(fmt("rm %d", H).c_str());
    CHECK(hasLine(fmt("dose end #%d 23:00:00 INCOMPLETE 0/1 left 5", H), mark));

    // ---- EMPTY is about the pills only, and 5 seconds is the shortest time between pills ----
    mark = Serial.lines.size();
    command("pills 0");
    CHECK(hasLine("ring 0 EMPTY", mark));
    command("set 30 1000 1500 1");
    CHECK(hasLine("the time between pills must be at least 5000 ms", mark));
    CHECK(turner.getConfig().pauseUs == 5000000UL);

    printf("%d checks, %d failures\n", checks, failures);
    if (failures > 0) {
        dumpSerial();
    }
    return failures == 0 ? 0 : 1;
}
