import AppKit
import GameController
import ScreenCaptureKit
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Flight-Observer")
let stamp = ISO8601DateFormatter()
stamp.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
func writeJSON(_ object: [String: Any], _ url: URL) {
    guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) else { return }
    try? data.write(to: url, options: .atomic)
}

@MainActor
final class Observer: NSObject, NSApplicationDelegate {
    var item: NSStatusItem!
    var inputTimer: Timer?
    var captureTask: Task<Void, Never>?
    var worker: Process?
    var status = "Iniciando"
    var previous = ""
    var lastInput = Date.distantPast
    var input: [String: Any] = [:]
    var output: FileHandle?
    var session: URL!
    var count = 0
    var polling = 0
    var connected = 0
    var started = Date()
    var suspended = false
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "◉ OBS"
        let menu = NSMenu()
        menu.addItem(withTitle: "Flight Observer · solo lectura", action: nil, keyEquivalent: "")
        menu.addItem(withTitle: "Pausar / reanudar observación", action: #selector(toggle), keyEquivalent: "")
        menu.addItem(withTitle: "Abrir registros", action: #selector(openLogs), keyEquivalent: "")
        menu.addItem(withTitle: "Detener observador", action: #selector(stop), keyEquivalent: "")
        for entry in menu.items { entry.target = self }
        item.menu = menu
        session = root.appendingPathComponent("sessions/\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: session.appendingPathComponent("frames"), withIntermediateDirectories: true)
        let file = session.appendingPathComponent("inputs.jsonl")
        FileManager.default.createFile(atPath: file.path, contents: nil)
        output = try? FileHandle(forWritingTo: file)
        GCController.shouldMonitorBackgroundEvents = true
        append(["event":"observer-started", "mode":"read-only", "axisConvention":"Apple GameController, positive Y up", "at":stamp.string(from:Date())])
        inputTimer = Timer.scheduledTimer(withTimeInterval: 1.0/60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.poll() }
        }
        startWorker()
        captureTask = Task { await captureLoop() }
    }
    func append(_ object: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options:[.sortedKeys]) else { return }
        output?.write(data); output?.write(Data([10])); output?.synchronizeFile()
    }
    func poll() {
        guard !suspended else { return }
        polling += 1
        let pads: [[String: Any]] = GCController.controllers().compactMap { controller in
            guard let pad = controller.extendedGamepad else { return nil }
            let axes: [Float] = [pad.leftThumbstick.xAxis.value,pad.leftThumbstick.yAxis.value,pad.rightThumbstick.xAxis.value,pad.rightThumbstick.yAxis.value]
            let dpad: [Float] = [pad.dpad.xAxis.value,pad.dpad.yAxis.value]
            var buttons: [String:Float] = [:]
            buttons["A"] = pad.buttonA.value; buttons["B"] = pad.buttonB.value
            buttons["X"] = pad.buttonX.value; buttons["Y"] = pad.buttonY.value
            buttons["LT"] = pad.leftTrigger.value; buttons["RT"] = pad.rightTrigger.value
            buttons["LB"] = pad.leftShoulder.value; buttons["RB"] = pad.rightShoulder.value
            buttons["Menu"] = pad.buttonMenu.value; buttons["View"] = pad.buttonOptions?.value ?? 0
            buttons["L3"] = pad.leftThumbstickButton?.value ?? 0; buttons["R3"] = pad.rightThumbstickButton?.value ?? 0
            return ["device":controller.vendorName ?? "unknown", "category":controller.productCategory,
                    "axes":axes,"dpad":dpad,"buttons":buttons]
        }
        connected = pads.count
        input = ["controllers":pads, "at":stamp.string(from:Date()), "poll":polling]
        let data = (try? JSONSerialization.data(withJSONObject: pads, options:[.sortedKeys])) ?? Data()
        let state = String(data:data,encoding:.utf8) ?? ""
        if state != previous || Date().timeIntervalSince(lastInput) >= 5 {
            var event = input
            event["event"] = state != previous ? "input-change" : "heartbeat"
            append(event); previous = state; lastInput = Date()
        }
    }
    func publish(_ value: String) {
        status = value
        item.button?.title = suspended ? "Ⅱ OBS" : "◉ OBS \(connected)"
        item.button?.toolTip = value
        writeJSON(["at":stamp.string(from:Date()),"status":value,"controllers":connected,
                   "frames":count,"session":session.path,"suspended":suspended,
                   "screenPermission":CGPreflightScreenCaptureAccess()], root.appendingPathComponent("status.json"))
    }
    func startWorker() {
        let process = Process()
        process.executableURL = root.appendingPathComponent(".venv/bin/python")
        process.arguments = [root.appendingPathComponent("live_worker.py").path, session.path]
        let logfile = session.appendingPathComponent("worker.log")
        FileManager.default.createFile(atPath:logfile.path,contents:nil)
        if let handle = try? FileHandle(forWritingTo: logfile) { process.standardOutput=handle;process.standardError=handle }
        do { try process.run(); worker = process }
        catch { append(["event":"worker-error","message":error.localizedDescription,"at":stamp.string(from:Date())]) }
    }
    func captureLoop() async {
        // One permission request; no reset, no repeated prompting.
        if !CGPreflightScreenCaptureAccess() { _ = CGRequestScreenCaptureAccess() }
        while !Task.isCancelled {
            if suspended { publish("Observación pausada") }
            else if count >= 10000 { publish("Límite de 10000 imágenes alcanzado: captura detenida, mando sigue registrado") }
            else if !CGPreflightScreenCaptureAccess() { publish("Falta permiso de grabación de pantalla para Flight Observer") }
            else {
                do {
                    let content = try await SCShareableContent.excludingDesktopWindows(true,onScreenWindowsOnly:false)
                    let windows = content.windows.filter { window in
                        let title = (window.title ?? "").lowercased()
                        return window.owningApplication?.bundleIdentifier == "com.google.Chrome"
                            && (title.contains("xbox") || title.contains("flight simulator")) && window.frame.width > 300
                    }
                    guard windows.count == 1, let window = windows.first else {
                        publish(windows.isEmpty ? "Esperando ventana Xbox en Chrome" : "Varias ventanas Xbox: no se captura hasta distinguirlas")
                        try? await Task.sleep(nanoseconds:2_000_000_000); continue
                    }
                    let config = SCStreamConfiguration()
                    config.width = min(1920,Int(window.frame.width))
                    config.height = max(1,Int(Double(config.width)*window.frame.height/window.frame.width))
                    config.showsCursor = false
                    let filter = SCContentFilter(desktopIndependentWindow:window)
                    let begun = Date()
                    let image = try await SCScreenshotManager.captureImage(contentFilter:filter,configuration:config)
                    let captured = Date()
                    count += 1
                    let name = String(format:"%08d",count)
                    let jpg = session.appendingPathComponent("frames/\(name).jpg")
                    guard let destination = CGImageDestinationCreateWithURL(jpg as CFURL,UTType.jpeg.identifier as CFString,1,nil) else { throw NSError(domain:"Image",code:1) }
                    CGImageDestinationAddImage(destination,image,[kCGImageDestinationLossyCompressionQuality:0.8] as CFDictionary)
                    guard CGImageDestinationFinalize(destination) else { throw NSError(domain:"Image",code:2) }
                    // Metadata is the completion marker: worker never reads unfinished images.
                    writeJSON(["at":stamp.string(from:captured),"captureBeganAt":stamp.string(from:begun),
                               "image":jpg.path,"windowId":window.windowID,"windowTitle":window.title ?? "",
                               "inputSnapshot":input],session.appendingPathComponent("frames/\(name).json"))
                    publish("Observando Xbox · \(count) imágenes · \(connected) mando(s)")
                } catch { publish("Captura pendiente: \(error.localizedDescription)") }
            }
            try? await Task.sleep(nanoseconds:1_000_000_000)
        }
    }
    @objc func toggle() {
        suspended.toggle()
        append(["event":suspended ? "observation-paused":"observation-resumed","at":stamp.string(from:Date())])
    }
    @objc func openLogs() { NSWorkspace.shared.open(session) }
    @objc func stop() { NSApp.terminate(nil) }
    func applicationWillTerminate(_ notification: Notification) {
        captureTask?.cancel(); inputTimer?.invalidate();worker?.terminate()
        append(["event":"observer-stopped","at":stamp.string(from:Date())])
        try? output?.close()
    }
}
MainActor.assumeIsolated {
 let app = NSApplication.shared
 let delegate = Observer()
 app.delegate = delegate
 app.run()
}
