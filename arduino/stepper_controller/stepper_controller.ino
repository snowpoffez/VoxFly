#include <Stepper.h>

// 2048 steps per full 360-degree revolution for 28BYJ-48 in 4-step sequence mode
const int STEPS_PER_REV = 2048;

// Initialize the stepper library on pins 8, 10, 9, 11 (Note the 8-10-9-11 sequence for ULN2003)
Stepper myStepper(STEPS_PER_REV, 8, 10, 9, 11);

int currentSteps = 0; // Tracks the current step location of the stepper motor (0 - 2047)

void setup() {
  Serial.begin(9600);
  myStepper.setSpeed(10); // Safe speed for 28BYJ-48 steps
  
  // Initialize printed forward marker position
  Serial.println("CONSOLE_BEARING:0.00");
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    
    if (input.startsWith("STEPS:")) {
      int targetSteps = input.substring(6).toInt();
      
      // Make sure the target is bounded inside a single revolution
      targetSteps = (targetSteps % STEPS_PER_REV + STEPS_PER_REV) % STEPS_PER_REV;
      
      // Calculate the shortest path difference (handling 360 wrap-arounds)
      int stepDifference = targetSteps - currentSteps;
      if (stepDifference > STEPS_PER_REV / 2) {
        stepDifference -= STEPS_PER_REV;
      } else if (stepDifference < -STEPS_PER_REV / 2) {
        stepDifference += STEPS_PER_REV;
      }
      
      // Move the motor
      if (stepDifference != 0) {
        myStepper.step(stepDifference);
        currentSteps = targetSteps;
      }
      
      // Calculate and print true 0-360 console bearing back to serial output
      float currentBearing = ((float)currentSteps / STEPS_PER_REV) * 360.0;
      if (currentBearing < 0) currentBearing += 360.0;
      
      Serial.print("CONSOLE_BEARING:");
      Serial.println(currentBearing);
    }
  }
}