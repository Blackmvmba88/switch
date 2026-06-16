#!/usr/bin/env python3
"""Realtime controller monitor for BlackMamba Input.

Connects to the live-monitor WebSocket and renders:
- connection status
- last semantic frame
- button states
- stick/axis values
- recent press/release events

No third-party dependencies required.
"""

from __future__ import annotations

import base64
import hashlib
import json
import queue
import socket
import ssl
import struct
import threading
import time
import tkinter as tk
from dataclasses import dataclass
from tkinter import ttk
from urllib import request, error
from urllib.parse import urlparse


DEFAULT_WS_URL = "ws://127.0.0.1:8137/live"
DEFAULT_STATUS_URL = "http://127.0.0.1:8137/status"

BUTTONS = [
    "A", "B", "X", "Y",
    "LB", "RB", "LT", "RT",
    "Back", "Start", "L3", "R3",
    "DPad_Up", "DPad_Down", "DPad_Left", "DPad_Right",
    "Guide",
]

AXES = ["LX", "LY", "RX", "RY"]


def http_get_json(url: str, timeout: float = 1.5) -> dict:
    req = request.Request(url, headers={"User-Agent": "BlackMambaGamepadMonitor/1.0"})
    with request.urlopen(req, timeout=timeout) as resp:
      return json.loads(resp.read().decode("utf-8"))


def http_get_text(url: str, timeout: float = 1.5) -> str:
    req = request.Request(url, headers={"User-Agent": "BlackMambaGamepadMonitor/1.0"})
    with request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def ws_key() -> str:
    return base64.b64encode(b"blackmamba-gamepad-monitor").decode("ascii")


def build_ws_request(url: str) -> tuple[socket.socket, str]:
    parsed = urlparse(url)
    if parsed.scheme not in {"ws", "wss"}:
        raise ValueError(f"Unsupported websocket scheme: {parsed.scheme}")

    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "wss" else 80)
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    raw = socket.create_connection((host, port), timeout=3.0)
    sock = ssl.create_default_context().wrap_socket(raw, server_hostname=host) if parsed.scheme == "wss" else raw
    key = ws_key()
    request_bytes = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n"
    ).encode("ascii")
    sock.sendall(request_bytes)
    response = b""
    while b"\r\n\r\n" not in response:
        chunk = sock.recv(4096)
        if not chunk:
            break
        response += chunk
    if b"101" not in response.split(b"\r\n", 1)[0]:
        raise ConnectionError(response.decode("utf-8", errors="replace"))
    return sock, path


def encode_client_text(message: dict) -> bytes:
    payload = json.dumps(message, separators=(",", ":")).encode("utf-8")
    header = bytearray()
    header.append(0x81)
    length = len(payload)
    mask_bit = 0x80
    if length < 126:
        header.append(mask_bit | length)
    elif length < 65536:
        header.append(mask_bit | 126)
        header.extend(struct.pack("!H", length))
    else:
        header.append(mask_bit | 127)
        header.extend(struct.pack("!Q", length))

    mask = b"\x12\x34\x56\x78"
    header.extend(mask)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    return bytes(header) + masked


def decode_frames(buffer: bytearray) -> tuple[list[str], bytearray, bool]:
    messages: list[str] = []
    offset = 0
    closed = False

    while offset + 2 <= len(buffer):
        first = buffer[offset]
        second = buffer[offset + 1]
        opcode = first & 0x0F
        masked = (second & 0x80) != 0
        length = second & 0x7F
        header_len = 2

        if length == 126:
            if offset + 4 > len(buffer):
                break
            length = struct.unpack("!H", buffer[offset + 2:offset + 4])[0]
            header_len = 4
        elif length == 127:
            if offset + 10 > len(buffer):
                break
            length = struct.unpack("!Q", buffer[offset + 2:offset + 10])[0]
            header_len = 10

        mask_len = 4 if masked else 0
        frame_end = offset + header_len + mask_len + length
        if frame_end > len(buffer):
            break

        payload = bytes(buffer[offset + header_len + mask_len:frame_end])
        if masked:
            mask = bytes(buffer[offset + header_len:offset + header_len + 4])
            payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))

        if opcode == 0x8:
            closed = True
        elif opcode == 0x1:
            messages.append(payload.decode("utf-8", errors="replace"))

        offset = frame_end

    return messages, buffer[offset:], closed


