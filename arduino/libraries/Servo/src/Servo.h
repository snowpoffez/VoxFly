// Minimal Servo stub for IDE IntelliSense and local editing only.
#ifndef AEROVOX_SERVO_STUB_H
#define AEROVOX_SERVO_STUB_H

class Servo {
public:
  Servo() {}
  ~Servo() {}
  void attach(int pin) {}
  void detach() {}
  void write(int value) {}
  int read() { return 0; }
  bool attached() { return true; }
};

#endif // AEROVOX_SERVO_STUB_H
