import Foundation
import IOKit.hid

struct Config {
  var vendorId: Int = 0x0e6f
  var productId: Int = 0x0187
  var verbose: Bool = false
}

func argValue(_ name: String) -> String? {
  let args = CommandLine.arguments
  guard let index = args.firstIndex(of: name), index + 1 < args.count else {
    return nil
  }
  return args[index + 1]
}

func intArg(_ name: String, fallback: Int) -> Int {
  guard let value = argValue(name) else { return fallback }
  if value.lowercased().hasPrefix("0x") {
    return Int(value.dropFirst(2), radix: 16) ?? fallback
  }
  return Int(value) ?? fallback
}

func timestamp() -> String {
  ISO8601DateFormatter().string(from: Date())
}

func jsonLine(_ object: [String: Any]) {
  if let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
     let text = String(data: data, encoding: .utf8) {
    print(text)
    fflush(stdout)
  }
}

let config = Config(
  vendorId: intArg("--vendor", fallback: 0x0e6f),
  productId: intArg("--product", fallback: 0x0187),
  verbose: CommandLine.arguments.contains("--verbose")
)

let manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
let matching: [String: Any] = [
  kIOHIDVendorIDKey as String: config.vendorId,
  kIOHIDProductIDKey as String: config.productId
]

IOHIDManagerSetDeviceMatching(manager, matching as CFDictionary)

let context = UnsafeMutableRawPointer(Unmanaged.passRetained(NSMutableDictionary()).toOpaque())

let deviceMatchingCallback: IOHIDDeviceCallback = { _, _, _, device in
  let name = IOHIDDeviceGetProperty(device, kIOHIDProductKey as CFString) as? String ?? "unknown"
  let vendor = IOHIDDeviceGetProperty(device, kIOHIDVendorIDKey as CFString) as? Int ?? 0
  let product = IOHIDDeviceGetProperty(device, kIOHIDProductIDKey as CFString) as? Int ?? 0
  jsonLine([
    "at": timestamp(),
    "kind": "hid-device-connected",
    "name": name,
    "vendorId": String(format: "0x%04x", vendor),
    "productId": String(format: "0x%04x", product)
  ])
}

let deviceRemovalCallback: IOHIDDeviceCallback = { _, _, _, device in
  let name = IOHIDDeviceGetProperty(device, kIOHIDProductKey as CFString) as? String ?? "unknown"
  jsonLine([
    "at": timestamp(),
    "kind": "hid-device-disconnected",
    "name": name
  ])
}

let inputCallback: IOHIDValueCallback = { _, _, _, value in
  let element = IOHIDValueGetElement(value)
  let device = IOHIDElementGetDevice(element)
  let name = IOHIDDeviceGetProperty(device, kIOHIDProductKey as CFString) as? String ?? "unknown"
  let usagePage = IOHIDElementGetUsagePage(element)
  let usage = IOHIDElementGetUsage(element)
  let cookie = IOHIDElementGetCookie(element)
  let integerValue = IOHIDValueGetIntegerValue(value)
  let scaledValue = IOHIDValueGetScaledValue(value, IOHIDValueScaleType(kIOHIDValueScaleTypePhysical))

  jsonLine([
    "at": timestamp(),
    "kind": "hid-raw-value",
    "device": name,
    "usagePage": usagePage,
    "usage": usage,
    "cookie": Int(cookie),
    "integerValue": integerValue,
    "scaledValue": scaledValue
  ])
}

IOHIDManagerRegisterDeviceMatchingCallback(manager, deviceMatchingCallback, context)
IOHIDManagerRegisterDeviceRemovalCallback(manager, deviceRemovalCallback, context)
IOHIDManagerRegisterInputValueCallback(manager, inputCallback, context)
IOHIDManagerScheduleWithRunLoop(manager, CFRunLoopGetCurrent(), CFRunLoopMode.defaultMode.rawValue)

let openResult = IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
jsonLine([
  "at": timestamp(),
  "kind": "hid-monitor-started",
  "vendorId": String(format: "0x%04x", config.vendorId),
  "productId": String(format: "0x%04x", config.productId),
  "openResult": openResult
])

CFRunLoopRun()
