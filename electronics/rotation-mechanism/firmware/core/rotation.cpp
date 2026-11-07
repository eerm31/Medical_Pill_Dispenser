#include "rotation.h"

namespace dispenser {

static int32_t mod32(int32_t a, int32_t n) {
  int32_t r = a % n;
  return r < 0 ? r + n : r;
}

Rotation::Rotation(StepperPort& stepper, HomeSensor& hall, const RotationConfig& config)
    : stepper_(stepper), hall_(hall), cfg_(config), interlock_(nullptr), context_(nullptr),
      state_(ROT_UNHOMED), fault_(FAULT_NONE), job_(JOB_NONE), pos_(-1), segCount_(0), segIndex_(0),
      remaining_(0), searched_(0), stepsDone_(0), dir_(1), target_(NO_COLOR), nextUs_(0), timing_(false) {
  seg_[0] = seg_[1] = 0;
}

void Rotation::setInterlock(bool (*allowed)(void*), void* context) {
  interlock_ = allowed;
  context_ = context;
}

int32_t Rotation::stationSteps(Color c, uint16_t n) {
  if (c >= COLOR_COUNT) return -1;
  return mod32((static_cast<int32_t>(c) * n + 2) / 4, n);
}

// Same planner as planOnCircle() in the simulation: shortest way round; a clockwise result is split into
// "go past the target, then come back counter-clockwise" when the move must end counter-clockwise.
uint8_t Rotation::planIndex(int32_t from, int32_t to, int32_t n, int32_t overshoot, bool unidirectional, int32_t seg[2]) {
  int32_t s = mod32(to - from, n);
  if (s * 2 > n) s -= n;
  if (s == 0) return 0;
  if (s > 0 || !unidirectional) {
    seg[0] = s;
    return 1;
  }
  seg[0] = s - overshoot;
  seg[1] = overshoot;
  return 2;
}

Color Rotation::atStation() const {
  if (state_ != ROT_IDLE || pos_ < 0) return NO_COLOR;
  for (uint8_t c = 0; c < COLOR_COUNT; c++)
    if (stationSteps(static_cast<Color>(c), cfg_.stepsPerRev) == pos_) return static_cast<Color>(c);
  return NO_COLOR;
}

bool Rotation::requestHome() {
  if (busy() || !interlockOk()) return false;
  state_ = ROT_HOMING;
  fault_ = FAULT_NONE;
  pos_ = -1;
  searched_ = 0;
  stepsDone_ = 0;
  dir_ = 1;
  job_ = hall_.active() ? JOB_LEAVE_MAGNET : JOB_SEARCH;  // on the magnet already: leave it, then find its edge
  timing_ = false;
  return true;
}

bool Rotation::requestIndex(Color c) {
  if (c >= COLOR_COUNT || state_ != ROT_IDLE || !interlockOk()) return false;
  int32_t n = cfg_.stepsPerRev, over = static_cast<int32_t>(cfg_.overshootDeg * n / 360.0f + 0.5f);
  segCount_ = planIndex(pos_, stationSteps(c, cfg_.stepsPerRev), n, over, cfg_.unidirectional, seg_);
  if (segCount_ == 0) return true;  // already there
  target_ = c;
  segIndex_ = 0;
  state_ = ROT_MOVING;
  job_ = JOB_INDEX;
  timing_ = false;
  beginSegment();
  return true;
}

void Rotation::clearFault() {
  if (state_ == ROT_FAULT) {
    state_ = ROT_UNHOMED;
    fault_ = FAULT_NONE;
  }
}

void Rotation::beginSegment() {
  int32_t s = seg_[segIndex_];
  dir_ = s > 0 ? 1 : -1;
  remaining_ = s > 0 ? s : -s;
  stepsDone_ = 0;
}

// Trapezoid by step count: the interval falls from startIntervalUs to minIntervalUs over rampSteps and rises again at the end.
uint32_t Rotation::intervalUs() const {
  int32_t r = stepsDone_;
  if (job_ == JOB_INDEX || job_ == JOB_OFFSET) r = r < remaining_ ? r : remaining_;
  if (r > cfg_.rampSteps) r = cfg_.rampSteps;
  uint32_t span = cfg_.startIntervalUs - cfg_.minIntervalUs;
  return cfg_.startIntervalUs - span * static_cast<uint32_t>(r) / cfg_.rampSteps;
}

void Rotation::finishHome() {
  job_ = JOB_NONE;
  pos_ = 0;  // the RED station
  state_ = ROT_IDLE;
  if (cfg_.releaseWhenIdle) stepper_.release();
}

void Rotation::finishIndex() {
  job_ = JOB_NONE;
  state_ = ROT_IDLE;
  if (cfg_.releaseWhenIdle) stepper_.release();
}

void Rotation::update(uint32_t nowUs) {
  if (job_ == JOB_NONE) return;
  if (!timing_) {
    timing_ = true;
    nextUs_ = nowUs;
  }
  if (static_cast<int32_t>(nowUs - nextUs_) < 0) return;

  stepper_.step(dir_);
  stepsDone_++;
  int32_t limit = static_cast<int32_t>(cfg_.stepsPerRev) * cfg_.searchLimitPercent / 100;

  switch (job_) {
    case JOB_LEAVE_MAGNET:
    case JOB_SEARCH:
      searched_++;
      if (job_ == JOB_LEAVE_MAGNET) {
        if (!hall_.active()) job_ = JOB_SEARCH;
      } else if (hall_.active()) {  // the edge: from here the RED station is homeOffsetDeg further on
        remaining_ = static_cast<int32_t>(cfg_.homeOffsetDeg * cfg_.stepsPerRev / 360.0f + 0.5f);
        stepsDone_ = 0;
        job_ = JOB_OFFSET;
        if (remaining_ == 0) finishHome();
        break;
      }
      if (searched_ >= limit) {
        job_ = JOB_NONE;
        state_ = ROT_FAULT;
        fault_ = FAULT_HOME_NOT_FOUND;
        stepper_.release();
      }
      break;
    case JOB_OFFSET:
      if (--remaining_ <= 0) finishHome();
      break;
    case JOB_INDEX:
      pos_ = mod32(pos_ + dir_, cfg_.stepsPerRev);
      if (--remaining_ <= 0) {
        if (++segIndex_ < segCount_) beginSegment();
        else finishIndex();
      }
      break;
    default:
      break;
  }

  uint32_t interval = intervalUs();
  nextUs_ += interval;
  if (static_cast<int32_t>(nowUs - nextUs_) > static_cast<int32_t>(interval) * 4) nextUs_ = nowUs + interval;  // fell behind: do not burst
}

}  // namespace dispenser
