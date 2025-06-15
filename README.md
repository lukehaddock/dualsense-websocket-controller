# DualSense WebSocket Controller

A Node.js server that reads input from one or more PlayStation 5 DualSense controllers and broadcasts the data via WebSocket. Perfect for game development, interactive applications, or custom controller interfaces.

## Features

- Support for multiple DualSense controllers
- Real-time WebSocket data broadcasting
- Automatic controller calibration
- Deadzone handling for analog sticks
- Normalized analog values (-1 to 1 for sticks, 0 to 1 for triggers)
- Support for all DualSense buttons, including:
  - Face buttons (Square, Cross, Circle, Triangle)
  - Shoulder buttons (L1, R1, L2, R2)
  - Stick buttons (L3, R3)
  - D-pad
  - Create, Options, PS, and Mute buttons

## Prerequisites

- Node.js 14.0 or higher
- One or more PlayStation 5 DualSense controllers
- USB connection (wired mode)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/dualsense-websocket-controller.git
cd dualsense-websocket-controller
```

2. Install dependencies:
```bash
npm install
```

## Usage

1. Connect your DualSense controller(s) via USB
2. Start the server:
```bash
sudo node server.js
```
Note: `sudo` is required for HID device access on macOS and Linux.

3. Connect to the WebSocket server at `ws://localhost:8080`

## WebSocket API

The server broadcasts controller data in the following format:

```json
{
    "type": "controllers",
    "controllers": [
        {
            "buttons": {
                "square": false,
                "cross": false,
                "circle": false,
                "triangle": false,
                "l1": false,
                "r1": false,
                "create": false,
                "options": false,
                "l3": false,
                "r3": false,
                "ps": false,
                "mute": false
            },
            "dpad": {
                "up": false,
                "right": false,
                "down": false,
                "left": false
            },
            "leftStick": {
                "x": 0,  // -1 to 1
                "y": 0   // -1 to 1
            },
            "rightStick": {
                "x": 0,  // -1 to 1
                "y": 0   // -1 to 1
            },
            "triggers": {
                "l2": 0,  // 0 to 1
                "r2": 0   // 0 to 1
            }
        }
        // Additional controllers follow the same format
    ]
}
```

### Value Ranges

- Analog sticks: -1 to 1 (centered at 0)
- Triggers: 0 to 1 (normalized float)
- Buttons and D-pad: boolean values

## Integration Example

Here's a simple example of how to connect to the WebSocket server using JavaScript:

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'controllers') {
        // Access first controller's data
        const controller = data.controllers[0];
        
        // Example: Check if X button is pressed
        if (controller.buttons.cross) {
            console.log('X button pressed!');
        }
        
        // Example: Get left stick position
        const leftStickX = controller.leftStick.x;
        const leftStickY = controller.leftStick.y;
    }
};
```

## Troubleshooting

1. **Controller not detected**
   - Ensure the controller is connected via USB
   - Try resetting the controller (hold PS + Share buttons for 10 seconds)
   - Check if the controller appears in system settings

2. **Permission denied errors**
   - Make sure to run the server with `sudo`
   - On Linux, you might need to add udev rules for the controller

3. **WebSocket connection issues**
   - Verify the server is running (`node server.js`)
   - Check if port 8080 is available
   - Ensure your client is connecting to the correct WebSocket URL

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- Based on the `node-hid` library
- Inspired by the Linux kernel's DualSense driver