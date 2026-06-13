#include <Servo.h>

Servo leftFlap;
Servo rightFlap;

const int LEFT_PIN  = 9;
const int RIGHT_PIN = 10;

const int LEVEL_ANGLE    = 90;
const int PITCH_UP_ANGLE = 105;

String inputBuffer = "";

void setup()
{
    Serial.begin(9600);
    leftFlap.attach(LEFT_PIN);
    rightFlap.attach(RIGHT_PIN);
    leftFlap.write(LEVEL_ANGLE);
    rightFlap.write(LEVEL_ANGLE);
    Serial.println("READY");
}

void loop()
{
    while (Serial.available())
    {
        char c = Serial.read();
        if (c == '\n')
        {
            handleCommand(inputBuffer);
            inputBuffer = "";
        }
        else
        {
            inputBuffer += c;
        }
    }
}

void handleCommand(String cmd)
{
    cmd.trim();

    if (cmd == "MOVE_UP")
    {
        leftFlap.write(PITCH_UP_ANGLE);
        rightFlap.write(PITCH_UP_ANGLE);
        Serial.println("ACK_MOVE_UP");
    }
    else if (cmd == "RETURN_LEVEL")
    {
        leftFlap.write(LEVEL_ANGLE);
        rightFlap.write(LEVEL_ANGLE);
        Serial.println("ACK_LEVEL");
    }
    else
    {
        Serial.println("UNKNOWN_CMD");
    }
}
