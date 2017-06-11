# Cnide
Cnide (Cyanide) is a web-based tool for developing complex circuit networks in [Factorio](https://www.factorio.com/).

## Syntax
### Wires
In Factorio, which wires connect to which things is determined by actually attaching them.
Cnide identifies wires by strings of uppercase letters, numbers, and underscores.
The first character must be a letter.
Combinators are always preceded with pairs of wires, separated by an arrow `->` to denote which wires are connected to their
input and output.
Cnide makes no distinction between red and green wire.
One, two, or zero wires may be specified for either side.
All of the following are valid wire input/outputs:
- `IN_1 IN_2 -> OUT_1 OUT_2`
- `INVENTORY -> X Y`
- `FOO -> BAR`
- `TIMER RESET -> TIMER`
- `->`

### Signals
Valid signals in Factorio are a specific set of items, colors, letters, and numbers.
Cnide accepts any string of lowercase letters, numbers, and underscores.
The first character must be a letter.
The following reserved words may also not be used as signal names:
- `all`
- `any`
- `anything`
- `as`
- `each`
- `everything`
- `pulse`
- `then`
- `toggle`

### Special Signals
In some cases, `everything`, `anything`, and `each` may be used as a signal.
See [the Factorio wiki](https://wiki.factorio.com/Virtual_signals#Each) for details on where these can be used.
For convenience, Cnide accepts `all` and `any` as aliases for `everything` and `anything`, respectively.

### Whitespace and Comments
A comment begins with a double slash (as in C/Java/JavaScript) and ends with a line break.
There are no multi line comments.
Whitespace is ignored and usually optional.
Line breaks have no special syntactic meaning except to end a comment.
- `// This is a comment.`

### Arithmetic Combinators
Arithmetic combinators are, in order:
- The input/output wires
- The left side signal or number
- The operator
- The right side signal or number
- The keyword `as`
- The output signal

`IN -> OUT left + right as x`

### Decider Combinators
Decider combinators are, in order:
- The input/output wires
- The left side signal or number
- The comparison operator
- The right side signal or number
- The keyword `then`
- The output signal

`IN -> OUT left > right then x`

By default, this functions as if the "input count" radio button were selected in the game ui.
To use the "1" behavior, append `as 1` to the end of the combinator syntax:
`IN -> OUT left > right then x as 1`

### Constants and Inputs
Constant combinators are defined via a JSON-like structure:
`-> FOO BAR { iron: 4, copper: -1 }`
Note that the arrow is still required for the wire definition, even though constants take no inputs.
Since Cnide is not a full Factorio simulator, it does not include any of its various input-causing devices.
In addition, these can be hard to debug with, so instead, Cnide offers two suffixes for combinators:
`as pulse` and `as toggle`.
Both turn the combinator into a clickable toggle button that outputs its values when ON and nothing when OFF.
A button with the `pulse` modifier will automatically disable itself after one tick, so it can be used
to simulate single-tick pulses of data.

### Displaying output
`FOO BAR -> [iron]` will create a display showing the value of the `iron` signal from the `FOO` and `BAR` wires.

## Examples
Copy these into the editor to try them out.

### Counter
    // Counts forever increasing by 1 each tick
    ETERNAL_LOOP -> ETERNAL_LOOP elapsed + 1 as elapsed
    ETERNAL_LOOP -> [elapsed]

### SR Latch
This is a direct implementation of the SR Latch example
[from the wiki](https://wiki.factorio.com/Tutorial:Circuit-network_Cookbook#Latches).
Note that if this example is run, before either button is pressed the circuit will rapidly toggle between on and off.
This is to be expected, as the same thing will happen in Factorio if all combinators are constructed at the same time.

    SET   SR_ON  -> SR_OFF
      a = 0 then a as 1
    RESET SR_OFF -> SR_ON
      a = 0 then a as 1
    // Set
    -> SET {a: 1} as toggle
    // Reset
    -> RESET {a: 1} as toggle
    // Output
    SR_ON -> [a]

### Stopwatch
    -> CONTROL {enable: 1} as toggle
    OUTPUT -> [seconds]
    CONTROL -> TIMER
      enable != 0 then tick as 1
    CONTROL -> TIMER
      enable = 0 then reset as 1
    TIMER -> TIMER
      reset = 0 then tick
    TIMER -> OUTPUT
      tick / 60 as seconds
