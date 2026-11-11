// test_main.cpp
// Tests for the rotation mechanism. They run on the laptop, no Arduino and no hardware needed.
// Build and run with: make

#include <stdio.h>
#include "fake_drive.h"

int failures = 0;
int checks = 0;

// Counts every check and prints a message when one fails.
#define CHECK(cond) \
    do { \
        checks++; \
        if (!(cond)) { \
            failures++; \
            printf("FAIL %s line %d: %s\n", __FILE__, __LINE__, #cond); \
        } \
    } while (0)

// Keeps calling update() with a growing clock until the drum stops. Returns false if it never stops.
bool runUntilIdle(Rotation& r) {
    int i;
    for (i = 0; i < 400000 && r.isBusy(); i++) {
        clockUs = clockUs + 200;
        r.update(clockUs);
    }
    return r.isBusy() == false;
}

// ---------- tests ----------

void testPlanner() {
    int seg[2];
    int n = 4096;
    int q = 1024;       // a quarter turn
    int over = 34;      // 3 degrees

    // station positions
    CHECK(Rotation::stationSteps(RED, n) == 0);
    CHECK(Rotation::stationSteps(BLUE, n) == q);
    CHECK(Rotation::stationSteps(GREEN, n) == 2 * q);
    CHECK(Rotation::stationSteps(ORANGE, n) == 3 * q);

    // already there: no move
    CHECK(Rotation::planIndex(0, 0, n, over, true, seg) == 0);

    // red -> blue is a quarter turn counter-clockwise, one piece
    CHECK(Rotation::planIndex(0, q, n, over, true, seg) == 1);
    CHECK(seg[0] == q);

    // red -> orange is shorter clockwise, so it goes past and comes back
    CHECK(Rotation::planIndex(0, 3 * q, n, over, true, seg) == 2);
    CHECK(seg[0] == -q - over);
    CHECK(seg[1] == over);

    // the same move when the direction does not matter: one clockwise piece
    CHECK(Rotation::planIndex(0, 3 * q, n, over, false, seg) == 1);
    CHECK(seg[0] == -q);

    // exactly half a turn goes counter-clockwise
    CHECK(Rotation::planIndex(0, 2 * q, n, over, true, seg) == 1);
    CHECK(seg[0] == 2 * q);

    // blue -> red is clockwise, two pieces that add up to a quarter turn back
    CHECK(Rotation::planIndex(q, 0, n, over, true, seg) == 2);
    CHECK(seg[0] + seg[1] == -q);
}

void testHomeAndIndex() {
    RotationConfig cfg;
    FakeDrive drive(4096, 1500, 3000, 57);   // the drum starts somewhere, the magnet is at step 3000
    Rotation rot(&drive, &drive, cfg);
    int offset = (int)(cfg.homeOffsetDeg * 4096 / 360.0f + 0.5f);

    // before homing the drum does not know where it is
    CHECK(rot.getState() == ROT_UNHOMED);
    CHECK(rot.requestIndex(BLUE) == false);

    // start homing
    CHECK(rot.requestHome());
    CHECK(rot.getState() == ROT_HOMING);
    CHECK(rot.requestHome() == false);   // already busy

    CHECK(runUntilIdle(rot));
    CHECK(rot.getState() == ROT_IDLE);
    CHECK(rot.getPosition() == 0);
    CHECK(drive.phys == drive.redPosition(offset));
    CHECK(rot.atStation() == RED);
    CHECK(drive.released);

    // go from every station to every station
    int from;
    int to;
    for (from = 0; from < 4; from++) {
        for (to = 0; to < 4; to++) {
            CHECK(rot.requestIndex((Color)from));
            CHECK(runUntilIdle(rot));
            CHECK(rot.requestIndex((Color)to));
            CHECK(runUntilIdle(rot));

            CHECK(rot.atStation() == (Color)to);
            // the real drum has to be exactly on the station
            CHECK(drive.phys == (drive.redPosition(offset) + to * 1024) % 4096);
            if (from != to) {
                CHECK(drive.lastDir == 1);   // the last step is always counter-clockwise
            }
        }
    }
}

void testHomeFromOnTheMagnetAndFault() {
    RotationConfig cfg;
    int offset = (int)(cfg.homeOffsetDeg * 4096 / 360.0f + 0.5f);

    // the drum starts right on the magnet
    FakeDrive onMagnet(4096, 3010, 3000, 57);
    Rotation a(&onMagnet, &onMagnet, cfg);
    CHECK(a.requestHome());
    CHECK(runUntilIdle(a));
    CHECK(a.getState() == ROT_IDLE);
    CHECK(onMagnet.phys == onMagnet.redPosition(offset));

    // a broken sensor: the drum gives up after 125% of a turn
    FakeDrive dead(4096, 0, 3000, 57);
    dead.hallDead = true;
    Rotation b(&dead, &dead, cfg);
    CHECK(b.requestHome());
    CHECK(runUntilIdle(b));
    CHECK(b.getState() == ROT_FAULT);
    CHECK(b.getFault() == FAULT_HOME_NOT_FOUND);
    CHECK(b.getPosition() == -1);
    CHECK(dead.total == 4096 * 125 / 100);
    CHECK(b.requestIndex(RED) == false);   // not allowed in a fault

    b.clearFault();
    CHECK(b.getState() == ROT_UNHOMED);
}

// the interlock for the next test
bool gate = true;
bool gateOpen(void* context) {
    (void)context;
    return gate;
}

void testInterlockAndBusy() {
    RotationConfig cfg;
    FakeDrive drive(4096, 0, 100, 57);
    Rotation rot(&drive, &drive, cfg);
    rot.setInterlock(gateOpen, NULL);

    // interlock closed: no homing
    gate = false;
    CHECK(rot.requestHome() == false);
    gate = true;
    CHECK(rot.requestHome());
    CHECK(runUntilIdle(rot));

    // while the drum is moving, new requests are refused
    CHECK(rot.requestIndex(GREEN));
    CHECK(rot.isBusy());
    CHECK(rot.requestIndex(BLUE) == false);
    CHECK(rot.requestHome() == false);
    CHECK(rot.atStation() == NO_COLOR);
    CHECK(runUntilIdle(rot));
    CHECK(rot.atStation() == GREEN);

    // interlock closed again: no moves
    gate = false;
    CHECK(rot.requestIndex(RED) == false);
    gate = true;

    // asking for the station we are already at is accepted and nothing moves
    CHECK(rot.requestIndex(GREEN));
    CHECK(rot.isBusy() == false);
}

void testSpeedRamp() {
    RotationConfig cfg;
    FakeDrive drive(4096, 0, 100, 57);
    Rotation rot(&drive, &drive, cfg);
    rot.requestHome();
    runUntilIdle(rot);

    uint32_t startTime = clockUs;
    rot.requestIndex(BLUE);   // 1024 steps
    runUntilIdle(rot);
    uint32_t elapsed = clockUs - startTime;

    // it can not be faster than all steps at the fastest speed, or slower than all at the slowest
    CHECK(elapsed >= 1024UL * cfg.minIntervalUs);
    CHECK(elapsed < 1024UL * cfg.startIntervalUs);
}

int main() {
    testPlanner();
    testHomeAndIndex();
    testHomeFromOnTheMagnetAndFault();
    testInterlockAndBusy();
    testSpeedRamp();

    if (failures > 0) {
        printf("%d of %d checks FAILED\n", failures, checks);
        return 1;
    }
    printf("ALL PASSED (%d checks)\n", checks);
    return 0;
}
