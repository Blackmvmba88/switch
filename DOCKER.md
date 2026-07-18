# Docker Plan

## In Docker

- `api-server.js`
- runtime orchestration reads
- status and doctor output wrappers

## Not In Docker

- `hid-live-source`
- Chrome CDP control on macOS
- launchd agents
- direct HID access

## Goal

Use Docker for:

- API surface
- orchestration readouts
- remote status inspection

Keep macOS for:

- controller access
- Chrome/xCloud session
- launchd persistence

## Start

```bash
docker compose up --build
```

## Next Step

Split the API contract from the platform-specific runtime so the product can grow without dragging macOS-only pieces into the container.
