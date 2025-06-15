import { WebSocketServer } from 'ws';
import HID from 'node-hid';

// Start WebSocket server
const wss = new WebSocketServer({ port: 8080 });
const clients = new Set();

// Stick calibration settings
const STICK_DEADZONE = 0.1;  // Ignore movements smaller than this
const STICK_CALIBRATION_SAMPLES = 100;  // Number of samples to take for calibration
const STICK_CALIBRATION_DELAY = 50;  // ms between calibration samples

wss.on('error', (error) => {
    console.error('WebSocket Server Error:', error);
});

wss.on('connection', (ws) => {
    console.log('New client connected');
    clients.add(ws);
    
    // Send a test message immediately after connection
    ws.send(JSON.stringify({ type: 'test', message: 'WebSocket connection successful' }));
    
    ws.on('error', (error) => {
        console.error('WebSocket Client Error:', error);
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

function broadcast(data) {
    try {
        const msg = JSON.stringify(data);
        console.log('Broadcasting:', msg);
        for (const ws of clients) {
            if (ws.readyState === ws.OPEN) {
                console.log('Sending to client...');
                ws.send(msg, (error) => {
                    if (error) {
                        console.error('Error sending message:', error);
                    }
                });
            } else {
                console.log('Client not ready, state:', ws.readyState);
            }
        }
    } catch (error) {
        console.error('Error in broadcast:', error);
    }
}

// Initialize HID devices
try {
    console.log('Searching for HID devices...');
    
    // List all HID devices
    const devices = HID.devices();
    console.log('All HID devices found:', JSON.stringify(devices, null, 2));
    
    // Find all DualSense controllers
    const dualSenseControllers = devices.filter(device => {
        const isDualSense = device.vendorId === 0x054C && device.productId === 0x0CE6;
        if (isDualSense) {
            console.log('Found DualSense controller:', {
                path: device.path,
                manufacturer: device.manufacturer,
                product: device.product,
                serialNumber: device.serialNumber
            });
        }
        return isDualSense;
    });
    
    if (dualSenseControllers.length > 0) {
        console.log(`Found ${dualSenseControllers.length} DualSense controller(s):`, JSON.stringify(dualSenseControllers, null, 2));
        
        // Store controller data
        const controllerData = new Array(dualSenseControllers.length).fill(null);
        
        // Create a controller instance for each DualSense
        const controllers = dualSenseControllers.map((device, index) => {
            console.log(`Attempting to connect to controller ${index} at path: ${device.path}`);
            try {
                const controller = new HID.HID(device.path);
                console.log(`Successfully connected to controller ${index}`);
                
                // Calibration data for each controller
                let calibrationData = {
                    leftStick: { x: 0, y: 0, samples: 0 },
                    rightStick: { x: 0, y: 0, samples: 0 },
                    isCalibrated: false
                };

                // Function to apply deadzone and calibration
                function processStickValue(value, center) {
                    // Apply calibration
                    let calibrated = value - center;
                    
                    // Apply deadzone with smooth transition
                    if (Math.abs(calibrated) < STICK_DEADZONE) {
                        // Smooth transition to zero
                        return calibrated * (Math.abs(calibrated) / STICK_DEADZONE);
                    }
                    
                    // Rescale the remaining range
                    const sign = Math.sign(calibrated);
                    const magnitude = (Math.abs(calibrated) - STICK_DEADZONE) / (1 - STICK_DEADZONE);
                    return sign * magnitude;
                }

                // Start calibration process
                console.log(`Starting calibration for controller ${index}...`);
                let calibrationInterval = setInterval(() => {
                    if (calibrationData.leftStick.samples < STICK_CALIBRATION_SAMPLES) {
                        try {
                            const data = controller.readSync();
                            if (data.length === 64) {
                                // Accumulate samples for left stick
                                calibrationData.leftStick.x += data[1];
                                calibrationData.leftStick.y += data[2];
                                calibrationData.leftStick.samples++;
                                
                                // Accumulate samples for right stick
                                calibrationData.rightStick.x += data[3];
                                calibrationData.rightStick.y += data[4];
                                calibrationData.rightStick.samples++;
                            }
                        } catch (error) {
                            console.error(`Error reading from controller ${index}:`, error);
                            clearInterval(calibrationInterval);
                        }
                    } else {
                        // Calculate average center positions
                        calibrationData.leftStick.x /= STICK_CALIBRATION_SAMPLES;
                        calibrationData.leftStick.y /= STICK_CALIBRATION_SAMPLES;
                        calibrationData.rightStick.x /= STICK_CALIBRATION_SAMPLES;
                        calibrationData.rightStick.y /= STICK_CALIBRATION_SAMPLES;
                        
                        // Convert to -1 to 1 range
                        calibrationData.leftStick.x = (calibrationData.leftStick.x - 128) / 128;
                        calibrationData.leftStick.y = (calibrationData.leftStick.y - 128) / 128;
                        calibrationData.rightStick.x = (calibrationData.rightStick.x - 128) / 128;
                        calibrationData.rightStick.y = (calibrationData.rightStick.y - 128) / 128;
                        
                        calibrationData.isCalibrated = true;
                        clearInterval(calibrationInterval);
                        console.log(`Calibration complete for controller ${index}:`, calibrationData);
                    }
                }, STICK_CALIBRATION_DELAY);
                
                // Handle controller data
                controller.on('data', (data) => {
                    // DualSense sends 64 bytes of data
                    if (data.length === 64 && calibrationData.isCalibrated) {
                        // Parse button states
                        const buttons = {
                            square: (data[8] & 0x10) !== 0,
                            cross: (data[8] & 0x20) !== 0,
                            circle: (data[8] & 0x40) !== 0,
                            triangle: (data[8] & 0x80) !== 0,
                            l1: (data[9] & 0x01) !== 0,
                            r1: (data[9] & 0x02) !== 0,
                            create: (data[9] & 0x10) !== 0,
                            options: (data[9] & 0x20) !== 0,
                            l3: (data[9] & 0x40) !== 0,  // Left stick press
                            r3: (data[9] & 0x80) !== 0,  // Right stick press
                            ps: (data[10] & 0x01) !== 0,
                            mute: (data[10] & 0x04) !== 0
                        };

                        // Parse D-pad
                        const dpadValue = data[8] & 0x0F;  // Get only the first 4 bits
                        const dpad = {
                            up: dpadValue === 0 || dpadValue === 1 || dpadValue === 7,
                            right: dpadValue === 1 || dpadValue === 2 || dpadValue === 3,
                            down: dpadValue === 3 || dpadValue === 4 || dpadValue === 5,
                            left: dpadValue === 5 || dpadValue === 6 || dpadValue === 7
                        };
                        
                        // Process stick values with calibration and deadzone
                        const leftStick = {
                            x: processStickValue((data[1] - 128) / 128, calibrationData.leftStick.x),
                            y: processStickValue((data[2] - 128) / 128, calibrationData.leftStick.y)
                        };
                        
                        const rightStick = {
                            x: processStickValue((data[3] - 128) / 128, calibrationData.rightStick.x),
                            y: processStickValue((data[4] - 128) / 128, calibrationData.rightStick.y)
                        };
                        
                        // Parse trigger values (L2 and R2 are analog)
                        const triggers = {
                            l2: data[5] / 255,  // Normalize to 0-1
                            r2: data[6] / 255   // Normalize to 0-1
                        };

                        // Store this controller's data
                        controllerData[index] = {
                            buttons,
                            dpad,
                            leftStick,
                            rightStick,
                            triggers
                        };

                        // Broadcast all controller data
                        broadcast({
                            type: 'controllers',
                            controllers: controllerData
                        });
                    }
                });
                
                controller.on('error', (error) => {
                    console.error(`Controller ${index} error:`, error);
                });

                return controller;
            } catch (error) {
                console.error(`Failed to connect to controller ${index}:`, error);
                return null;
            }
        }).filter(controller => controller !== null);

        if (controllers.length > 0) {
            broadcast({ 
                type: 'status', 
                status: 'connected', 
                message: `Connected ${controllers.length} DualSense controller(s)` 
            });
        } else {
            console.log('No controllers were successfully connected');
            broadcast({ type: 'status', status: 'disconnected', message: 'No controllers were successfully connected' });
        }
    } else {
        console.log('No DualSense controllers found');
        broadcast({ type: 'status', status: 'disconnected', message: 'No controllers found' });
    }
} catch (error) {
    console.error('Error initializing HID:', error);
    broadcast({ type: 'status', status: 'error', message: error.message });
}

console.log('WebSocket server started on port 8080');
console.log('Connect your PS5 DualSense controller(s) and open client.html to view events.'); 