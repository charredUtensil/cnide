{
  const network = window.network || {};
  if (!window.network) {
    class CN { constructor(){this.c=[];} add(e){this.c.push(e);}}
    network.CircuitNetwork = CN;
    network.CircuitSubNetwork = CN;
  }
  
  class UnboundCircuitNetwork {
    constructor(name, params) {
      this.name = name;
      this.params = params;
      this.children = [];
    }
    
    add(child) {
      this.children.push(child)
    }
    
    bind(networks, wires, signals, main) {
      const result =
          main ?
          new network.CircuitNetwork() : 
          new network.CircuitSubNetwork(this.name, wires);
      const childNetworks = {}
      Object.assign(childNetworks, networks);
      delete childNetworks[this.name];
      for (const child of this.children) {
        result.add(child.bind(childNetworks, {}, signals));
      }
      return result;
    }
  }
  
  /**
   * A constructor ready to be bound to its arguments.
   * The binding isn't done immediately to allow for substitutions.
   */
  class Statement {
    constructor(location, klass, ...args) {
      this.location = location;
      this.klass = klass;
      this.args = args;
    }
    
    bind(networks, wires, signals) {
      const boundArgs = [];
      for (const arg of this.args) {
        if (arg in signals) {
          boundArgs.push(signals[arg]);
        } else { 
          boundArgs.push(arg);
        }
      }
      return this.klass ? new this.klass(...boundArgs) : boundArgs;
    }
  }
  
  class SubNetworkReferenceStatement {
    constructor(location, name, wireBindings, signalBindings) {
      this.location = location;
      this.name = name;
      this.wireBindings = wireBindings;
      this.signalBindings = signalBindings
    }
    
    bind(networks, wires, signals) {
      if (!(this.name in networks)) {
        error(this.name + ' network is not defined.', this.location);
      }
      // TODO: This won't let you nest signal bindings.
      const unboundNetwork = networks[this.name];
      for (const param of Object.keys(this.wireBindings)) {
        if (!unboundNetwork.params.has(param)) {
          error(this.name + ' network does not have parameter "' +
              param + '"', this.location);
        }
      }
      return unboundNetwork.bind(
        networks, this.wireBindings, this.signalBindings);
    }
  }
}

CnideProgram
  = _ nodes:(CircuitNetwork _)* !. {
      const networks = {};
      for (const x of nodes) {
        networks[x[0].name] = x[0];
      }
      if (!("Main" in networks)) {
        error(
            "No Main network was defined. " +
            "You must define a Main() {} network.",
            {start: location().end, end: location().end});
      }
      return networks["Main"].bind(networks, {}, {}, true /* main */);
    }

Comment "comment"
  = "//" [ \t]* text:$[^\n]*
  / "/*" ([^*]+ / "*" !"/")* "*/"

_ "whitespace"
  = ([ \t\n\r]+ / Comment)*

As = "as"
Then = "then"

ReservedWord
  = SpecialSignal
  / ButtonKind
  / As / Then

// Network Name
NetworkName "network name"
  = [A-Z][A-Za-z0-9]* { return text(); }
  
// Named Wires
Wire "wire"
  = [A-Z][A-Z0-9_]* { return text(); }

WirePair
  = "(" a:Wire _ "," _ b:Wire ")" { return [a, b] }
  / a:Wire { return [a] }
  / "()" { return [] }

// Operands
Integer "integer"
  = "-"? [0-9]+ { return parseInt(text(), 10); }
  
Signal "signal"
  = !ReservedWord [a-z][a-z0-9_]* { return text(); }

Each "each" = "each" { return "each"; }
Any "any" = ("anything" / "any") { return "any"; }
All "all" = ("everything" / "all") { return "all"; }

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
 / "="

// Building blocks for Constant Combinators
KeyValue
  = key:Signal _ ":" _ value:Integer {
      return {key: key, value: value};
    }

KeyValues
  = kv:KeyValue _ "," _ rest:KeyValues {
      rest[kv.key] = (rest[kv.key] || 0) + kv.value;
      if (rest[kv.key] == 0) { delete rest[kv.key]; }
      return rest;
    }
  / kv:KeyValue {
      const rest = {};
      rest[kv.key] = kv.value;
      return rest;
    }
  / []* { return {}; }

Pulse "pulse" = "pulse" { return network.PulseButton; }
Toggle "toggle" = "toggle" { return network.ToggleButton; }
ButtonKind = Pulse / Toggle

// Combinators
ConstantCombinator
  = kind:(ButtonKind _ As _)?
    "{" _ values:KeyValues _ "}" _
    "->" _ outputs:WirePair
    {
      const klass = kind ? kind[0] : network.ConstantCombinator
      const args = [];
      for (const key of Object.keys(values)) {
        args.push(key);
        args.push(values[key]);
      }
      return new Statement(location(), klass, outputs, ...args);
    }

