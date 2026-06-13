// AeroVox Arduino Controller
// ─────────────────────────────────────────────────────────────
// This file receives serial commands from the Node.js backend.
//
// Serial protocol:
//   Input format:  "YAW:90,PITCH:15\n"
//   Baud rate:     9600
//   Servo 1 (yaw):   pin 9  — maps received value 0-180 to servo angle
//   Servo 2 (pitch):  pin 10 — maps received value -15 to +20 to servo angle
//
// Yaw mapping:    0° bearing = 0°, 360° bearing = 180° servo
// Pitch mapping:  -15° = nose down (servo ~60°), +20° = nose up (servo ~130°)
//
// TODO: implement Serial.parseInt() parsing for "YAW:x,PITCH:y" format
// TODO: attach both Servo objects and write angles on each update
// TODO: add a heartbeat LED on pin 13 that blinks on each received command
// ─────────────────────────────────────────────────────────────

#include <Servo.h>

// Your implementation goes here
