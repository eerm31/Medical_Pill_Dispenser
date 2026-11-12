// my_schedule.h
// Edit this file to change the dose schedule. It is loaded every time the board starts.
// Until a touchscreen exists, this is where the schedule is entered.
// Maximum 8 doses (MAX_ENTRIES in schedule.h).

#ifndef MY_SCHEDULE_H
#define MY_SCHEDULE_H

#include "colors.h"

// The time the clock starts at when the board powers on (there is no RTC yet).
#define START_TIME "08:00"

// How the cartridge turns when a dose is due (there is no pin, turning the cartridge is the dispensing).
// Every pill is one move of DEGREES_PER_PILL. A new move starts PAUSE_MS_AFTER_MOVE after the last one started.
#define DEGREES_PER_PILL 30        // 30 degrees = 12 moves for a full turn (it must divide 360)
#define PAUSE_MS_AFTER_MOVE 1000   // time between two pills of a dose, in milliseconds (the sketch never allows less)
#define STEP_INTERVAL_US 1500      // time between motor steps, smaller = faster
#define TURN_DIRECTION 1           // 1 or -1, swap it if the cartridge turns the wrong way
#define REFILL_FIRST_DIRECTION -1  // the moves before the first pill: -1 turns against the dispensing direction (clockwise), 1 with it
#define REFILL_DIRECTION 1         // the move after each pill: 1 turns with the dispensing direction (counter-clockwise), -1 against it

struct PlannedDose {
    Color color;
    const char* time;   // "HH:MM", 24-hour
    int pills;          // how many pills to dispense (1 to MAX_PILLS)
    uint32_t recur_interval;  // recurrence interval in seconds (0 = no recurrence)
};

// one line per dose: {colour, time, pills, recur_interval_seconds}
// PUT SCHEDULE INPUT HERE
// Only one cartridge for now (RED, the home station), so every dose uses RED.
// The clock starts at 08:00, so a dose is due every minute.
// recur_interval_seconds: 0 = no recurrence, 3600 = every hour, 21600 = every 6 hours, etc.
static const PlannedDose MY_DOSES[] = {
    {RED, "08:01", 1, 0},
    {RED, "08:02", 2, 0},
    {RED, "08:03", 3, 0}
};

#define MY_DOSE_COUNT (sizeof(MY_DOSES) / sizeof(MY_DOSES[0]))

#endif
