import Foundation
import GameController

/**
 * BlackMamba Virtual Xbox Bridge
 * 
 * Connects to the live-monitor WebSocket and translates semantic frames 
 * into a native macOS GCVirtualController. This allows HID controllers
 * (like the Rock Candy Switch controller) to be recognized as Xbox-compatible
 * by apps like Chrome (xCloud) and Safari.
 */

class XboxBridge: NSObject, URLSessionWebSocketDelegate {
    var virtualController: GCVirtualController?
    var webSocket: URLSessionWebSocketTask?
    var isConnected = false
    
    func start() {
        print("🚀 Starting Virtual Xbox Bridge...")
        
        // GCVirtualController is available on macOS 12.0+
        guard #available(macOS 12.0, *) else {
            print("❌ GCVirtualController requires macOS 12.0 or newer.")
            exit(1)
        }
        
        let config = GCVirtualController.Configuration()
        config.elements = [
            GCInputButtonA, GCInputButtonB, GCInputButtonX, GCInputButtonY,
            GCInputLeftShoulder, GCInputRightShoulder,
            GCInputLeftTrigger, GCInputRightTrigger,
            GCInputLeftThumbstick, GCInputRightThumbstick,
            GCInputDirectionPad,
            GCInputButtonMenu, GCInputButtonOptions, GCInputButtonHome,
            GCInputLeftThumbstickButton, GCInputRightThumbstickButton
        ]
        
        virtualController = GCVirtualController(configuration: config)
        virtualController?.connect { error in
            if let error = error {
                print("❌ Failed to connect virtual controller: \(error)")
                exit(1)
            }
            print("✅ Virtual controller connected to system.")
        }
        
        connectWebSocket()
    }
    
    func connectWebSocket() {
        let url = URL(string: "ws://127.0.0.1:8137/live")!
        let session = URLSession(configuration: .default, delegate: self, delegateQueue: OperationQueue())
        webSocket = session.webSocketTask(with: url)
        webSocket?.resume()
        
        receiveMessage()
    }
    
    func receiveMessage() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                default:
                    break
                }
                self?.receiveMessage()
            case .failure(let error):
                print("⚠️ WebSocket disconnected: \(error). Retrying in 3s...")
                Thread.sleep(forTimeInterval: 3)
                self?.connectWebSocket()
            }
        }
    }
    
    func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }
        
        if json["type"] as? String == "hello" {
            print("👋 Handshake complete with live-monitor.")
            return
        }
        
        guard json["type"] as? String == "semantic-frame",
              let frame = json["frame"] as? [String: Any] else {
            return
        }
        
        updateController(frame)
    }
    
    func updateController(_ frame: [String: Any]) {
        guard let controller = virtualController?.controller,
              let gamepad = controller.extendedGamepad else {
            return
        }
        
        let b = frame["buttons"] as? [String: [String: Any]] ?? [:]
        let a = frame["axes"] as? [String: [String: Any]] ?? [:]
        
        func val(_ name: String) -> Float {
            if let btn = b[name] {
                return Float(btn["value"] as? Double ?? 0)
            }
            if let axis = a[name] {
                return Float(axis["value"] as? Double ?? 0)
            }
            return 0
        }
        
        // Buttons
        gamepad.buttonA.setValue(val("A"))
        gamepad.buttonB.setValue(val("B"))
        gamepad.buttonX.setValue(val("X"))
        gamepad.buttonY.setValue(val("Y"))
        
        gamepad.leftShoulder.setValue(val("LB"))
        gamepad.rightShoulder.setValue(val("RB"))
        gamepad.leftTrigger.setValue(val("LT"))
        gamepad.rightTrigger.setValue(val("RT"))
        
        // Sticks
        gamepad.leftThumbstick.xAxis.setValue(val("LX"))
        gamepad.leftThumbstick.yAxis.setValue(-val("LY")) // Inverted in Gamepad API vs GCController
        gamepad.rightThumbstick.xAxis.setValue(val("RX"))
        gamepad.rightThumbstick.yAxis.setValue(-val("RY"))
        
        // D-Pad
        gamepad.dpad.up.setValue(val("DPad_Up") > 0 ? val("DPad_Up") : val("Up"))
        gamepad.dpad.down.setValue(val("DPad_Down") > 0 ? val("DPad_Down") : val("Down"))
        gamepad.dpad.left.setValue(val("DPad_Left") > 0 ? val("DPad_Left") : val("Left"))
        gamepad.dpad.right.setValue(val("DPad_Right") > 0 ? val("DPad_Right") : val("Right"))
        
        // Menu/Back
        gamepad.buttonMenu.setValue(val("Start"))
        gamepad.buttonOptions?.setValue(val("Select") > 0 ? val("Select") : val("Back"))
        gamepad.buttonHome?.setValue(val("Home") > 0 ? val("Home") : val("Guide"))
        
        // Stick clicks
        gamepad.leftThumbstickButton?.setValue(val("LS") > 0 ? val("LS") : val("L3"))
        gamepad.rightThumbstickButton?.setValue(val("RS") > 0 ? val("RS") : val("R3"))
    }
}

let bridge = XboxBridge()
bridge.start()

RunLoop.main.run()
