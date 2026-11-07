// Host tests for the scheduling system (no Arduino, no hardware): g++ -std=c++11, plain asserts.
// The automatic-rotation tests drive the real rotation code through the fake drum of the rotation-mechanism tests.
#include <stdio.h>
#include <string.h>

#include "../../rotation-mechanism/test/fake_drive.h"
#include "core/auto_rotate.h"
#include "core/schedule.h"

static int failures = 0, checks = 0;
#define CHECK(cond)                                                      \
  do {                                                                   \
    checks++;                                                            \
    if (!(cond)) { failures++; printf("FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond); } \
  } while (0)

static const uint32_t H = 3600;
static void testParseAndFormat() {
  uint16_t m = 0;
  CHECK(Scheduler::parseTime("08:30", &m) && m == 510);
  CHECK(Scheduler::parseTime("8:05", &m) && m == 485);
  CHECK(Scheduler::parseTime("23:59", &m) && m == 1439);
  CHECK(Scheduler::parseTime("00:00", &m) && m == 0);
  const char* bad[] = {"24:00", "12:60", "12:5", "1230", "ab:cd", "", "12:300", "123:00", "-1:00"};
  for (const char* b : bad) CHECK(!Scheduler::parseTime(b, &m));
  char out[6];
  Scheduler::formatTime(485, out);
  CHECK(strcmp(out, "08:05") == 0);
}

static void testAddRules() {
  Scheduler s(8 * H);
  uint8_t id = 0;
  CHECK(s.add(RED, 9 * 60, &id) == ADD_OK && id == 1);
  CHECK(s.add(RED, 9 * 60) == ADD_DUPLICATE);
  CHECK(s.add(BLUE, 9 * 60) == ADD_OK);  // same time, other colour is allowed
  CHECK(s.add(static_cast<Color>(9), 60) == ADD_BAD_COLOR);
  CHECK(s.add(RED, 24 * 60) == ADD_BAD_TIME);
  for (uint8_t i = 0; i < 6; i++) CHECK(s.add(GREEN, 600 + i) == ADD_OK);
  CHECK(s.count() == Scheduler::MAX_ENTRIES);
  CHECK(s.add(ORANGE, 700) == ADD_FULL);
  CHECK(s.remove(1) && !s.remove(1) && s.count() == 7);
}

static void testDueMissedAndMidnight() {
  Scheduler s(8 * H);
  uint8_t a = 0, b = 0;
  s.add(RED, 8 * 60 + 30, &a);
  s.add(BLUE, 9 * 60, &b);
  CHECK(s.find(a)->status == PENDING && s.due() == nullptr);
  CHECK(s.next()->id == a);
  s.setClock(8 * H + 30 * 60);
  CHECK(s.find(a)->status == DUE && s.due()->id == a);
  s.setClock(9 * H + 1);  // red: 30 min grace is over; blue is due since 09:00
  CHECK(s.find(a)->status == MISSED && s.find(b)->status == DUE);
  s.setClock(9 * H + 31 * 60);
  CHECK(s.find(b)->status == MISSED && s.due() == nullptr);
  s.setClock(23 * H);
  s.setClock(1 * H);  // the clock went backwards: midnight passed, a new day starts
  CHECK(s.find(a)->status == PENDING && s.find(b)->status == PENDING);
  s.advanceSeconds(23 * H);  // 01:00 + 23 h wraps again
  CHECK(s.find(a)->status == PENDING);
}

static void testLateEntryCountsForTomorrow() {
  Scheduler s(12 * H);
  uint8_t id = 0;
  s.add(RED, 8 * 60, &id);
  CHECK(s.find(id)->tomorrow && s.find(id)->status == PENDING);
  CHECK(s.next()->id == id);  // still the next pending dose
  s.add(BLUE, 12 * 60 + 10, &id);
  CHECK(!s.find(id)->tomorrow);
  CHECK(s.next()->color == BLUE);  // today before tomorrow
}

static void testTakeFlow() {
  Scheduler s(8 * H);
  uint8_t a = 0, b = 0, c = 0;
  s.add(RED, 8 * 60, &a);
  s.add(BLUE, 8 * 60, &b);
  s.add(GREEN, 10 * 60, &c);
  CHECK(s.due()->id == a);  // earliest, then colour order
  CHECK(!s.beginTake(c));   // not due: refused
  CHECK(s.beginTake(a) && s.find(a)->status == TAKING);
  CHECK(s.due()->id == b);
  s.abortTake(a);
  CHECK(s.find(a)->status == DUE);
  CHECK(s.beginTake(a) && s.finishTake(a, VERIFIED) && s.find(a)->status == TAKEN);
  CHECK(s.beginTake(b) && s.finishTake(b, NO_PILL) && s.find(b)->status == FAILED);
  CHECK(!s.finishTake(b, VERIFIED));  // only a TAKING dose can finish
  s.setClock(8 * H + 29 * 60);
  CHECK(s.find(a)->status == TAKEN);  // a taken dose never turns into MISSED
}

static void testSortedAndSave() {
  Scheduler s(7 * H);
  s.add(GREEN, 12 * 60);
  s.add(BLUE, 8 * 60);
  s.add(RED, 8 * 60);
  const Entry* list[Scheduler::MAX_ENTRIES];
  CHECK(s.sorted(list) == 3 && list[0]->color == RED && list[1]->color == BLUE && list[2]->color == GREEN);
  uint8_t buf[64];
  size_t n = s.save(buf, sizeof(buf));
  CHECK(n == 3 + 3 * 4 && s.save(buf, 5) == 0);
  Scheduler t(9 * H);
  CHECK(t.load(buf, n) && t.count() == 3);
  CHECK(t.find(1)->color == GREEN && t.find(3)->minutes == 480);
  CHECK(t.find(2)->tomorrow && t.find(2)->status == PENDING);  // 08:00 is long past after a reboot at 09:00: counts for tomorrow
  uint8_t id = 0;
  CHECK(t.add(ORANGE, 15 * 60, &id) == ADD_OK && id == 4);  // ids continue
  buf[0] = 0;
  CHECK(!t.load(buf, n));
}

// ---------- automatic rotation ----------
struct FakeDispenser : Dispenser {
  int polls = 0, countdown = 0, started = 0;
  Color last = NO_COLOR;
  Verdict result = VERIFIED;
  bool refuse = false;
  bool start(Color c) override { if (refuse) return false; started++; last = c; countdown = 50; return true; }
  bool finished(Verdict* v) override { if (countdown > 0 && --countdown == 0) { *v = result; return true; } return false; }
};

static void spin(AutoRotate& a, int loops) { for (int i = 0; i < loops; i++) { clockUs += 200; a.update(clockUs); } }
static bool spinUntil(AutoRotate& a, AutoState s, int maxLoops = 400000) {
  for (int i = 0; i < maxLoops && a.state() != s; i++) { clockUs += 200; a.update(clockUs); }
  return a.state() == s;
}

static void testAutoDoseFlow() {
  Scheduler sched(8 * H);
  FakeDrive drive(4096, 700, 3000, 57);
  FakeDispenser disp;
  Rotation rot(drive, drive);
  AutoRotate ar(sched, rot, disp);
  uint8_t id = 0;
  sched.add(GREEN, 8 * 60 + 15, &id);
  ar.begin();
  CHECK(ar.state() == AUTO_HOMING && spinUntil(ar, AUTO_IDLE));
  CHECK(!ar.takePressed() && strcmp(ar.message(), "no dose is due") == 0);

  sched.setClock(8 * H + 15 * 60);  // the dose becomes due: the drum turns to green by itself
  spin(ar, 2);
  CHECK(ar.state() == AUTO_POSITIONING && rot.busy());
  CHECK(spinUntil(ar, AUTO_READY) && rot.atStation() == GREEN);
  CHECK(disp.started == 0);  // nothing is dispensed without the tap
  CHECK(sched.find(id)->status == DUE);

  CHECK(ar.takePressed() && ar.state() == AUTO_DISPENSING && disp.last == GREEN && sched.find(id)->status == TAKING);
  CHECK(!rot.requestIndex(RED));  // the drum is locked while dispensing
  CHECK(spinUntil(ar, AUTO_PARKING));
  CHECK(sched.find(id)->status == TAKEN);
  CHECK(spinUntil(ar, AUTO_IDLE) && rot.atStation() == RED);  // parked at the home station
}

static void testTapBeforeArrivalAndFailedDose() {
  Scheduler sched(8 * H);
  FakeDrive drive(4096, 0, 3000, 57);
  FakeDispenser disp;
  disp.result = NO_PILL;
  AutoConfig cfg;
  cfg.prePosition = false;
  Rotation rot(drive, drive);
  AutoRotate ar(sched, rot, disp, cfg);
  uint8_t id = 0;
  sched.add(ORANGE, 8 * 60, &id);
  ar.begin();
  CHECK(spinUntil(ar, AUTO_IDLE));
  sched.setClock(8 * H);
  spin(ar, 5);
  CHECK(ar.state() == AUTO_IDLE && !rot.busy());  // no pre-positioning in this configuration
  CHECK(ar.takePressed() && ar.state() == AUTO_POSITIONING);  // the tap starts the turn, the dispense follows on arrival
  CHECK(spinUntil(ar, AUTO_DISPENSING) && rot.atStation() == ORANGE);
  CHECK(spinUntil(ar, AUTO_PARKING));
  CHECK(sched.find(id)->status == FAILED && sched.find(id)->verdict == NO_PILL);  // only VERIFIED counts as taken
}

static void testDispenserRefusalAndMissedDose() {
  Scheduler sched(8 * H);
  FakeDrive drive(4096, 0, 3000, 57);
  FakeDispenser disp;
  Rotation rot(drive, drive);
  AutoRotate ar(sched, rot, disp);
  uint8_t id = 0;
  sched.add(BLUE, 8 * 60, &id);
  ar.begin();
  spinUntil(ar, AUTO_IDLE);
  sched.setClock(8 * H);
  CHECK(spinUntil(ar, AUTO_READY));
  disp.refuse = true;
  CHECK(!ar.takePressed() && sched.find(id)->status == DUE && strcmp(ar.message(), "dispenser refused") == 0);
  CHECK(ar.state() == AUTO_IDLE);
  spin(ar, 2);
  CHECK(ar.state() == AUTO_READY);  // still due: back to ready
  sched.setClock(8 * H + 31 * 60);  // nobody tapped: the dose is missed and the drum stops waiting
  spin(ar, 2);
  CHECK(sched.find(id)->status == MISSED && ar.state() == AUTO_IDLE && disp.started == 0);
}

static void testHomeFaultAndRecover() {
  Scheduler sched(8 * H);
  FakeDrive drive(4096, 0, 3000, 57);
  drive.hallDead = true;
  FakeDispenser disp;
  Rotation rot(drive, drive);
  AutoRotate ar(sched, rot, disp);
  ar.begin();
  CHECK(spinUntil(ar, AUTO_FAULT) && rot.fault() == FAULT_HOME_NOT_FOUND);
  CHECK(!ar.takePressed());
  drive.hallDead = false;
  ar.recover();
  CHECK(ar.state() == AUTO_HOMING && spinUntil(ar, AUTO_IDLE) && rot.atStation() == RED);
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
  if (failures) {
    printf("%d of %d checks FAILED\n", failures, checks);
    return 1;
  }
  printf("ALL PASSED (%d checks)\n", checks);
  return 0;
}
