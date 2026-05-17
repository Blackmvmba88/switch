# Architecture Overview

BlackMamba Cybernetic Runtime (BCR) is organized into a modular pipeline that ensures high-performance input translation and system-wide observability.

## 1. HID Layer
The HID layer is the physical entry point. On macOS, BCR uses a native Swift agent (`runtime/hid-live-source.swift`) that leverages `IOHIDManager` to read raw reports from USB devices. This bypasses high-level driver abstractions, providing the lowest possible latency for raw input capture.

## 2. Semantic Bus
The Semantic Bus is the central nervous system of BCR. It receives raw hardware events (button indices, axis values) and translates them into a normalized semantic frame. This normalization allows a Switch controller to "feel" like an Xbox controller to the target application.

- **Durable Profiles:** Mappings are stored in JSON files (`profiles/`) that define how each raw source maps to a semantic control.
- **Normalization:** BCR handles complex inputs like quantized hat-axes (D-pads) and transforms them into standard digital or analog signals.

## 3. Runtime Layer (Execution)
The runtime manages the lifecycle of input translation. It handles WebSocket communication between the HID source and the injection bridge, maintaining the active state and applying real-time transformations.

## 4. Injection Layer (CDP Bridge)
For xCloud gaming, BCR uses the Chrome DevTools Protocol (CDP) to inject a high-fidelity Gamepad API bridge directly into the browser. This bridge presents a standard "Xbox 360 Controller" to the web page, regardless of the actual hardware being used.

## 5. Observability Layer (Telemetry)
BCR is designed with "visibility first" in mind. Every event on the semantic bus is observable and loggable. This enables real-time telemetry (latency, jitter) and forensic analysis of input sequences via replay traces.
