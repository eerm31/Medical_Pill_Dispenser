// Ties the schedule to the rotation: when a dose is due the drum turns to its colour by itself (pre-positioning);
// the user's tap on TAKE then starts the dispense. The dose never starts from the clock alone.
#pragma once
#include "core/rotation.h"
#include "schedule.h"

namespace dispenser {

// The dispensing mechanism (pin, blades, tongue: Subsystem 1) and the verification subsystem (Subsystem 3) plug in here.
// They are not part of this folder; main.cpp uses a stub that always reports VERIFIED after a delay.
class Dispenser {
 public:
  virtual ~Dispenser() {}
  virtual bool start(Color c) = 0;               // false when the mechanism refuses
  virtual bool finished(Verdict* verdict) = 0;   // true once the dispense is over; the verdict comes from verification
};

enum AutoState : uint8_t {
  AUTO_START = 0,   // nothing requested yet
  AUTO_HOMING,
  AUTO_IDLE,        // homed; waiting for a dose
  AUTO_POSITIONING, // the drum is turning to the due colour
  AUTO_READY,       // the drum is at the due colour; waiting for the tap
  AUTO_DISPENSING,
  AUTO_PARKING,     // drum returns to the park station
  AUTO_FAULT
};

struct AutoConfig {
  bool prePosition = true;  // turn to the due colour as soon as the dose becomes due
  bool parkAfter = true;    // return to the park station after each dose ("index, then go home")
  Color parkColor = RED;
};

class AutoRotate {
 public:
  AutoRotate(Scheduler& schedule, Rotation& rotation, Dispenser& dispenser, const AutoConfig& config = AutoConfig());

  void begin();                // starts the home search
  void update(uint32_t nowUs); // call every loop pass: runs the rotation and the state machine
  bool takePressed();          // the tap on TAKE; true when it was accepted
  void recover();              // after a fault: clear it and home again

  AutoState state() const { return state_; }
  const char* stateName() const;
  const char* message() const { return message_; }  // last refusal or fault, empty when none

 private:
  void startDispense();
  void failTake(const char* why);
  void toIdle();
  static bool interlock(void* self);

  Scheduler& schedule_;
  Rotation& rotation_;
  Dispenser& dispenser_;
  AutoConfig cfg_;
  AutoState state_;
  uint8_t takingId_;
  Color takeColor_;
  bool takeQueued_;
  const char* message_;
};

}  // namespace dispenser
