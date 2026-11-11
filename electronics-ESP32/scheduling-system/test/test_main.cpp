// test_main.cpp
// Tests for the scheduling system. They run on the laptop, no Arduino and no hardware needed.
// The automatic-rotation tests use the real rotation code together with the fake drum from the
// rotation-mechanism tests.
// Build and run with: make

#include <stdio.h>
#include <string.h>
#include "../../rotation-mechanism/test/fake_drive.h"
#include "core/auto_rotate.h"
#include "core/schedule.h"

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

#define HOUR 3600   // seconds in an hour

// ---------- schedule tests ----------

void testParseAndFormat() {
    int m = 0;

    CHECK(Scheduler::parseTime("08:30", &m));
    CHECK(m == 510);
    CHECK(Scheduler::parseTime("8:05", &m));
    CHECK(m == 485);
    CHECK(Scheduler::parseTime("23:59", &m));
    CHECK(m == 1439);
    CHECK(Scheduler::parseTime("00:00", &m));
    CHECK(m == 0);

    // all of these must be rejected
    const char* bad[] = {"24:00", "12:60", "12:5", "1230", "ab:cd", "", "12:300", "123:00", "-1:00"};
    int i;
    for (i = 0; i < 9; i++) {
        CHECK(Scheduler::parseTime(bad[i], &m) == false);
    }

    char out[6];
    Scheduler::formatTime(485, out);
    CHECK(strcmp(out, "08:05") == 0);
}

void testAddRules() {
    Scheduler s(8 * HOUR);
    uint8_t id = 0;

    CHECK(s.add(RED, 9 * 60, &id) == ADD_OK);
    CHECK(id == 1);
    CHECK(s.add(RED, 9 * 60) == ADD_DUPLICATE);
    CHECK(s.add(BLUE, 9 * 60) == ADD_OK);   // same time but another colour is fine
    CHECK(s.add((Color)9, 60) == ADD_BAD_COLOR);
    CHECK(s.add(RED, 24 * 60) == ADD_BAD_TIME);
    CHECK(s.add(RED, 10 * 60, NULL, 0) == ADD_BAD_PILLS);
    CHECK(s.add(RED, 10 * 60, NULL, MAX_PILLS + 1) == ADD_BAD_PILLS);

    // fill up the schedule (2 entries so far, 6 more make 8)
    int i;
    for (i = 0; i < 6; i++) {
        CHECK(s.add(GREEN, 600 + i) == ADD_OK);
    }
    CHECK(s.getCount() == MAX_ENTRIES);
    CHECK(s.add(ORANGE, 700) == ADD_FULL);

    CHECK(s.remove(1));
    CHECK(s.remove(1) == false);   // already gone
    CHECK(s.getCount() == 7);
}

void testDueMissedAndMidnight() {
    Scheduler s(8 * HOUR);
    uint8_t a = 0;
    uint8_t b = 0;
    s.add(RED, 8 * 60 + 30, &a);
    s.add(BLUE, 9 * 60, &b);

    CHECK(s.find(a)->status == PENDING);
    CHECK(s.due() == NULL);
    CHECK(s.next()->id == a);

    s.setClock(8 * HOUR + 30 * 60);
    CHECK(s.find(a)->status == DUE);
    CHECK(s.due()->id == a);

    // red has waited more than 30 minutes, blue is due since 09:00
    s.setClock(9 * HOUR + 1);
    CHECK(s.find(a)->status == MISSED);
    CHECK(s.find(b)->status == DUE);

    s.setClock(9 * HOUR + 31 * 60);
    CHECK(s.find(b)->status == MISSED);
    CHECK(s.due() == NULL);

    // the clock goes backwards: midnight has passed, a new day starts
    s.setClock(23 * HOUR);
    s.setClock(1 * HOUR);
    CHECK(s.find(a)->status == PENDING);
    CHECK(s.find(b)->status == PENDING);

    // 01:00 + 23 hours passes midnight again
    s.advanceSeconds(23 * HOUR);
    CHECK(s.find(a)->status == PENDING);
}

void testLateEntryCountsForTomorrow() {
    Scheduler s(12 * HOUR);
    uint8_t id = 0;

    s.add(RED, 8 * 60, &id);
    CHECK(s.find(id)->tomorrow);
    CHECK(s.find(id)->status == PENDING);
    CHECK(s.next()->id == id);   // it is still the next pending dose

    s.add(BLUE, 12 * 60 + 10, &id);
    CHECK(s.find(id)->tomorrow == false);
    CHECK(s.next()->color == BLUE);   // today comes before tomorrow
}