ValueAsValueArithmeticCombinator
  = inputs:WirePair _ "->" _
    left:Operand _
    operator:ArithmeticOperator _
    right:Operand _ As _ outputSignal:Signal _
    "->" _ outputs:WirePair
    {
      return new Statement(location(), network.ValueAsValueArithmeticCombinator, 
        inputs, outputs, operator, left, right, outputSignal);
    }

EachAsValueArithmeticCombinator
  = inputs:WirePair _ "->" _
    Each _
    operator:ArithmeticOperator _
    right:Operand _ As _ outputSignal:Signal _
    "->" _ outputs:WirePair
    {
      return new Statement(location(), network.EachAsValueArithmeticCombinator, 
        inputs, outputs, operator, right, outputSignal);
    }

EachAsEachArithmeticCombinator
  = inputs:WirePair _ "->" _
    Each _
    operator:ArithmeticOperator _
    right:Operand _ As _ Each _
    "->" _ outputs:WirePair
    {
      return new Statement(location(), network.EachAsEachArithmeticCombinator, 
        inputs, outputs, operator, right);
    }

ArithmeticCombinator
  = ValueAsValueArithmeticCombinator
  / EachAsValueArithmeticCombinator
  / EachAsEachArithmeticCombinator

SimpleDeciderCombinator
  = inputs:WirePair _ "->" _
    left:(Operand / Any / All) _
    operator:DeciderOperator _
    right:Operand _ Then _
    asOne:("1" _ As _)? _
    outputSignal:(Signal / All) _
    "->" _ outputs:WirePair
    {
      return new Statement(location(), network.SimpleDeciderCombinator, 
        inputs, outputs, operator, left, right, outputSignal,
        !!asOne);
    }

SumDeciderCombinator
  = inputs:WirePair _ "->" _
    Each _
    operator:DeciderOperator _
    right:Operand _ Then _
    asOne:("1" _ As _)? _
    outputSignal:Signal _
    "->" _ outputs:WirePair
    {
      return new Statement(location(), network.SumDeciderCombinator, 
        inputs, outputs, operator, right, outputSignal, !!asOne);
    }

FilterDeciderCombinator
  = inputs:WirePair _ "->" _
    Each _
    operator:DeciderOperator _
    right:Operand _ Then _
    asOne:("1" _ As _)? _
    Each _
    "->" _ outputs:WirePair
    {
      return new Statement(location(), network.FilterDeciderCombinator, 
        inputs, outputs, operator, right, !!asOne);
    }

DeciderCombinator
  = SimpleDeciderCombinator
  / SumDeciderCombinator
  / FilterDeciderCombinator

Display
  = inputs:WirePair _ "->" _
    "[" _ signal:Signal _ "]" {
      return new Statement(location(), network.Display, inputs, signal);
    }

SingleBinding
  = key:Wire _ "=" _ value:Wire {
    return {kind: 'wires', key: key, value: value}; }
  / key:Signal _ "=" _ value:Signal {
    return {kind: 'signals', key: key, value: value}; }

Bindings
  = kv:SingleBinding _ "," _ rest:Bindings {
      if (kv.kind == 'signals' && kv.key in rest['signals']) {
        error('The "' + kv.key +
            '" parameter is bound more than once');
      }
      for (const key of Object.keys(rest['wires'])) {
        if (key == kv.key) {
          error('The "' + key +
              '" parameter is bound more than once');
        }
        if (rest['wires'][key] == kv.value) {
          error('The "' + kv.value +
              '" wire is bound to more than one parameter');
        }
      }
      rest[kv.kind][kv.key] = kv.value;
      return rest;
    }
  / kv:SingleBinding {
      const rest = {wires: {}, signals: {}};
      rest[kv.kind][kv.key] = kv.value;
      return rest;
    }
  / []* { return {wires: {}, signals: {}}; }
    
SubNetworkReference
  = name:NetworkName _ "(" _ bindings:Bindings _ ")" {
    return new SubNetworkReferenceStatement(
        location(), name, bindings.wires, bindings.signals);
  }
  
Label
  = level:$"#"+ [ \t]* text:$[^\n]* {
      return new Statement(location(), network.Label, text, level.length);
    }
    
Statement
  = ConstantCombinator
  / ArithmeticCombinator
  / DeciderCombinator
  / Display
  / SubNetworkReference
  / Label

NetworkParameters
  = first:(Wire / Signal) _ "," _ rest:NetworkParameters {
      if (rest.has(first)) {
        error('Duplicate parameter "' + first + '"');
      }
      rest.add(first);
      return rest;
    }
  / first:(Wire / Signal) { return new Set([first]); }
  / []* { return new Set(); }

CircuitNetwork
  = name:NetworkName _
    "(" _ params:NetworkParameters _ ")" _
    "{" _ nodes:(Statement _)* _ "}" {
      const result = new UnboundCircuitNetwork(name, params);
      for (const x of nodes) {
        result.add(x[0]);
      }
      return result;
    }