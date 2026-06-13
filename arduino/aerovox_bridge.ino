#include <Arduino.h>
#include <Servo.h>

Servo myServo;


void setup() {
  Serial.begin(9600);     // Open serial port at 9600 bps
  myServo.attach(9);      // Assumes servo signal wire is on Pin 9
  myServo.write(90);      // Start the plane flat (90 degrees)
}


void loop() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();


    int angle = command.toInt();


    // Move the motor if it's a valid angle between 0 and 180
    if (angle >= 0 && angle <= 180) {
      myServo.write(angle);  
    }
  }
}