void testTakeFlow() {
    Scheduler s(8 * HOUR);
    uint8_t a = 0;
    uint8_t b = 0;
    uint8_t c = 0;
    s.add(RED, 8 * 60, &a);
    s.add(BLUE, 8 * 60, &b);
    s.add(GREEN, 10 * 60, &c);

    CHECK(s.due()->id == a);        // earliest first, then by colour
    CHECK(s.beginTake(c) == false); // green is not due yet
    CHECK(s.beginTake(a));
    CHECK(s.find(a)->status == TAKING);
    CHECK(s.due()->id == b);

    s.abortTake(a);
    CHECK(s.find(a)->status == DUE);

    CHECK(s.beginTake(a));
    CHECK(s.finishTake(a, VERIFIED));
    CHECK(s.find(a)->status == TAKEN);

    CHECK(s.beginTake(b));
    CHECK(s.finishTake(b, NO_PILL));
    CHECK(s.find(b)->status == FAILED);
    CHECK(s.finishTake(b, VERIFIED) == false);   // only a TAKING dose can be finished

    s.setClock(8 * HOUR + 29 * 60);
    CHECK(s.find(a)->status == TAKEN);   // a taken dose never becomes MISSED
}

void testSortedAndSave() {
    Scheduler s(7 * HOUR);
    s.add(GREEN, 12 * 60, NULL, 4);
    s.add(BLUE, 8 * 60);
    s.add(RED, 8 * 60);

    const Entry* list[MAX_ENTRIES];
    CHECK(s.sorted(list) == 3);
    CHECK(list[0]->color == RED);
    CHECK(list[1]->color == BLUE);
    CHECK(list[2]->color == GREEN);

    uint8_t buffer[64];
    size_t n = s.save(buffer, sizeof(buffer));
    CHECK(n == 3 + 3 * 5);
    CHECK(s.save(buffer, 5) == 0);   // buffer too small

    // load it into a new scheduler (a reboot at 09:00)
    Scheduler t(9 * HOUR);
    CHECK(t.load(buffer, n));
    CHECK(t.getCount() == 3);
    CHECK(t.find(1)->color == GREEN);
    CHECK(t.find(1)->pills == 4);
    CHECK(t.find(3)->pills == 1);
    CHECK(t.find(3)->minutes == 480);
    // 08:00 is long over at 09:00, so it counts for tomorrow
    CHECK(t.find(2)->tomorrow);
    CHECK(t.find(2)->status == PENDING);

    uint8_t id = 0;
    CHECK(t.add(ORANGE, 15 * 60, &id) == ADD_OK);
    CHECK(id == 4);   // the ids carry on

    buffer[0] = 0;   // destroy the magic byte
    CHECK(t.load(buffer, n) == false);
}

// ---------- automatic rotation tests ----------

// A fake dispenser. It finishes 50 calls after start() and reports the verdict in "result".
class FakeDispenser : public Dispenser {
public:
    int countdown;
    int started;
    int lastPills;
    Color last;
    Verdict result;
    bool refuse;

    FakeDispenser() {
        countdown = 0;
        started = 0;
        lastPills = 0;
        last = NO_COLOR;
        result = VERIFIED;
        refuse = false;
    }

    bool start(Color c, int pills) {
        if (refuse) {
            return false;
        }
        started++;
        last = c;
        lastPills = pills;
        countdown = 50;
        return true;
    }

    bool finished(Verdict* verdict) {
        if (countdown > 0) {
            countdown--;
            if (countdown == 0) {
                *verdict = result;
                return true;
            }
        }
        return false;
    }
};

// Runs update() a fixed number of times.
void spin(AutoRotate& a, int loops) {
    int i;
    for (i = 0; i < loops; i++) {
        clockUs = clockUs + 200;
        a.update(clockUs);
    }
}

// Runs update() until the state machine reaches the wanted state. Returns false if it never does.
bool spinUntil(AutoRotate& a, AutoState wanted) {
    int i;
    for (i = 0; i < 400000 && a.getState() != wanted; i++) {
        clockUs = clockUs + 200;
        a.update(clockUs);
    }
    return a.getState() == wanted;
}

void testAutoDoseFlow() {
    Scheduler sched(8 * HOUR);
    FakeDrive drive(4096, 700, 3000, 57);
    FakeDispenser disp;
    Rotation rot(&drive, &drive);
    AutoRotate ar(&sched, &rot, &disp);
    uint8_t id = 0;
    sched.add(GREEN, 8 * 60 + 15, &id, 3);

    ar.begin();
    CHECK(ar.getState() == AUTO_HOMING);
    CHECK(spinUntil(ar, AUTO_IDLE));

    // tapping with no dose due does nothing
    CHECK(ar.takePressed() == false);
    CHECK(strcmp(ar.getMessage(), "no dose is due") == 0);

    // the dose becomes due: the drum turns to green by itself
    sched.setClock(8 * HOUR + 15 * 60);
    spin(ar, 2);
    CHECK(ar.getState() == AUTO_POSITIONING);
    CHECK(rot.isBusy());
    CHECK(spinUntil(ar, AUTO_READY));
    CHECK(rot.atStation() == GREEN);
    CHECK(disp.started == 0);   // nothing is dispensed without the tap
    CHECK(sched.find(id)->status == DUE);

    // the tap
    CHECK(ar.takePressed());
    CHECK(ar.getState() == AUTO_DISPENSING);
    CHECK(disp.last == GREEN);
    CHECK(disp.lastPills == 3);   // the dispenser gets the pill count of the dose
    CHECK(sched.find(id)->status == TAKING);
    CHECK(rot.requestIndex(RED) == false);   // the drum is locked while dispensing

    // afterwards the drum parks at the home station
    CHECK(spinUntil(ar, AUTO_PARKING));
    CHECK(sched.find(id)->status == TAKEN);
    CHECK(spinUntil(ar, AUTO_IDLE));
    CHECK(rot.atStation() == RED);
}

