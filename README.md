# Cnide
Cnide (Cyanide) is a web-based tool for developing complex circuit networks in [Factorio](https://www.factorio.com/).

## Syntax
### Wires
In Factorio, which wires connect to which things is determined by actually attaching them.
Cnide identifies wires by strings of uppercase letters, numbers, and underscores.
The first character must be a letter.
- `INVENTORY`
- `FOO_BAR`
- `X`

Wires are separated from combinators with an arrow (`->`).
Inputs come before the combinator. Outputs come after the combinator.
- `INPUT -> counter + 1 as counter -> OUTPUT`

You may specify a pair of wires (one red, one green) instead.
This has the same effect as in Factorio: The inputs are summed together, and the outputs each get the result.
Cnide makes no distinction between red and green wire, so they may be specified in any order.
- `(RED, GREEN)`
- `(GREEN, RED)`

You can also specify that no wires are connected with `()`.

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
Whitespace is ignored by the parser and usually optional.
Line breaks have no special syntactic meaning except to end a single-line comment.

Comments work as they do in C/Java/JavaScript:
from `//` to the end of the line or between a `/*` and `*/`.
Comments are treated as whitespace.
- `// This is a comment.`
- `/* This is a comment, too. */`

### Labels
Labels are another "form" of comment.
They are treated as complete statements and are visible in the exported code, whereas comments are not.
Labels begin with a `#` and end at the end of the line.
As in Markdown, `##` or `###` may be used instead for less important and smaller text.

    # Control Panel
    ## Add Iron
    ## Add Copper
    ## Reset

### Arithmetic Combinators
Arithmetic combinators are, in order:
- The input/output wires
- The left side signal or number
- The operator
- The right side signal or number
- The keyword `as`
- The output signal

`IN -> left + right as x -> OUT`

### Decider Combinators
Decider combinators are, in order:
- The input/output wires
- The left side signal or number
- The comparison operator
- The right side signal or number
- The keyword `then`
- The output signal

`IN -> left > right then x -> OUT`

By default, this functions as if the "input count" radio button were selected in the game ui.
To use the "1" behavior, add `1 as` before the output:
`IN -> left > right then 1 as x -> OUT`

### Constants and Inputs
Constant combinators are defined via a JSON-like structure:
`{ iron: 4, copper: -1 } -> OUT`
Constants take no inputs, so no input wire is allowed.
Since Cnide is not a full Factorio simulator, it does not include any of its various input-causing devices.
In addition, these can be hard to debug with, so instead, Cnide offers two prefixes for combinators:
`pulse as` and `toggle as`.
Both turn the combinator into a clickable toggle button that outputs its values when ON and nothing when OFF.
A button with the `pulse` modifier will automatically disable itself after one tick, so it can be used
to simulate single-tick pulses of data.
- `pulse as { iron: 1 } -> IRON_COUNTER`
- `toggle as { green: 1 } -> TRAIN_SIGNAL_READ`

### Displaying output
`(FOO, BAR) -> [iron]` will create a display showing the value of the `iron` signal from the `FOO` and `BAR` wires.

### Networks
Cnide programs are divided up into networks, with combinators defined inside.
A network name must start with an uppercase letter and may contain letters, numbers, and underscores.
Define a network with the network name, the parameters, and the body.
Think of this as a class or method definition.

    Counter(OUTPUT, product) {
      // One item
      pulse as {product: 1} -> COUNTER
      // One stack of items
      pulse as {product: 50} -> COUNTER
      COUNTER -> each + 0 as each -> (COUNTER, OUTPUT)
    }
The parameters may consist of wires or signals.
Wire parameters are used to attach the network to a parent network.
Signal parameters are used to substitute a signal within the network.
Networks can be bound (or "called") within other networks like this:

    Counter(OUTPUT=INVENTORY, product=iron)
    Counter(OUTPUT=INVENTORY, product=copper)
This is roughly the equivalent of writing:

      // One item
      pulse as {iron: 1} -> IRON_COUNTER
      // One stack of items
      pulse as {iron: 50} -> IRON_COUNTER
      IRON_COUNTER -> each + 0 as each -> (IRON_COUNTER, INVENTORY)
      // One item
      pulse as {copper: 1} -> COPPER_COUNTER
      // One stack of items
      pulse as {copper: 50} -> COPPER_COUNTER
      COPPER_COUNTER -> each + 0 as each -> (COPPER_COUNTER, INVENTORY)
      
#### Main
The simplest valid Cnide program is an empty Main network:

    Main() {}
All programs must have a Main network.
Any network which isn't called within the Main network won't appear.

## Examples
Copy these into the editor to try them out.

### Counter
    Main() {
      // Counts forever increasing by 1 each tick
      ETERNAL_LOOP -> elapsed + 1 as elapsed -> ETERNAL_LOOP
      ETERNAL_LOOP -> [elapsed]
    }

### SR Latch
This is a direct implementation of the SR Latch example
[from the wiki](https://wiki.factorio.com/Tutorial:Circuit-network_Cookbook#Latches).
Note that if this example is run, before either button is pressed the circuit will rapidly toggle between on and off.
This is to be expected, as the same thing will happen in Factorio if all combinators are constructed at the same time.

    Main() {
      (SET, SR_ON) ->
        a = 0 then 1 as a
        -> SR_OFF
      (RESET, SR_OFF) ->
        a = 0 then 1 as a
        -> SR_ON
      // Set
      toggle as {a:1} -> SET
      // Reset
      toggle as {a:1} -> RESET
      // Output
      SR_ON -> [a]
    }

### Stopwatch
    Main() {
      toggle as {enable: 1} -> CONTROL
      OUTPUT -> [seconds]
      CONTROL ->
        enable != 0 then 1 as tick
        -> TIMER
      CONTROL ->
        enable = 0 then 1 as reset
        -> TIMER
      TIMER ->
        reset = 0 then tick
        -> TIMER
      TIMER ->
        tick / 60 as seconds
        -> OUTPUT
    }
