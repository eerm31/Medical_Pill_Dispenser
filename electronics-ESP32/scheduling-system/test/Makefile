# Tests for the scheduling system. Run with: make   (needs a C++ compiler, no Arduino, no hardware)
# The automatic-rotation tests use the rotation code from ../../rotation-mechanism
CXX ?= g++
CXXFLAGS ?= -std=c++11 -Wall -Wextra -Werror -O1
FW := ../firmware
ROT := ../../rotation-mechanism
INCLUDES := -I$(FW) -I$(ROT)/firmware
SOURCES := $(FW)/core/schedule.cpp $(FW)/core/auto_rotate.cpp $(FW)/core/cartridge_turn.cpp $(ROT)/firmware/core/rotation.cpp $(ROT)/firmware/core/colors.cpp test_main.cpp

all: build/test_main check-firmware
	./build/test_main

# main.cpp cannot run on a laptop, but it must at least compile against a tiny fake Arduino.h.
check-firmware:
	$(CXX) -std=c++11 -Wall -Wextra -fsyntax-only -I$(ROT)/test/arduino_stub $(INCLUDES) $(FW)/main.cpp

build/test_main: $(SOURCES) $(ROT)/test/fake_drive.h $(wildcard $(FW)/core/*.h) $(wildcard $(ROT)/firmware/core/*.h)
	mkdir -p build
	$(CXX) $(CXXFLAGS) $(INCLUDES) $(SOURCES) -o $@

clean:
	rm -rf build

.PHONY: all clean check-firmware
