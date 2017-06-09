CircuitNetwork
  = _ nodes:(Networked _)* {
      const result = new network.CircuitNetwork;
      for (const x of nodes) {
        result.add(x[0]);
      }
      return result;
    }

_ "whitespace"
  = [ \t\n\r]*

As = "as"
Then = "then"
FutureReservedWord
  = "def" / "public"

ReservedWord
  = SpecialSignal
  / ButtonMode
  / As / Then
  / FutureReservedWord

// Named Wires
Wire "wire"
  = [A-Z][A-Z0-9_]* { return text(); }

WirePair
  = a:Wire _ b:Wire { return [a, b] }
  / a:Wire { return [a] }
  / !Wire { return [] }

// Operands
Integer "integer"
  = "-"? [0-9]+ { return parseInt(text(), 10); }
  
Signal "signal"
  = !ReservedWord [a-z][a-z0-9_]* { return text(); }

Each "each" = "each" { return "each"; }
Any "any" = "any" / "anything" { return "any"; }
All "all" = "all" / "everything" { return "all"; }

SpecialSignal
  = Each / Any / All

Operand
  = Signal
  / Integer

// Operators for Combinators
ArithmeticOperator "arithmetic operator"
  = [+\-*/%&|^]
  / ">>"
  / "<<"

DeciderOperator "decider operator"
 = [<>!] "="? { return text(); }
 / "=" { return text(); }

// Building blocks for Constant Combinators
KeyValue
  = key:Signal _ ":" _ value:Integer _ tail:("," _ KeyValue)? {
      const result = tail ? tail[2] : {};
      result[key] = (result[key] || 0) + value;
      return result;
    }

Pulse "pulse" = "pulse" { return network.PulseButton; }
Toggle "toggle" = "toggle" { return network.ToggleButton; }
ButtonMode = Pulse / Toggle

// Combinators
ConstantCombinator
  = "->" _ outputs:WirePair _
    "{" _ values:KeyValue "}"
    as:(_ As _ ButtonMode)? {
      const klass = as ? as[3] : ConstantCombinator
      return new klass(outputs, values);
    }

ValueAsValueArithmeticCombinator
  = inputs:WirePair _ "->" _ outputs:WirePair _
    left:Operand _
    operator:ArithmeticOperator _
    right:Operand _ As _ outputSignal:Signal
    {
      return new network.ValueAsValueArithmeticCombinator(
        inputs, outputs, operator, left, right, outputSignal);
    }

EachAsValueArithmeticCombinator
  = inputs:WirePair _ "->" _ outputs:WirePair _
    left:Each _
    operator:ArithmeticOperator _
    right:Operand _ As _ outputSignal:Signal
    {
      return new network.EachAsValueArithmeticCombinator(
        inputs, outputs, operator, right, outputSignal);
    }

EachAsEachArithmeticCombinator
  = inputs:WirePair _ "->" _ outputs:WirePair _
    left:Each _
    operator:ArithmeticOperator _
    right:Operand _ As _ outputSignal:Each
    {
      return new network.EachAsEachArithmeticCombinator(
        inputs, outputs, operator, right);
    }

ArithmeticCombinator
  = ValueAsValueArithmeticCombinator
  / EachAsValueArithmeticCombinator
  / EachAsEachArithmeticCombinator

SimpleDeciderCombinator
  = inputs:WirePair _ "->" _ outputs:WirePair _
    left:(Operand / Any / All) _
    operator:DeciderOperator _
    right:Operand _ Then _ outputSignal:(Signal / All)
    asOne:(_ As _ "1")?
    {
      return new network.SimpleDeciderCombinator(
        inputs, outputs, operator, left, right, outputSignal,
        !!asOne);
    }

SumDeciderCombinator
  = inputs:WirePair _ "->" _ outputs:WirePair _
    left:Each _
    operator:DeciderOperator _
    right:Operand _ Then _ outputSignal:Signal
    asOne:(_ As _ "1")?
    {
      return new network.SumDeciderCombinator(
        inputs, outputs, operator, right, outputSignal, !!asOne);
    }

FilterDeciderCombinator
  = inputs:WirePair _ "->" _ outputs:WirePair _
    left:Each _
    operator:DeciderOperator _
    right:Operand _ Then _ outputSignal:Each
    asOne:(_ As _ "1")?
    {
      return new network.FilterDeciderCombinator(
        inputs, outputs, operator, right, !!asOne);
    }

DeciderCombinator
  = SimpleDeciderCombinator
  / SumDeciderCombinator
  / FilterDeciderCombinator

Display
  = inputs:WirePair _ "->" _
    "[" _ signal:Signal _ "]" {
      return new network.Display(inputs, signal);
    }

SingleLineComment
  = "//" [ \t]* comment:$[^\n]* { return new network.Comment(comment); }
  
Comment
  = head:SingleLineComment tail:(_ Comment)?
    {
      if (tail) {
        return head.join(tail[1]);
      } else {
        return head;
      }
    }
  
Networked
  = ConstantCombinator
  / ArithmeticCombinator
  / DeciderCombinator
  / Display
  / Comment