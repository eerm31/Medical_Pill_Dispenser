# Host tests for the rotation mechanism: make   (needs a C++11 compiler, no Arduino, no hardware)
CXX ?= g++
CXXFLAGS ?= -std=c++11 -Wall -Wextra -Werror -O1
FW := ../firmware

all: build/test_main check-firmware
	./build/test_main

# main.cpp and the hardware layer cannot run on a laptop, but they must at least compile against a stub of the Arduino core.
check-firmware:
	$(CXX) -std=c++11 -Wall -Wextra -fsyntax-only -Iarduino_stub -I$(FW) $(FW)/main.cpp

build/test_main: $(FW)/core/rotation.cpp test_main.cpp fake_drive.h $(wildcard $(FW)/core/*.h)
	mkdir -p build
	$(CXX) $(CXXFLAGS) -I$(FW) $(FW)/core/rotation.cpp test_main.cpp -o $@

clean:
	rm -rf build

.PHONY: all clean check-firmware
