import Foundation
import GameController

/**
 * BlackMamba Dynamic Virtual Xbox Bridge
 * 
 * This version uses the Objective-C runtime to access GCVirtualController
 * even if it's not present in the current SDK headers.
 */

class DynamicXboxBridge: NSObject, URLSessionWebSocketDelegate {
    var virtualController: AnyObject?
    var webSocket: URLSessionWebSocketTask?
    
    func start() {
        print("🚀 Starting Dynamic Virtual Xbox Bridge...")
        
        // Ensure GameController is loaded
        if dlopen("/System/Library/Frameworks/GameController.framework/GameController", RTLD_NOW) == nil {
             dlopen("GameController", RTLD_NOW)
        }

        guard let GCVirtualControllerClass = NSClassFromString("GCVirtualController") else {
            print("❌ GCVirtualController class not found in runtime.")
            
            // Log available classes for debugging
            if NSClassFromString("GCController") != nil {
                print("ℹ️ GCController IS available, but GCVirtualController IS NOT.")
            }
            exit(1)
        }
        
        setupController(GCVirtualControllerClass)
    }
    
    func setupController(_ cls: AnyClass) {
        print("🛠 Setting up virtual controller via dynamic dispatch...")
        
        // We need to build the configuration
        guard let ConfigClass = NSClassFromString("GCVirtualControllerConfiguration") as? NSObject.Type else {
            print("❌ GCVirtualControllerConfiguration class not found.")
            exit(1)
        }
        
        let config = ConfigClass.init()
        
        // Elements we want to enable (using string constants from the framework)
        let elements: Set<String> = [
            "Button A", "Button B", "Button X", "Button Y",
            "Left Shoulder", "Right Shoulder",
            "Left Trigger", "Right Trigger",
            "Left Thumbstick", "Right Thumbstick",
            "Direction Pad",
            "Button Menu", "Button Options", "Button Home",
            "Left Thumbstick Button", "Right Thumbstick Button"
        ]
        
        config.setValue(elements, forKey: "elements")
        
        // Instantiate the controller: [GCVirtualController virtualControllerWithConfiguration:config]
        let selector = NSSelectorFromString("virtualControllerWithConfiguration:")
        if cls.responds(to: selector) {
            let method = cls.method(for: selector)
            typealias MethodType = @convention(c) (AnyClass, Selector, Any) -> AnyObject
            let function = unsafeBitCast(method, to: MethodType.self)
            virtualController = function(cls, selector, config)
            
            print("🔌 Connecting virtual controller...")
            let connectSelector = NSSelectorFromString("connectWithReplyHandler:")
            if let vc = virtualController, vc.responds(to: connectSelector) {
                // We use a block for the reply handler
                let replyHandler: @convention(block) (Error?) -> Void = { error in
                    if let error = error {
                        print("❌ Connection error: \(error)")
                    } else {
                        print("✅ Virtual controller CONNECTED.")
                    }
                }
                vc.perform(connectSelector, with: replyHandler)
            }
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
                if case .string(let text) = message { self?.handleMessage(text) }
                self?.receiveMessage()
            case .failure(let error):
                print("⚠️ WebSocket disconnected: \(error). Retrying...")
                Thread.sleep(forTimeInterval: 3)
                self?.connectWebSocket()
            }
        }
    }
    
    func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              json["type"] as? String == "semantic-frame",
              let frame = json["frame"] as? [String: Any] else {
            return
        }
        updateController(frame)
    }
    
    func updateController(_ frame: [String: Any]) {
        // This part is harder to do dynamically because it involves many calls
        // For a first test, just logging receipt is enough
        // print("Received frame: \(frame["timestampMs"] ?? 0)")
        
        guard let vc = virtualController,
              let controller = vc.value(forKey: "controller") as? GCController,
              let gamepad = controller.extendedGamepad else {
            return
        }
        
        let b = frame["buttons"] as? [String: [String: Any]] ?? [:]
        let a = frame["axes"] as? [String: [String: Any]] ?? [:]
        
        func val(_ name: String) -> Float {
            if let btn = b[name] { return Float(btn["value"] as? Double ?? 0) }
            if let axis = a[name] { return Float(axis["value"] as? Double ?? 0) }
            return 0
        }
        
        gamepad.buttonA.setValue(val("A"))
        gamepad.buttonB.setValue(val("B"))
        gamepad.buttonX.setValue(val("X"))
        gamepad.buttonY.setValue(val("Y"))
        gamepad.leftShoulder.setValue(val("LB"))
        gamepad.rightShoulder.setValue(val("RB"))
        gamepad.leftTrigger.setValue(val("LT"))
        gamepad.rightTrigger.setValue(val("RT"))
        gamepad.leftThumbstick.xAxis.setValue(val("LX"))
        gamepad.leftThumbstick.yAxis.setValue(-val("LY"))
        gamepad.rightThumbstick.xAxis.setValue(val("RX"))
        gamepad.rightThumbstick.yAxis.setValue(-val("RY"))
        
        gamepad.dpad.up.setValue(val("DPad_Up") > 0 ? val("DPad_Up") : val("Up"))
        gamepad.dpad.down.setValue(val("DPad_Down") > 0 ? val("DPad_Down") : val("Down"))
        gamepad.dpad.left.setValue(val("DPad_Left") > 0 ? val("DPad_Left") : val("Left"))
        gamepad.dpad.right.setValue(val("DPad_Right") > 0 ? val("DPad_Right") : val("Right"))
        
        gamepad.buttonMenu.setValue(val("Start"))
        gamepad.buttonOptions?.setValue(val("Select") > 0 ? val("Select") : val("Back"))
        gamepad.buttonHome?.setValue(val("Home") > 0 ? val("Home") : val("Guide"))
        
        gamepad.leftThumbstickButton?.setValue(val("LS") > 0 ? val("LS") : val("L3"))
        gamepad.rightThumbstickButton?.setValue(val("RS") > 0 ? val("RS") : val("R3"))
    }
}

let bridge = DynamicXboxBridge()
bridge.start()
RunLoop.main.run()
