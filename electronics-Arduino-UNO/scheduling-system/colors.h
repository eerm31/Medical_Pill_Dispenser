// colors.h
// The four pill colours. Every colour is also a station on the drum, a quarter turn apart.
// RED is the home station (position 0).

#ifndef COLORS_H
#define COLORS_H

enum Color {
    RED = 0,
    BLUE = 1,
    GREEN = 2,
    ORANGE = 3,
    COLOR_COUNT = 4,   // how many colours there are
    NO_COLOR = 255     // means "no colour"
};

// Gives the name of a colour, for example RED -> "red".
const char* colorName(Color c);

// Looks a colour up by its name. Returns false if the name is not a colour.
bool colorFromName(const char* text, Color* result);

#endif