@dataclass
class MonitorState:
    connected: bool = False
    last_error: str = ""
    last_seen_at: str = "--"
    frame_count: int = 0
    device: str = "--"
    buttons: dict[str, dict] = None  # type: ignore[assignment]
    axes: dict[str, dict] = None  # type: ignore[assignment]
    events: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        self.buttons = self.buttons or {}
        self.axes = self.axes or {}
        self.events = self.events or []


class GamepadMonitorApp:
    def __init__(self, root: tk.Tk, ws_url: str, status_url: str):
        self.root = root
        self.ws_url = ws_url
        self.status_url = status_url
        self.state = MonitorState()
        self.queue: "queue.Queue[dict]" = queue.Queue()
        self.stop_event = threading.Event()
        self.ws_thread = threading.Thread(target=self.ws_loop, daemon=True)
        self.status_thread = threading.Thread(target=self.status_loop, daemon=True)

        self.root.title("BlackMamba Gamepad Monitor")
        self.root.geometry("1180x760")
        self.root.minsize(960, 640)

        self._build_ui()
        self.ws_thread.start()
        self.status_thread.start()
        self.root.after(50, self.process_queue)

    def _build_ui(self) -> None:
        self.root.configure(bg="#0b1117")
        self.root.option_add("*Font", "Helvetica 11")

        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TFrame", background="#0b1117")
        style.configure("TLabel", background="#0b1117", foreground="#e5eef7")
        style.configure("Title.TLabel", font=("Helvetica", 20, "bold"), foreground="#ffffff")
        style.configure("Accent.TLabel", font=("Helvetica", 11, "bold"), foreground="#7dd3fc")
        style.configure("Good.TLabel", foreground="#86efac")
        style.configure("Bad.TLabel", foreground="#fda4af")
        style.configure("Muted.TLabel", foreground="#94a3b8")
        style.configure("TButton", padding=8)

        top = ttk.Frame(self.root, padding=16)
        top.pack(fill="x")
        ttk.Label(top, text="BlackMamba Gamepad Monitor", style="Title.TLabel").pack(anchor="w")
        ttk.Label(top, text="Botones, sticks y eventos en tiempo real", style="Muted.TLabel").pack(anchor="w", pady=(4, 0))

        info = ttk.Frame(self.root, padding=(16, 0, 16, 12))
        info.pack(fill="x")
        self.connection_label = ttk.Label(info, text="Conexión: esperando...", style="Bad.TLabel")
        self.connection_label.pack(side="left")
        self.device_label = ttk.Label(info, text="Dispositivo: --", style="Muted.TLabel")
        self.device_label.pack(side="left", padx=(18, 0))
        self.frame_label = ttk.Label(info, text="Frames: 0", style="Muted.TLabel")
        self.frame_label.pack(side="left", padx=(18, 0))
        self.time_label = ttk.Label(info, text="Último: --", style="Muted.TLabel")
        self.time_label.pack(side="left", padx=(18, 0))

        body = ttk.Frame(self.root, padding=(16, 0, 16, 16))
        body.pack(fill="both", expand=True)
        body.columnconfigure(0, weight=3)
        body.columnconfigure(1, weight=2)
        body.rowconfigure(0, weight=1)

        left = ttk.Frame(body)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        right = ttk.Frame(body)
        right.grid(row=0, column=1, sticky="nsew")
        left.rowconfigure(1, weight=1)
        left.columnconfigure(0, weight=1)
        right.rowconfigure(1, weight=1)
        right.columnconfigure(0, weight=1)

        button_box = ttk.LabelFrame(left, text="Botones")
        button_box.grid(row=0, column=0, sticky="ew")
        self.button_grid = ttk.Frame(button_box, padding=10)
        self.button_grid.pack(fill="x")
        for col in range(4):
            self.button_grid.columnconfigure(col, weight=1)

        self.button_widgets: dict[str, ttk.Label] = {}
        for idx, name in enumerate(BUTTONS):
            frame = ttk.Frame(self.button_grid, padding=4)
            frame.grid(row=idx // 4, column=idx % 4, sticky="ew")
            frame.columnconfigure(0, weight=1)
            label = ttk.Label(frame, text=f"{name}: 0", anchor="center", padding=8, style="Muted.TLabel")
            label.grid(row=0, column=0, sticky="ew")
            self.button_widgets[name] = label

        axes_box = ttk.LabelFrame(left, text="Ejes")
        axes_box.grid(row=1, column=0, sticky="nsew", pady=(10, 0))
        axes_box.columnconfigure(0, weight=1)
        self.axis_widgets: dict[str, tuple[ttk.Label, ttk.Progressbar, ttk.Label]] = {}
        for row, name in enumerate(AXES):
            row_frame = ttk.Frame(axes_box, padding=(10, 10, 10, 6))
            row_frame.grid(row=row, column=0, sticky="ew")
            row_frame.columnconfigure(1, weight=1)
            ttk.Label(row_frame, text=name, width=6, style="Accent.TLabel").grid(row=0, column=0, sticky="w")
            bar = ttk.Progressbar(row_frame, orient="horizontal", mode="determinate", maximum=200, value=100)
            bar.grid(row=0, column=1, sticky="ew", padx=8)
            value = ttk.Label(row_frame, text="0.000", width=9, anchor="e")
            value.grid(row=0, column=2, sticky="e")
            self.axis_widgets[name] = (row_frame, bar, value)

        events_box = ttk.LabelFrame(right, text="Eventos recientes")
        events_box.grid(row=0, column=0, sticky="nsew")
        events_box.rowconfigure(0, weight=1)
        events_box.columnconfigure(0, weight=1)
        self.events_text = tk.Text(
            events_box,
            height=18,
            bg="#0f1720",
            fg="#dbeafe",
            insertbackground="#dbeafe",
            relief="flat",
            wrap="none",
            font=("Menlo", 11),
        )
        self.events_text.grid(row=0, column=0, sticky="nsew", padx=8, pady=8)

        log_box = ttk.LabelFrame(right, text="Estado JSON")
        log_box.grid(row=1, column=0, sticky="nsew", pady=(10, 0))
        log_box.rowconfigure(0, weight=1)
        log_box.columnconfigure(0, weight=1)
        self.json_text = tk.Text(
            log_box,
            height=14,
            bg="#0f1720",
            fg="#d1fae5",
            insertbackground="#d1fae5",
            relief="flat",
            wrap="none",
            font=("Menlo", 10),
        )
        self.json_text.grid(row=0, column=0, sticky="nsew", padx=8, pady=8)

        bottom = ttk.Frame(self.root, padding=(16, 0, 16, 14))
        bottom.pack(fill="x")
        ttk.Button(bottom, text="Copiar último JSON", command=self.copy_json).pack(side="left")
        ttk.Button(bottom, text="Salir", command=self.close).pack(side="right")

    def copy_json(self) -> None:
        text = self.json_text.get("1.0", "end").strip()
        self.root.clipboard_clear()
        self.root.clipboard_append(text)

    def close(self) -> None:
        self.stop_event.set()
        self.root.after(100, self.root.destroy)

    def push(self, item: dict) -> None:
        self.queue.put(item)

    def process_queue(self) -> None:
        try:
            while True:
                item = self.queue.get_nowait()
                kind = item.get("kind")
                if kind == "status":
                    self.apply_status(item["data"])
                elif kind == "frame":
                    self.apply_frame(item["data"])
                elif kind == "error":
                    self.apply_error(item["message"])
        except queue.Empty:
            pass
        if not self.stop_event.is_set():
            self.root.after(50, self.process_queue)

    def apply_status(self, data: dict) -> None:
        self.connection_label.configure(
            text=f"Conexión: {'activa' if self.state.connected else 'caída'}",
            style="Good.TLabel" if self.state.connected else "Bad.TLabel",
        )
        self.device_label.configure(text=f"Dispositivo: {data.get('device', '--')}")
        self.frame_label.configure(text=f"Frames: {data.get('frameCount', 0)}")
        self.time_label.configure(text=f"Último: {data.get('lastBrowserFrameAt', '--')}")

    def apply_error(self, message: str) -> None:
        self.state.last_error = message
        self.connection_label.configure(text=f"Conexión: error - {message}", style="Bad.TLabel")

    def format_button(self, state: dict | None) -> str:
        if not state:
            return "0"
        value = state.get("value", 0)
        pressed = state.get("pressed", False)
        if isinstance(value, float):
            value_txt = f"{value:.2f}"
        else:
            value_txt = str(value)
        return f"{value_txt} {'ON' if pressed else 'off'}"

    def apply_frame(self, data: dict) -> None:
        self.state.connected = True
        self.state.frame_count += 1
        self.state.device = data.get("device", self.state.device)
        self.state.last_seen_at = data.get("at", self.state.last_seen_at)
        frame = data.get("frame", {}) or {}
        self.state.buttons = frame.get("buttons", {}) or {}
        self.state.axes = frame.get("axes", {}) or {}
        events = data.get("events", []) or []

        self.connection_label.configure(text="Conexión: activa", style="Good.TLabel")
        self.device_label.configure(text=f"Dispositivo: {self.state.device}")
        self.frame_label.configure(text=f"Frames: {self.state.frame_count}")
        self.time_label.configure(text=f"Último: {time.strftime('%H:%M:%S')}")

        for name, widget in self.button_widgets.items():
            state = self.state.buttons.get(name)
            pressed = bool(state.get("pressed")) if state else False
            widget.configure(
                text=f"{name}: {self.format_button(state)}",
                style="Good.TLabel" if pressed else "Muted.TLabel",
            )

        for name in AXES:
            axis = self.state.axes.get(name, {})
            value = float(axis.get("value", 0) or 0)
            raw = float(axis.get("raw", 0) or 0)
            bar_value = int((value + 1.0) * 100)
            _, bar, label = self.axis_widgets[name]
            bar.configure(value=max(0, min(200, bar_value)))
            label.configure(text=f"{value:+.3f}  raw={raw:+.3f}")

        if events:
            for event in events[-8:]:
                line = self.render_event(event)
                self.state.events.append(line)
            self.state.events = self.state.events[-80:]

        self.events_text.delete("1.0", "end")
        self.events_text.insert("end", "\n".join(self.state.events) + ("\n" if self.state.events else ""))

        payload = {
            "device": self.state.device,
            "frameCount": self.state.frame_count,
            "buttons": self.state.buttons,
            "axes": self.state.axes,
            "recentEvents": self.state.events[-10:],
            "source": "live-monitor",
        }
        self.json_text.delete("1.0", "end")
        self.json_text.insert("end", json.dumps(payload, indent=2, ensure_ascii=False))

    def render_event(self, event: dict) -> str:
        event_type = event.get("event", "?")
        name = event.get("name", "?")
        source = event.get("source", "--")
        value = event.get("value", 0)
        return f"{time.strftime('%H:%M:%S')}  {event_type:<8}  {name:<12}  {source:<4}  {value}"

    def ws_loop(self) -> None:
        while not self.stop_event.is_set():
            try:
                sock, _ = build_ws_request(self.ws_url)
                self.push({"kind": "status", "data": self.fetch_status()})
                sock.settimeout(0.75)
                pending = bytearray()
                self.state.connected = True
                self.state.last_error = ""
                self.push({"kind": "status", "data": self.fetch_status()})

                while not self.stop_event.is_set():
                    try:
                        chunk = sock.recv(4096)
                        if not chunk:
                            raise ConnectionError("websocket closed")
                        pending.extend(chunk)
                        messages, pending, closed = decode_frames(pending)
                        for text in messages:
                            message = json.loads(text)
                            if message.get("type") == "hello":
                                continue
                            if message.get("type") == "semantic-frame":
                                self.push({"kind": "frame", "data": message})
                        if closed:
                            raise ConnectionError("websocket closed")
                    except socket.timeout:
                        continue
                    except Exception as exc:
                        raise ConnectionError(str(exc)) from exc
            except Exception as exc:
                self.state.connected = False
                self.push({"kind": "error", "message": str(exc)})
                time.sleep(1.0)

    def fetch_status(self) -> dict:
        try:
            return http_get_json(self.status_url)
        except Exception:
            return {}

    def status_loop(self) -> None:
        while not self.stop_event.is_set():
            try:
                data = self.fetch_status()
                if data:
                    self.push({"kind": "status", "data": data})
            except Exception as exc:
                self.push({"kind": "error", "message": f"status: {exc}"})
            time.sleep(1.0)


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Realtime controller monitor")
    parser.add_argument("--ws", default=DEFAULT_WS_URL, help="WebSocket URL for live-monitor")
    parser.add_argument("--status", default=DEFAULT_STATUS_URL, help="HTTP status URL for live-monitor")
    args = parser.parse_args()

    root = tk.Tk()
    app = GamepadMonitorApp(root, args.ws, args.status)
    root.protocol("WM_DELETE_WINDOW", app.close)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
