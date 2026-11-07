// Host tests for the rotation mechanism (no Arduino, no hardware): g++ -std=c++11, plain asserts.
#include <stdio.h>

#include "fake_drive.h"

static int failures = 0, checks = 0;
#define CHECK(cond)                                                      \
  do {                                                                   \
    checks++;                                                            \
    if (!(cond)) { failures++; printf("FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond); } \
  } while (0)

static bool runUntilIdle(Rotation& r, int maxLoops = 400000) {
  for (int i = 0; i < maxLoops && (r.busy()); i++) { clockUs += 200; r.update(clockUs); }
  return !r.busy();
}

static void testPlanner() {
  int32_t seg[2];
  const int32_t n = 4096, q = 1024, over = 34;
  CHECK(Rotation::stationSteps(RED, n) == 0 && Rotation::stationSteps(BLUE, n) == q);
  CHECK(Rotation::stationSteps(GREEN, n) == 2 * q && Rotation::stationSteps(ORANGE, n) == 3 * q);
  CHECK(Rotation::planIndex(0, 0, n, over, true, seg) == 0);
  CHECK(Rotation::planIndex(0, q, n, over, true, seg) == 1 && seg[0] == q);
  CHECK(Rotation::planIndex(0, 3 * q, n, over, true, seg) == 2 && seg[0] == -q - over && seg[1] == over);
  CHECK(Rotation::planIndex(0, 3 * q, n, over, false, seg) == 1 && seg[0] == -q);
  CHECK(Rotation::planIndex(0, 2 * q, n, over, true, seg) == 1 && seg[0] == 2 * q);  // exactly half: counter-clockwise
  CHECK(Rotation::planIndex(q, 0, n, over, true, seg) == 2 && seg[0] + seg[1] == -q);
}

static void testHomeAndIndex() {
  RotationConfig cfg;
  FakeDrive drive(4096, 1500, 3000, 57);
  Rotation rot(drive, drive, cfg);
  int32_t offset = static_cast<int32_t>(cfg.homeOffsetDeg * 4096 / 360.0f + 0.5f);
  CHECK(rot.state() == ROT_UNHOMED && !rot.requestIndex(BLUE));  // must home first
  CHECK(rot.requestHome() && rot.state() == ROT_HOMING && !rot.requestHome());
  CHECK(runUntilIdle(rot) && rot.state() == ROT_IDLE && rot.position() == 0);
  CHECK(drive.phys == drive.red(offset) && rot.atStation() == RED && drive.released);
  for (int from = 0; from < 4; from++) {
    for (int to = 0; to < 4; to++) {
      CHECK(rot.requestIndex(static_cast<Color>(from)) && runUntilIdle(rot));
      CHECK(rot.requestIndex(static_cast<Color>(to)) && runUntilIdle(rot));
      CHECK(rot.atStation() == static_cast<Color>(to));
      CHECK(drive.phys == (drive.red(offset) + to * 1024) % 4096);  // the physical drum is exactly on the station
      if (from != to) CHECK(drive.lastDir == 1);                     // the last move is always counter-clockwise
    }
  }
}

static void testHomeFromOnTheMagnetAndFault() {
  RotationConfig cfg;
  FakeDrive onMagnet(4096, 3010, 3000, 57);  // starts inside the magnet window
  Rotation a(onMagnet, onMagnet, cfg);
  CHECK(a.requestHome() && runUntilIdle(a) && a.state() == ROT_IDLE);
  CHECK(onMagnet.phys == onMagnet.red(static_cast<int32_t>(cfg.homeOffsetDeg * 4096 / 360.0f + 0.5f)));

  FakeDrive dead(4096, 0, 3000, 57);
  dead.hallDead = true;
  Rotation b(dead, dead, cfg);
  CHECK(b.requestHome() && runUntilIdle(b));
  CHECK(b.state() == ROT_FAULT && b.fault() == FAULT_HOME_NOT_FOUND && b.position() == -1);
  CHECK(dead.total == 4096 * 125 / 100);  // gave up after 125 % of a turn
  CHECK(!b.requestIndex(RED));
  b.clearFault();
  CHECK(b.state() == ROT_UNHOMED);
}

static bool gate = true;
static bool gateOpen(void*) { return gate; }

static void testInterlockAndBusy() {
  RotationConfig cfg;
  FakeDrive drive(4096, 0, 100, 57);
  Rotation rot(drive, drive, cfg);
  rot.setInterlock(gateOpen, nullptr);
  gate = false;
  CHECK(!rot.requestHome());
  gate = true;
  CHECK(rot.requestHome() && runUntilIdle(rot));
  CHECK(rot.requestIndex(GREEN) && rot.busy() && !rot.requestIndex(BLUE) && !rot.requestHome());
  CHECK(rot.atStation() == NO_COLOR);  // moving
  CHECK(runUntilIdle(rot) && rot.atStation() == GREEN);
  gate = false;
  CHECK(!rot.requestIndex(RED));
  gate = true;
  CHECK(rot.requestIndex(GREEN));  // already there: accepted, nothing moves
  CHECK(!rot.busy());
}

static void testSpeedRamp() {
  RotationConfig cfg;
  FakeDrive drive(4096, 0, 100, 57);
  Rotation rot(drive, drive, cfg);
  rot.requestHome();
  runUntilIdle(rot);
  uint32_t t0 = clockUs;
  rot.requestIndex(BLUE);
  runUntilIdle(rot);
  uint32_t elapsed = clockUs - t0;
  // 1024 steps: at least 1024 x min interval, at most 1024 x start interval
  CHECK(elapsed >= 1024UL * cfg.minIntervalUs && elapsed < 1024UL * cfg.startIntervalUs);
}

int main() {
  testPlanner();
  testHomeAndIndex();
  testHomeFromOnTheMagnetAndFault();
  testInterlockAndBusy();
  testSpeedRamp();
  if (failures) {
    printf("%d of %d checks FAILED\n", failures, checks);
    return 1;
  }
  printf("ALL PASSED (%d checks)\n", checks);
  return 0;
}
