import Foundation
import IOKit.hid

final class HIDLiveSource: NSObject, URLSessionWebSocketDelegate {
  let vendorId: Int
  let productId: Int
  let manager: IOHIDManager
  var socket: URLSessionWebSocketTask?
  var buttons = Array(repeating: 0.0, count: 17)
  var axes = Array(repeating: 0.0, count: 10)
  var startedAt = Date()
  var lastSent = Date(timeIntervalSince1970: 0)

  init(vendorId: Int = 0x0e6f, productId: Int = 0x0187) {
    self.vendorId = vendorId
    self.productId = productId
    self.manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
    axes[9] = 1.286
    super.init()
  }

  func start() {
    let matching: [String: Any] = [
      kIOHIDVendorIDKey as String: vendorId,
      kIOHIDProductIDKey as String: productId
    ]
    IOHIDManagerSetDeviceMatching(manager, matching as CFDictionary)
    let context = UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque())
    IOHIDManagerRegisterInputValueCallback(manager, inputCallback, context)
    IOHIDManagerRegisterDeviceMatchingCallback(manager, deviceConnectedCallback, context)
    IOHIDManagerRegisterDeviceRemovalCallback(manager, deviceDisconnectedCallback, context)
    IOHIDManagerScheduleWithRunLoop(manager, CFRunLoopGetCurrent(), CFRunLoopMode.defaultMode.rawValue)
    let result = IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
    print("hid-live-source started openResult=\(result)")
    connectWebSocket()
    Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
      self?.sendFrame()
    }
    RunLoop.main.run()
  }

  func connectWebSocket() {
    let url = URL(string: "ws://127.0.0.1:8137/live")!
    let session = URLSession(configuration: .default, delegate: self, delegateQueue: OperationQueue())
    socket = session.webSocketTask(with: url)
    socket?.resume()
    socket?.send(.string("{\"type\":\"heartbeat\",\"from\":\"hid-live-source\"}")) { _ in }
    print("hid-live-source websocket connecting")
  }

  func handle(value: IOHIDValue) {
    let element = IOHIDValueGetElement(value)
    let usagePage = IOHIDElementGetUsagePage(element)
    let usage = IOHIDElementGetUsage(element)
    let intValue = IOHIDValueGetIntegerValue(value)
    let logicalMin = IOHIDElementGetLogicalMin(element)
    let logicalMax = IOHIDElementGetLogicalMax(element)

    if usagePage == 0x09 {
      let index = Int(usage) - 1
      if index >= 0 && index < buttons.count {
        buttons[index] = intValue == 0 ? 0.0 : 1.0
      }
      return
    }

    if usagePage == 0x01 {
      switch usage {
      case 0x30: axes[0] = normalizeAxis(intValue, logicalMin, logicalMax)
      case 0x31: axes[1] = normalizeAxis(intValue, logicalMin, logicalMax)
      case 0x32: axes[2] = normalizeAxis(intValue, logicalMin, logicalMax)
      case 0x35: axes[3] = normalizeAxis(intValue, logicalMin, logicalMax)
      case 0x39: axes[9] = browserHatValue(intValue)
      default: break
      }
    }
  }

  func normalizeAxis(_ value: Int, _ minValue: Int, _ maxValue: Int) -> Double {
    guard maxValue > minValue else { return 0 }
    let normalized = ((Double(value - minValue) / Double(maxValue - minValue)) * 2.0) - 1.0
    return max(-1.0, min(1.0, normalized))
  }

  func browserHatValue(_ value: Int) -> Double {
    switch value {
    case 0: return -1.000
    case 1: return -0.714
    case 2: return -0.429
    case 3: return -0.143
    case 4: return 0.143
    case 5: return 0.429
    case 6: return 0.714
    case 7: return 1.000
    default: return 1.286
    }
  }

  func sendFrame() {
    guard let socket else { return }
    let t = Date().timeIntervalSince(startedAt) * 1000.0
    let buttonPayload = buttons.map { value in
      [
        "pressed": value > 0.5,
        "touched": value > 0.5,
        "value": value
      ] as [String : Any]
    }
    let payload: [String: Any] = [
      "type": "browser-frame",
      "device": [
        "id": "Rock Candy Wired Controller for Nintendo Switch (Native HID Source)",
        "index": 0,
        "mapping": "",
        "buttons": buttons.count,
        "axes": axes.count
      ],
      "sample": [
        "t": t,
        "buttons": buttonPayload,
        "axes": axes
      ]
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload),
          let text = String(data: data, encoding: .utf8) else { return }
    socket.send(.string(text)) { [weak self] error in
      if error != nil {
        self?.connectWebSocket()
      }
    }
  }
}

let inputCallback: IOHIDValueCallback = { context, _, _, value in
  guard let context else { return }
  let source = Unmanaged<HIDLiveSource>.fromOpaque(context).takeUnretainedValue()
  source.handle(value: value)
}

let deviceConnectedCallback: IOHIDDeviceCallback = { _, _, _, device in
  let name = IOHIDDeviceGetProperty(device, kIOHIDProductKey as CFString) as? String ?? "unknown"
  print("hid-live-source device connected: \(name)")
}

let deviceDisconnectedCallback: IOHIDDeviceCallback = { _, _, _, device in
  let name = IOHIDDeviceGetProperty(device, kIOHIDProductKey as CFString) as? String ?? "unknown"
  print("hid-live-source device disconnected: \(name)")
}

HIDLiveSource().start()

