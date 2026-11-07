#include "auto_rotate.h"

namespace dispenser {

AutoRotate::AutoRotate(Scheduler& schedule, Rotation& rotation, Dispenser& dispenser, const AutoConfig& config)
    : schedule_(schedule), rotation_(rotation), dispenser_(dispenser), cfg_(config), state_(AUTO_START),
      takingId_(0), takeColor_(NO_COLOR), takeQueued_(false), message_("") {
  rotation_.setInterlock(&AutoRotate::interlock, this);
}

// The drum must not turn while a dose is being dispensed.
bool AutoRotate::interlock(void* self) {
  return static_cast<AutoRotate*>(self)->state_ != AUTO_DISPENSING;
}

const char* AutoRotate::stateName() const {
  static const char* const names[] = {"START", "HOMING", "IDLE", "POSITIONING", "READY", "DISPENSING", "PARKING", "FAULT"};
  return names[state_];
}

void AutoRotate::begin() {
  if (state_ != AUTO_START) return;
  if (rotation_.requestHome()) state_ = AUTO_HOMING;
  else message_ = "home search refused";
}

void AutoRotate::recover() {
  if (state_ != AUTO_FAULT) return;
  rotation_.clearFault();
  message_ = "";
  state_ = AUTO_START;
  begin();
}

void AutoRotate::toIdle() {
  takeQueued_ = false;
  state_ = AUTO_IDLE;
}

void AutoRotate::failTake(const char* why) {
  if (takeQueued_ || state_ == AUTO_DISPENSING) schedule_.abortTake(takingId_);  // the dose goes back to DUE
  message_ = why;
  takeQueued_ = false;
}

void AutoRotate::startDispense() {
  takeQueued_ = false;
  if (dispenser_.start(takeColor_)) {
    state_ = AUTO_DISPENSING;
    message_ = "";
  } else {
    schedule_.abortTake(takingId_);
    message_ = "dispenser refused";
    toIdle();
  }
}

bool AutoRotate::takePressed() {
  if (state_ != AUTO_IDLE && state_ != AUTO_POSITIONING && state_ != AUTO_READY) {
    message_ = "not ready";
    return false;
  }
  const Entry* d = schedule_.due();
  if (!d) {
    message_ = "no dose is due";
    return false;
  }
  takingId_ = d->id;
  takeColor_ = d->color;
  if (!schedule_.beginTake(takingId_)) return false;
  message_ = "";
  if (rotation_.atStation() == takeColor_) {
    startDispense();
    return state_ == AUTO_DISPENSING;
  }
  if (state_ == AUTO_POSITIONING && rotation_.busy()) {  // already turning (pre-positioning): the dispense follows on arrival
    takeQueued_ = true;
    return true;
  }
  if (rotation_.requestIndex(takeColor_)) {
    takeQueued_ = true;
    state_ = AUTO_POSITIONING;
    return true;
  }
  schedule_.abortTake(takingId_);
  message_ = "drum cannot turn now";
  return false;
}

void AutoRotate::update(uint32_t nowUs) {
  rotation_.update(nowUs);

  if (rotation_.state() == ROT_FAULT && state_ != AUTO_FAULT) {
    failTake("rotation fault: home sensor not found");
    state_ = AUTO_FAULT;
    return;
  }

  switch (state_) {
    case AUTO_HOMING:
      if (rotation_.state() == ROT_IDLE) toIdle();
      break;

    case AUTO_IDLE: {
      const Entry* d = schedule_.due();
      if (!d) break;
      if (rotation_.atStation() == d->color) state_ = AUTO_READY;
      else if (cfg_.prePosition && rotation_.requestIndex(d->color)) state_ = AUTO_POSITIONING;
      break;
    }

    case AUTO_POSITIONING:
      if (rotation_.state() != ROT_IDLE) break;
      if (takeQueued_) {
        if (rotation_.atStation() == takeColor_) startDispense();
        else { failTake("drum missed the station"); toIdle(); }
      } else {
        state_ = AUTO_IDLE;  // arrived; the next pass decides between READY and a new target
      }
      break;

    case AUTO_READY: {
      const Entry* d = schedule_.due();
      if (!d || rotation_.atStation() != d->color) state_ = AUTO_IDLE;  // the dose was missed or another one is due first
      break;
    }

    case AUTO_DISPENSING: {
      Verdict v = VERDICT_NONE;
      if (!dispenser_.finished(&v)) break;
      schedule_.finishTake(takingId_, v);
      toIdle();  // the interlock lifts as soon as the dispense is over
      if (cfg_.parkAfter && rotation_.atStation() != cfg_.parkColor && rotation_.requestIndex(cfg_.parkColor)) state_ = AUTO_PARKING;
      break;
    }

    case AUTO_PARKING:
      if (rotation_.state() == ROT_IDLE) toIdle();
      break;

    default:
      break;
  }
}

}  // namespace dispenser
