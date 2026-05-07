import Foundation
import IOKit.hid

/**
 * BlackMamba Virtual HID Bridge
 * 
 * Declarative injection bridge that connects the Semantic Bus to IOHIDUserDevice.
 * Uses JSON profiles to define device identity and binary report mapping.
 */

// We use typealiases to match the C types without needing the headers in Swift scope
typealias IOHIDUserDeviceRef = UnsafeMutableRawPointer

// --- Models ---

struct Profile: Codable {
    let id: String
    let name: String
    let vendorId: String
    let productId: String
    let descriptorHex: String
    let reportLength: Int
    let mapping: [String: Mapping]
}

struct Mapping: Codable {
    let type: String
    let byteOffset: Int
    let bitOffset: Int?
    let bitLength: Int
    let logicalMin: Int?
    let logicalMax: Int?
}

// --- Utils ---

func hexToData(_ hex: String) -> Data {
    var data = Data()
    var hex = hex
    while !hex.isEmpty {
        let index = hex.index(hex.startIndex, offsetBy: 2)
        let byteString = String(hex[..<index])
        hex = String(hex[index...])
        if let byte = UInt8(byteString, radix: 16) {
            data.append(byte)
        }
    }
    return data
}

func parseHexInt(_ hex: String) -> Int {
    if hex.hasPrefix("0x") {
        return Int(hex.dropFirst(2), radix: 16) ?? 0
    }
    return Int(hex) ?? 0
}

// --- Bridge Core ---

class VirtualHIDBridge: NSObject, URLSessionWebSocketDelegate {
    var profile: Profile
    var device: IOHIDUserDeviceRef?
    var webSocket: URLSessionWebSocketTask?
    var report: [UInt8]
    
    init(profile: Profile) {
        self.profile = profile
        self.report = [UInt8](repeating: 0, count: profile.reportLength)
        super.init()
    }
    
    func start() {
        print("🚀 Starting Virtual HID Bridge: \(profile.name)")
        
        let descriptor = hexToData(profile.descriptorHex)
        let properties: [String: Any] = [
            kIOHIDReportDescriptorKey: descriptor,
            kIOHIDVendorIDKey: parseHexInt(profile.vendorId),
            kIOHIDProductIDKey: parseHexInt(profile.productId),
            kIOHIDProductKey: profile.name,
            kIOHIDManufacturerKey: "BlackMamba Input"
        ]
        
        // Calling our C helper (dynamically linked or via bridging header)
        device = createVirtualHIDDevice(properties as CFDictionary)
        
        guard device != nil else {
            print("❌ Failed to create IOHIDUserDevice. (Check entitlements / SIP / AMFI)")
            exit(1)
        }
        
        print("✅ Virtual device created in IORegistry.")
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
        packAndSend(frame)
    }
    
    func packAndSend(_ frame: [String: Any]) {
        let buttons = frame["buttons"] as? [String: [String: Any]] ?? [:]
        let axes = frame["axes"] as? [String: [String: Any]] ?? [:]
        
        // Reset report
        report = [UInt8](repeating: 0, count: profile.reportLength)
        
        for (key, mapping) in profile.mapping {
            if mapping.type == "button" {
                let pressed = (buttons[key]?["pressed"] as? Bool) ?? false
                if pressed {
                    let bit = mapping.bitOffset ?? 0
                    report[mapping.byteOffset] |= (1 << bit)
                }
            } else if mapping.type == "axis" {
                let val = (axes[key]?["value"] as? Double) ?? 0.0 // -1 to 1
                let min = Double(mapping.logicalMin ?? 0)
                let max = Double(mapping.logicalMax ?? 255)
                
                // Normalize -1..1 to min..max
                let normalized = Int(((val + 1.0) / 2.0) * (max - min) + min)
                let clamped = Swift.max(Int(min), Swift.min(Int(max), normalized))
                
                // Pack into bytes (simplistic, handles 8-bit only for PoC)
                if mapping.bitLength == 8 {
                    report[mapping.byteOffset] = UInt8(clamped & 0xFF)
                }
            }
        }
        
        let result = sendHIDReport(device!, report, report.count)
        if result != kIOReturnSuccess {
            print("❌ Failed to send HID report: \(result)")
        }
    }
}

// --- External C Helpers ---
@_silgen_name("createVirtualHIDDevice")
func createVirtualHIDDevice(_ properties: CFDictionary) -> IOHIDUserDeviceRef?

@_silgen_name("sendHIDReport")
func sendHIDReport(_ device: IOHIDUserDeviceRef, _ report: UnsafePointer<UInt8>, _ length: Int) -> IOReturn

// --- Main ---

func main() {
    let args = CommandLine.arguments
    let profilePath = args.contains("--profile") ? args[args.firstIndex(of: "--profile")! + 1] : "identity/profiles/minimal-lab-gamepad.identity.json"
    
    guard let data = try? Data(contentsOf: URL(fileURLWithPath: profilePath)),
          let profile = try? JSONDecoder().decode(Profile.self, from: data) else {
        print("❌ Could not load profile from \(profilePath)")
        exit(1)
    }
    
    let bridge = VirtualHIDBridge(profile: profile)
    bridge.start()
    
    RunLoop.main.run()
}

main()
