// colors.cpp

#include <string.h>
#include "colors.h"

const char* colorName(Color c) {
    if (c == RED) {
        return "red";
    }
    if (c == BLUE) {
        return "blue";
    }
    if (c == GREEN) {
        return "green";
    }
    if (c == ORANGE) {
        return "orange";
    }
    return "none";
}

bool colorFromName(const char* text, Color* result) {
    int i;
    for (i = 0; i < COLOR_COUNT; i++) {
        Color c = (Color)i;
        if (strcmp(text, colorName(c)) == 0) {
            *result = c;
            return true;
        }
    }
    return false;
}
