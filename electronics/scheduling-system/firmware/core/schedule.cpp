#include "schedule.h"

#include <stdio.h>

namespace dispenser {

static const uint8_t SAVE_MAGIC = 0xD5;

Scheduler::Scheduler(uint32_t startSeconds) : count_(0), nextId_(1), seconds_(startSeconds % DAY_S) {}

bool Scheduler::parseTime(const char* text, uint16_t* minutes) {
  if (!text) return false;
  uint8_t i = 0, hourDigits = 0;
  uint16_t h = 0, m = 0;
  while (text[i] >= '0' && text[i] <= '9' && hourDigits < 2) { h = h * 10 + (text[i] - '0'); i++; hourDigits++; }
  if (hourDigits == 0 || text[i] != ':') return false;
  i++;
  if (!(text[i] >= '0' && text[i] <= '9') || !(text[i + 1] >= '0' && text[i + 1] <= '9') || text[i + 2] != '\0') return false;
  m = (text[i] - '0') * 10 + (text[i + 1] - '0');
  if (h > 23 || m > 59) return false;
  *minutes = h * 60 + m;
  return true;
}

void Scheduler::formatTime(uint16_t minutes, char out[6]) {
  snprintf(out, 6, "%02u:%02u", static_cast<unsigned>((minutes / 60) % 24), static_cast<unsigned>(minutes % 60));
}

const char* Scheduler::statusName(EntryStatus s) {
  static const char* const names[] = {"PENDING", "DUE", "TAKING", "TAKEN", "MISSED", "FAILED"};
  return s <= FAILED ? names[s] : "?";
}

AddResult Scheduler::add(Color color, uint16_t minutes, uint8_t* idOut) {
  if (color >= COLOR_COUNT) return ADD_BAD_COLOR;
  if (minutes >= 24 * 60) return ADD_BAD_TIME;
  if (count_ >= MAX_ENTRIES) return ADD_FULL;
  for (uint8_t i = 0; i < count_; i++)
    if (entries_[i].color == color && entries_[i].minutes == minutes) return ADD_DUPLICATE;
  Entry& e = entries_[count_++];
  e.id = nextId_++;
  e.color = color;
  e.minutes = minutes;
  e.status = PENDING;
  e.tomorrow = seconds_ > static_cast<uint32_t>(minutes + GRACE_MIN) * 60UL;
  e.verdict = VERDICT_NONE;
  if (idOut) *idOut = e.id;
  evaluate();
  return ADD_OK;
}

bool Scheduler::remove(uint8_t id) {
  for (uint8_t i = 0; i < count_; i++) {
    if (entries_[i].id == id) {
      for (uint8_t j = i; j + 1 < count_; j++) entries_[j] = entries_[j + 1];
      count_--;
      return true;
    }
  }
  return false;
}

// PENDING -> DUE when the clock reaches the entry; DUE -> MISSED after the grace period.
// TAKING, TAKEN and FAILED are set only by the take flow.
void Scheduler::evaluate() {
  for (uint8_t i = 0; i < count_; i++) {
    Entry& e = entries_[i];
    if (e.tomorrow) continue;
    uint32_t start = static_cast<uint32_t>(e.minutes) * 60UL, end = static_cast<uint32_t>(e.minutes + GRACE_MIN) * 60UL;
    if (e.status == PENDING && seconds_ >= start && seconds_ <= end) e.status = DUE;
    else if ((e.status == PENDING || e.status == DUE) && seconds_ > end) e.status = MISSED;
  }
}

void Scheduler::newDay() {
  for (uint8_t i = 0; i < count_; i++) {
    entries_[i].status = PENDING;
    entries_[i].tomorrow = false;
    entries_[i].verdict = VERDICT_NONE;
  }
}

void Scheduler::setClock(uint32_t secondsOfDay) {
  secondsOfDay %= DAY_S;
  bool wrapped = secondsOfDay < seconds_;
  seconds_ = secondsOfDay;
  if (wrapped) newDay();
  evaluate();
}

void Scheduler::advanceSeconds(uint32_t seconds) {
  uint32_t total = seconds_ + seconds;
  bool wrapped = total >= DAY_S;
  seconds_ = total % DAY_S;
  if (wrapped) newDay();
  evaluate();
}

const Entry* Scheduler::find(uint8_t id) const {
  for (uint8_t i = 0; i < count_; i++) if (entries_[i].id == id) return &entries_[i];
  return nullptr;
}

Entry* Scheduler::findMutable(uint8_t id) { return const_cast<Entry*>(find(id)); }

bool Scheduler::before(const Entry* a, const Entry* b) {
  return a->minutes != b->minutes ? a->minutes < b->minutes : a->color < b->color;
}

uint8_t Scheduler::sorted(const Entry* out[MAX_ENTRIES]) const {
  for (uint8_t i = 0; i < count_; i++) out[i] = &entries_[i];
  for (uint8_t i = 1; i < count_; i++) {  // insertion sort, at most 8 items
    const Entry* e = out[i];
    int8_t j = i - 1;
    while (j >= 0 && before(e, out[j])) { out[j + 1] = out[j]; j--; }
    out[j + 1] = e;
  }
  return count_;
}

const Entry* Scheduler::due() const {
  const Entry* best = nullptr;
  for (uint8_t i = 0; i < count_; i++)
    if (entries_[i].status == DUE && (!best || before(&entries_[i], best))) best = &entries_[i];
  return best;
}

const Entry* Scheduler::next() const {
  const Entry* today = nullptr;
  const Entry* later = nullptr;
  for (uint8_t i = 0; i < count_; i++) {
    const Entry* e = &entries_[i];
    if (e->status != PENDING) continue;
    const Entry*& slot = e->tomorrow ? later : today;
    if (!slot || before(e, slot)) slot = e;
  }
  return today ? today : later;
}

bool Scheduler::beginTake(uint8_t id) {
  Entry* e = findMutable(id);
  if (!e || e->status != DUE) return false;
  e->status = TAKING;
  return true;
}

void Scheduler::abortTake(uint8_t id) {
  Entry* e = findMutable(id);
  if (e && e->status == TAKING) e->status = DUE;
}

bool Scheduler::finishTake(uint8_t id, Verdict verdict) {
  Entry* e = findMutable(id);
  if (!e || e->status != TAKING) return false;
  e->status = verdict == VERIFIED ? TAKEN : FAILED;
  e->verdict = verdict;
  return true;
}

// Format: magic, count, nextId, then per entry id, colour, minutes low byte, minutes high byte.
size_t Scheduler::save(uint8_t* buf, size_t capacity) const {
  size_t need = 3 + static_cast<size_t>(count_) * 4;
  if (capacity < need) return 0;
  buf[0] = SAVE_MAGIC;
  buf[1] = count_;
  buf[2] = nextId_;
  for (uint8_t i = 0; i < count_; i++) {
    uint8_t* p = buf + 3 + i * 4;
    p[0] = entries_[i].id;
    p[1] = entries_[i].color;
    p[2] = entries_[i].minutes & 0xFF;
    p[3] = entries_[i].minutes >> 8;
  }
  return need;
}

bool Scheduler::load(const uint8_t* buf, size_t length) {
  if (length < 3 || buf[0] != SAVE_MAGIC || buf[1] > MAX_ENTRIES || length < 3 + static_cast<size_t>(buf[1]) * 4) return false;
  Entry loaded[MAX_ENTRIES];
  for (uint8_t i = 0; i < buf[1]; i++) {
    const uint8_t* p = buf + 3 + i * 4;
    uint16_t minutes = p[2] | (static_cast<uint16_t>(p[3]) << 8);
    if (p[1] >= COLOR_COUNT || minutes >= 24 * 60) return false;
    loaded[i] = Entry{p[0], static_cast<Color>(p[1]), minutes, PENDING, false, VERDICT_NONE};
  }
  count_ = buf[1];
  nextId_ = buf[2];
  for (uint8_t i = 0; i < count_; i++) {
    entries_[i] = loaded[i];
    entries_[i].tomorrow = seconds_ > static_cast<uint32_t>(entries_[i].minutes + GRACE_MIN) * 60UL;
  }
  evaluate();
  return true;
}

}  // namespace dispenser