void testTapBeforeArrivalAndFailedDose() {
    Scheduler sched(8 * HOUR);
    FakeDrive drive(4096, 0, 3000, 57);
    FakeDispenser disp;
    disp.result = NO_PILL;
    AutoConfig cfg;
    cfg.prePosition = false;
    Rotation rot(&drive, &drive);
    AutoRotate ar(&sched, &rot, &disp, cfg);
    uint8_t id = 0;
    sched.add(ORANGE, 8 * 60, &id);

    ar.begin();
    CHECK(spinUntil(ar, AUTO_IDLE));
    sched.setClock(8 * HOUR);
    spin(ar, 5);

    // pre-positioning is off, so the drum stays where it is
    CHECK(ar.getState() == AUTO_IDLE);
    CHECK(rot.isBusy() == false);

    // the tap starts the turn, the dispense follows when the drum arrives
    CHECK(ar.takePressed());
    CHECK(ar.getState() == AUTO_POSITIONING);
    CHECK(spinUntil(ar, AUTO_DISPENSING));
    CHECK(rot.atStation() == ORANGE);
    CHECK(spinUntil(ar, AUTO_PARKING));

    // only VERIFIED counts as taken
    CHECK(sched.find(id)->status == FAILED);
    CHECK(sched.find(id)->verdict == NO_PILL);
}

void testDispenserRefusalAndMissedDose() {
    Scheduler sched(8 * HOUR);
    FakeDrive drive(4096, 0, 3000, 57);
    FakeDispenser disp;
    Rotation rot(&drive, &drive);
    AutoRotate ar(&sched, &rot, &disp);
    uint8_t id = 0;
    sched.add(BLUE, 8 * 60, &id);

    ar.begin();
    spinUntil(ar, AUTO_IDLE);
    sched.setClock(8 * HOUR);
    CHECK(spinUntil(ar, AUTO_READY));

    // the dispenser says no
    disp.refuse = true;
    CHECK(ar.takePressed() == false);
    CHECK(sched.find(id)->status == DUE);
    CHECK(strcmp(ar.getMessage(), "dispenser refused") == 0);
    CHECK(ar.getState() == AUTO_IDLE);

    // it is still due, so it goes back to ready
    spin(ar, 2);
    CHECK(ar.getState() == AUTO_READY);

    // nobody taps: the dose is missed and the drum stops waiting
    sched.setClock(8 * HOUR + 31 * 60);
    spin(ar, 2);
    CHECK(sched.find(id)->status == MISSED);
    CHECK(ar.getState() == AUTO_IDLE);
    CHECK(disp.started == 0);
}

void testHomeFaultAndRecover() {
    Scheduler sched(8 * HOUR);
    FakeDrive drive(4096, 0, 3000, 57);
    drive.hallDead = true;
    FakeDispenser disp;
    Rotation rot(&drive, &drive);
    AutoRotate ar(&sched, &rot, &disp);

    ar.begin();
    CHECK(spinUntil(ar, AUTO_FAULT));
    CHECK(rot.getFault() == FAULT_HOME_NOT_FOUND);
    CHECK(ar.takePressed() == false);

    // fix the "sensor" and try again
    drive.hallDead = false;
    ar.recover();
    CHECK(ar.getState() == AUTO_HOMING);
    CHECK(spinUntil(ar, AUTO_IDLE));
    CHECK(rot.atStation() == RED);
}

int main() {
    testParseAndFormat();
    testAddRules();
    testDueMissedAndMidnight();
    testLateEntryCountsForTomorrow();
    testTakeFlow();
    testSortedAndSave();
    testAutoDoseFlow();
    testTapBeforeArrivalAndFailedDose();
    testDispenserRefusalAndMissedDose();
    testHomeFaultAndRecover();

    if (failures > 0) {
        printf("%d of %d checks FAILED\n", failures, checks);
        return 1;
    }
    printf("ALL PASSED (%d checks)\n", checks);
    return 0;
}
