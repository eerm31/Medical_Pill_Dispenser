// test_dispensing.cpp
// Runs the real Uno sketch (src/scheduling-system.ino) on the laptop with a fake Arduino, a fake clock and a fake EEPROM.
// It plays the example of the requirements: 5 pills in the ring, 2 pills per dose.
// Build and run (from this folder):  make dispensing
// Only the cartridge's pin writes are counted, so "the cartridge did not turn" means "no pin was written".

#include <stdio.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string>
#include <vector>
#include "Arduino.h"
#include "EEPROM.h"

uint32_t g_micros = 0;
long g_pinWrites = 0;
HostSerial Serial;
HostEeprom EEPROM;

#include "../../src/scheduling-system.ino"

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

// runs the sketch for some milliseconds of fake time, one pass every 500 microseconds
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

// finished lines of output that start with the text, from line number "from" on
std::vector<LoggedLine> linesStarting(const char* prefix, size_t from = 0) {
    std::vector<LoggedLine> found;
    for (size_t i = from; i < Serial.lines.size(); i++) {
        if (Serial.lines[i].text.compare(0, strlen(prefix), prefix) == 0) {
            found.push_back(Serial.lines[i]);
        }
    }
    return found;
}

bool hasLine(const char* text, size_t from = 0) {
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

const Entry* entry(uint8_t id) {
    return schedule.find(id);
}

void dumpSerial() {
    printf("--- serial output ---\n");
    for (size_t i = 0; i < Serial.lines.size(); i++) {
        printf("%9.3f  %s\n", Serial.lines[i].atUs / 1e6, Serial.lines[i].text.c_str());
    }
}

// stops the test when the lines needed for the next checks are not there
void requireLines(size_t have, size_t need, int line) {
    if (have < need) {
        printf("FAIL line %d: expected %d lines of output, got %d\n", line, (int)need, (int)have);
        dumpSerial();
        exit(1);
    }
}

// printf-style text, so the expected lines can carry the ids the sketch gave the doses
std::string fmt(const char* format, ...) {
    char buffer[96];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    return buffer;
}

int main() {
    setup();
    CHECK(turner.getConfig().pauseUs == 1000000UL);   // the pills of a dose follow each other 1 s apart
    command("set 30 5000 1500 1");   // the scenarios below were written for one pill every 5 s

    // ---- the ring starts with 5 pills, dose A at 08:00 and dose B at 20:00 both need 2 pills ----
    command("time 07:59:50");
    command("clear");
    command("add 08:00:00 2");
    command("add 20:00:00 2");
    const Entry* list[MAX_ENTRIES];
    schedule.sorted(list);
    const int A = list[0]->id;   // 08:00:00
    const int B = list[1]->id;   // 20:00:00
    command("pills 12");   // more than a ring holds
    CHECK(schedule.ringPills(RED) == 0);   // a new ring is empty until it is refilled, and 12 is refused
    command("pills -1");
    CHECK(schedule.ringPills(RED) == 0);
    command("pills 5");
    command("save");
    CHECK(schedule.ringPills(RED) == 5);
    CHECK(hasLine("ring 5 READY"));

    // ---- first scheduled dose: 2 pills, the ring goes 5 -> 4 -> 3, one pill every 5 seconds ----
    size_t mark = Serial.lines.size();
    long pinsBefore = g_pinWrites;
    runMs(40000);   // the clock reaches 08:00:00 after 10 seconds

    std::vector<LoggedLine> pills = linesStarting(fmt("pill #%d ", A).c_str(), mark);
    requireLines(pills.size(), 2, __LINE__);
    CHECK(pills[0].text == fmt("pill #%d 1/2 left 4", A));
    CHECK(pills[1].text == fmt("pill #%d 2/2 left 3", A));
    CHECK(hasLine(fmt("dose start #%d 08:00:00 2", A).c_str(), mark));
    CHECK(hasLine(fmt("dose end #%d 08:00:00 COMPLETED 2/2 left 3", A).c_str(), mark));
    CHECK(schedule.ringPills(RED) == 3);
    CHECK(entry(A)->status == TAKEN);

    // the 5 second interval between two pills of the same dose (the pill comes out when its move ends)
    int32_t gapUs = (int32_t)(pills[1].atUs - pills[0].atUs);
    CHECK(gapUs > 4995000 && gapUs < 5005000);

    // the count only goes down when a pill is confirmed, not when the dose or the move starts
    std::vector<LoggedLine> start = linesStarting(fmt("dose start #%d ", A).c_str(), mark);
    requireLines(start.size(), 1, __LINE__);
    CHECK(ringAt(start[0].atUs) == 5);
    CHECK(ringAt(pills[0].atUs - 1000) == 5);
    CHECK(ringAt(pills[0].atUs) == 4);
    CHECK(ringAt(pills[1].atUs - 1000) == 4);
    CHECK(ringAt(pills[1].atUs) == 3);

    // 2 moves of 30 degrees = 682 half-steps of 4 pin writes, and 4 writes to switch the coils off
    CHECK(g_pinWrites - pinsBefore == 682 * 4 + 4);

    // one complete dose is still possible (3 pills, 2 per dose)
    CHECK(schedule.dosesLeft(entry(B)) == 1);
    CHECK(entry(B)->status == PENDING);

    // ---- second scheduled dose, 08:00 PM: 3 -> 2 -> 1, and then no complete dose is left ----
    mark = Serial.lines.size();
    command("time 19:59:50");
    runMs(40000);
    CHECK(hasLine(fmt("pill #%d 1/2 left 2", B).c_str(), mark));
    CHECK(hasLine(fmt("pill #%d 2/2 left 1", B).c_str(), mark));
    CHECK(hasLine(fmt("dose end #%d 20:00:00 COMPLETED 2/2 left 1", B).c_str(), mark));
    CHECK(hasLine(fmt("schedule FINISHED #%d 20:00:00", B).c_str(), mark));
    CHECK(schedule.ringPills(RED) == 1);
    CHECK(entry(B)->status == FINISHED);
    CHECK(hasLine("ring 1 READY", mark));   // FINISHED, but the ring is not EMPTY

    // ---- next morning: dose A comes due, the ring cannot give 2 pills, so nothing turns at all ----
    mark = Serial.lines.size();
    command("time 07:59:50");
    CHECK(entry(A)->status == PENDING);   // a new day starts again
    CHECK(entry(B)->status == FINISHED);  // but a finished dose stays finished
    pinsBefore = g_pinWrites;
    runMs(60000);
    CHECK(hasLine(fmt("dose end #%d 08:00:00 FINISHED 0/2 left 1", A).c_str(), mark));
    CHECK(hasLine(fmt("schedule FINISHED #%d 08:00:00", A).c_str(), mark));
    CHECK(linesStarting("dose start", mark).size() == 0);
    CHECK(linesStarting("pill", mark).size() == 0);
    CHECK(g_pinWrites == pinsBefore);   // no rotation to look for a pill
    CHECK(schedule.ringPills(RED) == 1);   // the leftover pill stays
    CHECK(entry(A)->status == FINISHED);

    // ---- the board logs the 3 dose events in its memory, oldest first ----
    mark = Serial.lines.size();
    command("log");
    CHECK(hasLine("log 3", mark));
    CHECK(hasLine(fmt("log #%d 08:00:00 08:00:00 08:00:05 COMPLETED 2/2", A).c_str(), mark));
    CHECK(hasLine(fmt("log #%d 20:00:00 20:00:00 20:00:05 COMPLETED 2/2", B).c_str(), mark));
    CHECK(hasLine(fmt("log #%d 08:00:00 08:00:00 08:00:00 FINISHED 0/2", A).c_str(), mark));

    // ---- only the last 10 events are kept: older ones are overwritten ----
    for (int n = 100; n < 112; n++) {
        LogRecord extra = {(uint8_t)n, LOG_COMPLETED, 1, 1, 0, 0, 0};
        logAdd(store, LOG_ADDRESS, extra);
    }
    CHECK(logCount(store, LOG_ADDRESS) == LOG_MAX);
    LogRecord oldest, newest;
    CHECK(logGet(store, LOG_ADDRESS, 0, &oldest) && oldest.id == 102);
    CHECK(logGet(store, LOG_ADDRESS, 9, &newest) && newest.id == 111);
    CHECK(logGet(store, LOG_ADDRESS, 10, &newest) == false);
    command("log clear");
    CHECK(logCount(store, LOG_ADDRESS) == 0);

    // it stays quiet afterwards, also across another midnight
    mark = Serial.lines.size();
    command("time 23:59:50");
    runMs(30000);
    command("time 00:00:10");
    command("time 07:59:50");
    runMs(60000);
    CHECK(linesStarting("dose", mark).size() == 0);
    CHECK(g_pinWrites == pinsBefore);
    CHECK(schedule.ringPills(RED) == 1);

    // ---- the saved state survives a restart: 1 pill in the ring, both doses FINISHED ----
    Scheduler restarted;
    CHECK(restarted.load(EEPROM.bytes + SCHEDULE_ADDRESS, SCHEDULE_BYTES));
    CHECK(restarted.ringPills(RED) == 1);
    CHECK(restarted.find(A)->status == FINISHED);
    CHECK(restarted.find(B)->status == FINISHED);

    // ---- a refill gives the finished doses their turn again (the clock is before 08:00 so nothing starts at once) ----
    command("time 06:00:00");
    command("pills 4");
    CHECK(entry(A)->status == PENDING);
    CHECK(entry(B)->status == PENDING);
    CHECK(schedule.dosesLeft(entry(A)) == 2);

    // ---- a dose that is stopped part way is INCOMPLETE, never COMPLETED, and does not start again ----
    mark = Serial.lines.size();
    command("time 07:59:55");
    runMs(6500);   // dose A starts at 08:00:00 and its first pill is out after about half a second
    CHECK(hasLine(fmt("pill #%d 1/2 left 3", A).c_str(), mark));
    command("stop");
    CHECK(hasLine(fmt("dose end #%d 08:00:00 INCOMPLETE 1/2 left 3", A).c_str(), mark));
    CHECK(entry(A)->status == INCOMPLETE);
    CHECK(schedule.ringPills(RED) == 3);
    long pinsAfterStop = g_pinWrites;
    runMs(20000);
    CHECK(g_pinWrites == pinsAfterStop);   // it does not try again
    CHECK(linesStarting(fmt("dose end #%d 08:00:00 COMPLETED", A).c_str(), mark).size() == 0);

    // ---- the computer sets the clock back while dose B is turning: the dose carries on and every pill is counted ----
    mark = Serial.lines.size();
    command("time 19:59:55");
    runMs(6500);
    CHECK(hasLine(fmt("pill #%d 1/2 left 2", B).c_str(), mark));
    command("time 19:59:50");
    runMs(12000);
    CHECK(hasLine(fmt("pill #%d 2/2 left 1", B).c_str(), mark));
    CHECK(hasLine(fmt("dose end #%d 20:00:00 COMPLETED 2/2 left 1", B).c_str(), mark));
    CHECK(schedule.ringPills(RED) == 1);

    // ---- the schedule is replaced while a dose is turning: it stops, the pill that is out stays counted ----
    command("pills 6");
    command("add 21:00:00 2");
    schedule.sorted(list);
    const int C = list[schedule.getCount() - 1]->id;   // 21:00:00 is the latest
    mark = Serial.lines.size();
    command("time 20:59:55");
    runMs(6500);
    CHECK(hasLine(fmt("pill #%d 1/2 left 5", C).c_str(), mark));
    command("clear");
    CHECK(hasLine(fmt("dose end #%d 21:00:00 INCOMPLETE 1/2 left 5", C).c_str(), mark));
    CHECK(schedule.ringPills(RED) == 5);
    CHECK(schedule.getCount() == 0);

    // ---- EMPTY is about the pills only ----
    mark = Serial.lines.size();
    command("add 22:00:00 2");
    command("pills 0");
    CHECK(hasLine("ring 0 EMPTY", mark));
    command("pills -1");
    CHECK(schedule.ringPills(RED) == 0);

    // ---- the schedule is deleted while its dose is turning: it stops at once and is gone ----
    command("pills 6");
    schedule.sorted(list);
    const int F = list[0]->id;   // the 22:00:00 dose added above
    mark = Serial.lines.size();
    command("time 21:59:55");
    runMs(6500);
    CHECK(hasLine(fmt("pill #%d 1/2 left 5", F).c_str(), mark));
    command(fmt("rm %d", F).c_str());
    CHECK(hasLine(fmt("dose end #%d 22:00:00 INCOMPLETE 1/2 left 5", F).c_str(), mark));
    CHECK(hasLine(fmt("removed #%d", F).c_str(), mark));
    CHECK(schedule.getCount() == 0);
    CHECK(schedule.ringPills(RED) == 0 && hasLine("ring 0 EMPTY", mark));   // the last schedule is gone: the ring starts from empty
    command("pills 5");
    long pinsAfterRemove = g_pinWrites;
    runMs(20000);
    CHECK(g_pinWrites == pinsAfterRemove);
    command("rm 99");
    CHECK(hasLine("no such dose", mark));

    // a schedule that has not started yet is removed and never dispenses
    command("add 22:10:00 1");
    schedule.sorted(list);
    const int G = list[0]->id;
    command(fmt("rm %d", G).c_str());
    command("pills 5");
    mark = Serial.lines.size();
    command("time 22:09:55");
    runMs(20000);
    CHECK(linesStarting("dose start", mark).size() == 0);
    CHECK(g_pinWrites == pinsAfterRemove);

    // a dose that has not dropped a pill yet is reported too when its schedule is deleted
    command("add 23:00:00 1");
    schedule.sorted(list);
    const int H = list[0]->id;
    mark = Serial.lines.size();
    command("time 22:59:55");
    runMs(5100);
    CHECK(hasLine(fmt("dose start #%d 23:00:00 1", H).c_str(), mark));
    command(fmt("rm %d", H).c_str());
    CHECK(hasLine(fmt("dose end #%d 23:00:00 INCOMPLETE 0/1 left 5", H).c_str(), mark));
    CHECK(schedule.ringPills(RED) == 0);

    // ---- a repeating dose turns all its pills in a row (1 s apart); its interval counts from the last pill ----
    command("set 30 1000 1500 1");
    command("clear");
    command("pills 11");
    command("add 06:00:00 3 7");
    schedule.sorted(list);
    const int R = list[0]->id;
    mark = Serial.lines.size();
    command("time 05:59:55");
    runMs(25000);
    std::vector<LoggedLine> rp = linesStarting(fmt("pill #%d ", R).c_str(), mark);
    requireLines(rp.size(), 6, __LINE__);
    CHECK(rp[1].atUs - rp[0].atUs > 900000UL && rp[1].atUs - rp[0].atUs < 1100000UL);
    CHECK(rp[2].atUs - rp[1].atUs > 900000UL && rp[2].atUs - rp[1].atUs < 1100000UL);
    CHECK(rp[3].atUs - rp[2].atUs > 6500000UL && rp[3].atUs - rp[2].atUs < 7500000UL);   // 7 s, not 10
    CHECK(rp[4].atUs - rp[3].atUs > 900000UL && rp[4].atUs - rp[3].atUs < 1100000UL);
    command("clear");

    // ---- the time between pills cannot be set below 1 second ----
    mark = Serial.lines.size();
    command("set 30 999 1500 1");
    CHECK(hasLine("the time between pills must be at least 1000 ms", mark));
    CHECK(turner.getConfig().pauseUs == 1000000UL);

    // ---- a restart replaces the old 5 s pause that an earlier sketch saved in memory ----
    command("set 30 5000 1500 1");
    command("save");
    setup();
    CHECK(turner.getConfig().pauseUs == 1000000UL);

    printf("%d checks, %d failures\n", checks, failures);
    if (failures > 0) {
        dumpSerial();
    }
    return failures == 0 ? 0 : 1;
}
