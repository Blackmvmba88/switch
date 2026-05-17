# Semantic Bus

The Semantic Bus is the heart of the BlackMamba Cybernetic Runtime (BCR). It decouples physical hardware signals from logical game intent.

## Translation Pipeline

1. **Raw Input:** `A9=-1` (from HID)
2. **Semantic Map:** `A9 = DPad_Up`
3. **Logic Frame:** `{ "buttons": { "DPad_Up": { "pressed": true } } }`
4. **Bridge Injection:** Standard Gamepad API frame seen by the game.

## Case Study: Rock Candy for Fortnite

When playing Fortnite on xCloud, the physical position of buttons matters more than the labels printed on the controller. BCR provides a `fortnite-map` that ensures Xbox-standard muscle memory:

### Face Buttons

| Physical Position | Printed on Switch pad | Xbox / Fortnite Meaning |
| --- | --- | --- |
| Bottom | B | **A** (Jump) |
| Right | A | **B** (Build) |
| Left | Y | **X** (Reload) |
| Top | X | **Y** (Pickaxe) |

### D-pad (A9 Hat Axis)

The Rock Candy reports the D-pad as a single quantized hat axis (`A9`), not four separate buttons. The Semantic Bus decodes it cleanly:

| D-pad direction | Raw source (`A9`) | Xbox Button ID |
| --- | --- | --- |
| Up | `-1` | `buttons[12]` |
| Down | `0.143` | `buttons[13]` |
| Left | `0.714` | `buttons[14]` |
| Right | `-0.429` | `buttons[15]` |

## Advanced Mapping

For more details on how to create or modify profiles, see the `profiles/` directory and the `runtime/translate-sample.js` logic.
