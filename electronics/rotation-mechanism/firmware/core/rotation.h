// Automatic drum rotation: home search against the Hall sensor, then index to a colour station.
// Port of the logic in docs/visualizer/rotation-controller.js (home search, counter-clockwise index, overshoot, interlock).
// The motion is step based and non-blocking: call update() often, it issues at most one half-step per call.
#pragma once
#include "colors.h"

namespace dispenser {

// One half-step of the stepper. dir = +1 is counter-clockwise (the direction used for homing and for the final approach).
class StepperPort {
 public:
  virtual ~StepperPort() {}
  virtual void step(int dir) = 0;
  virtual void release() = 0;  // coils off, so the ULN2003 and the motor do not heat up while idle
};

// True while the magnet is over the sensor. The A3144 output is LOW at the magnet; the hardware layer inverts it.
class HomeSensor {
 public:
  virtual ~HomeSensor() {}
  virtual bool active() = 0;
};

enum RotState : uint8_t { ROT_UNHOMED = 0, ROT_HOMING, ROT_IDLE, ROT_MOVING, ROT_FAULT };
enum RotFault : uint8_t { FAULT_NONE = 0, FAULT_HOME_NOT_FOUND };

struct RotationConfig {
  uint16_t stepsPerRev = 4096;       // 28BYJ-48 in half-step mode (2048 full steps x 2)
  float homeOffsetDeg = 3.66f;       // from the Hall edge to the RED station
  float overshootDeg = 3.0f;         // clockwise moves overshoot by this much and come back counter-clockwise
  bool unidirectional = true;        // always arrive moving counter-clockwise (removes gear lash)
  uint16_t searchLimitPercent = 125; // give up on the home search after this much of a turn
  uint32_t startIntervalUs = 4000;   // first step interval, ramps down to minIntervalUs
  uint32_t minIntervalUs = 1500;
  uint16_t rampSteps = 120;
  bool releaseWhenIdle = true;
};

class Rotation {
 public:
  Rotation(StepperPort& stepper, HomeSensor& hall, const RotationConfig& config = RotationConfig());

  // The guard that stands in for canRotate() of the simulation: return false while the dispenser must not rotate
  // (a dispense is running, a cap is open, a lift is in progress). Checked when a move is requested.
  void setInterlock(bool (*allowed)(void*), void* context);

  bool requestHome();            // false when busy or the interlock refuses
  bool requestIndex(Color c);    // false when not homed, busy, faulted or the interlock refuses
  void clearFault();             // a faulted drum must be homed again
  void update(uint32_t nowUs);

  RotState state() const { return state_; }
  RotFault fault() const { return fault_; }
  bool busy() const { return state_ == ROT_HOMING || state_ == ROT_MOVING; }
  int32_t position() const { return pos_; }  // steps counted from the RED station, -1 while unknown
  Color atStation() const;                   // NO_COLOR while moving, unhomed or between stations
  uint16_t stepsPerRev() const { return cfg_.stepsPerRev; }

  static int32_t stationSteps(Color c, uint16_t stepsPerRev);
  // Splits a move from `from` to `to` on a circle of n steps into at most two signed segments. Returns the segment count.
  static uint8_t planIndex(int32_t from, int32_t to, int32_t n, int32_t overshoot, bool unidirectional, int32_t seg[2]);

 private:
  enum Job : uint8_t { JOB_NONE = 0, JOB_LEAVE_MAGNET, JOB_SEARCH, JOB_OFFSET, JOB_INDEX };

  bool interlockOk() const { return !interlock_ || interlock_(context_); }
  void beginSegment();
  void finishHome();
  void finishIndex();
  uint32_t intervalUs() const;

  StepperPort& stepper_;
  HomeSensor& hall_;
  RotationConfig cfg_;
  bool (*interlock_)(void*);
  void* context_;

  RotState state_;
  RotFault fault_;
  Job job_;
  int32_t pos_;
  int32_t seg_[2];
  uint8_t segCount_, segIndex_;
  int32_t remaining_;      // steps left in the current index segment or home offset
  int32_t searched_;       // steps taken during the home search
  int32_t stepsDone_;      // steps since the current segment began (for the ramp)
  int dir_;
  Color target_;
  uint32_t nextUs_;
  bool timing_;
};

}  // namespace dispenser
