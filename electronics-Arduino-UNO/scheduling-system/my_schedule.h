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
// Every pill is one move of DEGREES_PER_PILL, then a short pause so the pill can fall.
#define DEGREES_PER_PILL 30        // 30 degrees = 12 moves for a full turn (it must divide 360)
#define PAUSE_MS_AFTER_MOVE 1000   // wait after each move, in milliseconds
#define STEP_INTERVAL_US 1500      // time between motor steps, smaller = faster
#define TURN_DIRECTION 1           // 1 or -1, swap it if the cartridge turns the wrong way

struct PlannedDose {
    Color color;
    const char* time;   // "HH:MM", 24-hour
    int pills;          // how many pills to dispense (1 to MAX_PILLS)
};

// one line per dose: {colour, time, pills}
// PUT SCHEDULE INPUT HERE
// Only one cartridge for now (RED, the home station), so every dose uses RED.
// The clock starts at 08:00, so a dose is due every minute.
static const PlannedDose MY_DOSES[] = {
    {RED, "08:01", 1},
    {RED, "08:02", 2},
    {RED, "08:03", 3}
};

#define MY_DOSE_COUNT (sizeof(MY_DOSES) / sizeof(MY_DOSES[0]))

#endif
