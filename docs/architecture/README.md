# Architecture Overview

BlackMamba Cybernetic Runtime (BCR) is organized into a modular pipeline:

1. **HID Layer:** Interface with raw hardware.
2. **Semantic Bus:** Translation of raw signals into intent.
3. **Runtime Layer:** The execution environment and state management.
4. **Injection Layer:** Delivering intent to the target application (xCloud/Chrome).
5. **Observability Layer:** Real-time telemetry and diagnostics.
