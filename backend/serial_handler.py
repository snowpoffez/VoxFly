import os
import time

PORT = os.environ.get("SERIAL_PORT", "COM3")
BAUD = 9600


def list_ports():
    """Print available serial ports — handy when the port changes between machines."""
    try:
        from serial.tools import list_ports as lp

        ports = list(lp.comports())
        if ports:
            print("[Serial] Available ports:")
            for p in ports:
                print(f"  - {p.device}: {p.description}")
        else:
            print("[Serial] No serial ports found")
    except Exception as e:  # noqa: BLE001
        print(f"[Serial] Could not list ports: {e}")


class SerialHandler:
    def __init__(self):
        self.connection = None

    def connect(self):
        list_ports()
        try:
            import serial

            self.connection = serial.Serial(PORT, BAUD, timeout=1)
            time.sleep(2)  # wait for the Arduino to reset after opening the port
            print(f"[Serial] Connected on {PORT}")
        except Exception as e:  # noqa: BLE001
            print(f"[Serial] Could not connect on {PORT}: {e}")
            self.connection = None

    def send(self, command: str):
        if self.connection and self.connection.is_open:
            self.connection.write(f"{command}\n".encode())
            print(f"[Serial] Sent: {command}")
        else:
            print(f"[Serial] Not connected — would have sent: {command}")

    def close(self):
        if self.connection:
            self.connection.close()
