# BlackMamba Cybernetic Runtime (BCR) 🐍🔥

The BlackMamba Cybernetic Runtime is a high-performance, semantic-first input translation layer designed to bridge the gap between human hardware and machine intent on macOS.

> "It's not a mapper. It's a cybernetic interoperability platform."

## Conceptual Pipeline

```text
USB / HID device
-> macOS IOHID + browser Gamepad API
-> Semantic Translation Layer (BCR Bus)
-> Telemetry & Observability
-> High-Fidelity Injection (CDP Bridge)
-> xCloud / Target Application
```

## Architecture

BCR is built on several key pillars:
- **[Vision](VISION.md):** Our philosophy of human-machine interaction.
- **[Roadmap](ROADMAP.md):** The phased evolution from HID bridge to adaptive systems.
- **[Documentation](docs/architecture/):** Detailed architectural breakdowns.

## Quick Start

### Installation

```bash
npm install
./install.sh
```

### Gaming Mode

```bash
npm run game-on
```

### Control Room (UI)

```bash
bmctl app
```

### Diagnostics

```bash
npm run status
npm run preflight
```

## Laboratory & Tools

BCR includes a suite of laboratory tools for input research:
- **Live Monitor:** Real-time WebSocket event stream.
- **Replay Trace:** Offline validation of input sequences.
- **Semantic Diff:** Analytical comparison of controller profiles.
- **Visualizer:** (Work in Progress) Interactive telemetry dashboard.

## Development

### Testing

```bash
npm test
```

### Project Structure

- `runtime/`: Core translators, live monitor, CDP injector.
- `xbox-gamepad-bridge/`: Browser Gamepad API bridge.
- `profiles/`: Durable semantic controller profiles.
- `app/`: Local Control Room UI.
- `docs/`: Architectural and conceptual documentation.

## License

MIT - See [LICENSE](LICENSE)

## Documentation Index

- [Vision & Philosophy](VISION.md)
- [Command Reference](docs/commands.md)
- [Architecture Overview](docs/architecture/README.md)
- [Semantic Bus & Mappings](docs/semantic-bus/README.md)
- [Telemetry & Observability](docs/telemetry/README.md)
- [Roadmap](ROADMAP.md)
- [Robustness & Intelligence](docs/runtime/robustness.md)
