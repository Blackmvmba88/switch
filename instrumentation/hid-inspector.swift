import Foundation
import IOKit.hid

/**
 * HID Inspector
 * 
 * Monitors a specific HID device by VID/PID and logs raw input reports.
 * Used to verify that the Virtual HID Bridge is emitting the correct bytes.
 */

func timestamp() -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm:ss.SSS"
    return formatter.string(from: Date())
}

func main() {
    let args = CommandLine.arguments
    let vid = args.contains("--vid") ? Int(args[args.firstIndex(of: "--vid")! + 1].dropFirst(2), radix: 16) ?? 0xFEED : 0xFEED
    let pid = args.contains("--pid") ? Int(args[args.firstIndex(of: "--pid")! + 1].dropFirst(2), radix: 16) ?? 0xBEEF : 0xBEEF
    
    print("🕵️  HID Inspector starting (looking for VID: 0x\(String(vid, radix: 16)), PID: 0x\(String(pid, radix: 16)))...")
    
    let manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
    let matching: [String: Any] = [
        kIOHIDVendorIDKey as String: vid,
        kIOHIDProductIDKey as String: pid
    ]
    
    IOHIDManagerSetDeviceMatching(manager, matching as CFDictionary)
    
    let deviceMatchingCallback: IOHIDDeviceCallback = { _, _, _, device in
        let name = IOHIDDeviceGetProperty(device, kIOHIDProductKey as CFString) as? String ?? "unknown"
        print("[\(timestamp())] ✅ Device connected: \(name)")
    }
    
    let deviceRemovalCallback: IOHIDDeviceCallback = { _, _, _, device in
        let name = IOHIDDeviceGetProperty(device, kIOHIDProductKey as CFString) as? String ?? "unknown"
        print("[\(timestamp())] ❌ Device removed: \(name)")
    }
    
    let inputCallback: IOHIDReportCallback = { _, _, _, type, reportID, report, reportLength in
        let hex = UnsafeBufferPointer(start: report, count: reportLength)
            .map { String(format: "%02X", $0) }
            .joined(separator: " ")
        
        print("[\(timestamp())] 📥 Report (ID: \(reportID), Type: \(type)): \(hex)")
    }
    
    IOHIDManagerRegisterDeviceMatchingCallback(manager, deviceMatchingCallback, nil)
    IOHIDManagerRegisterDeviceRemovalCallback(manager, deviceRemovalCallback, nil)
    IOHIDManagerRegisterInputReportCallback(manager, inputCallback, nil)
    
    IOHIDManagerScheduleWithRunLoop(manager, CFRunLoopGetCurrent(), CFRunLoopMode.defaultMode.rawValue)
    IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
    
    print("📡 Monitoring... (Press Ctrl+C to stop)")
    CFRunLoopRun()
}

main()
