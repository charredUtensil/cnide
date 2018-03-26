{
  const network = window.network || {combinators: {}};
  if (!window.network) {
    class CN {
      constructor(){this.c=[];}
      add(e){this.c.push(e);}
      finalize(){}
      forceColor(w, c){this.c.push([w, 'is', c]);}
    }
    network.CircuitNetwork = CN;
  }
  
  class WiresRef {
    constructor(wires) {
      this.wires = wires;
    }
    
    bind(bindings) {
      const r = [];
      for (const wire of this.wires) {
        const boundWire = bindings.prefix + wire;
        r.push(bindings.wireBindings[boundWire] || boundWire);
      }
      return r;
    }
  }
  
  class SignalRef {
    constructor(name) {
      this.name = name;
    }
    
    bind(bindings) {
      return bindings.signalBindings[this.name] || this.name;
    }
  }
  
  class Bindings {
    constructor() {
      this.networks = {};
      this.prefix = '';
      this.wireBindings = {};
      this.signalBindings = {};
      this.lastUid = 0;
    }
    
    uid() {
      this.lastUid++;
      return this.lastUid.toString(16);
    }
  }
  
  class UnboundCircuitNetwork {
    constructor(name, params) {
      this.name = name;
      this.params = params;
      this.children = [];
    }
    
    add(child) {
      this.children.push(child);
    }
    
    bind(cn, bindings) {
      for (const child of this.children) {
        child.bind(cn, bindings);
      }
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
    
    bind(cn, bindings) {
      const boundArgs = [];
      for (const arg of this.args) {
        if (arg.bind) {
          boundArgs.push(arg.bind(bindings));
        } else {
          boundArgs.push(arg);
        }
      }
      try {
        cn.add(this.klass ? new this.klass(...boundArgs) : boundArgs);
      } catch (e) {
        if (e instanceof network.segmenting.SegmentingError) {
          error(e.message, this.location);
        } else {
          throw e;
        }
      }
    }
  }
  
  class SubNetworkReferenceStatement {
    constructor(location, name, wireBindings, signalBindings) {
      this.location = location;
      this.name = name;
      this.wireBindings = wireBindings;
      this.signalBindings = signalBindings
    }
    
    bind(cn, bindings) {
      if (!(this.name in bindings.networks)) {
        error(this.name + ' network is not defined in this scope.', this.location);
      }
      const unboundNetwork = bindings.networks[this.name];
      const childBindings = new Bindings();
      Object.assign(childBindings.networks, bindings.networks);
      delete childBindings.networks[this.name];
      const prefix =
          bindings.prefix + this.name + '.' + bindings.uid() + '.';
      childBindings.prefix = prefix;
      Object.assign(childBindings.wireBindings, bindings.wireBindings);
      for (const param of Object.keys(this.wireBindings)) {
        if (!unboundNetwork.params.has(param)) {
          error(this.name + ' network does not have parameter "' +
              param + '"', this.location);
        }
        childBindings.wireBindings[prefix + param] = this.wireBindings[param];
      }
      childBindings.signalBindings = this.signalBindings;
      unboundNetwork.bind(cn, childBindings);
    }
  }
  
  class DeclareColorStatement {
    constructor(location, wireRef, color) {
      this.location = location;
      this.wireRef = wireRef;
      this.color = color;
    }
    
    bind(cn, bindings) {
      cn.forceColor(this.wireRef.bind(bindings), this.color);
    }
  }
}

CnideProgram
  = _ nodes:(CircuitNetwork _)* !. {
      const networks = {};
      for (const x of nodes) {
        networks[x[0].name] = x[0];
      }
      if (!('Main' in networks)) {
        error(
            'No Main network was defined. ' +
            'You must define a Main() {} network.',
            {start: location().end, end: location().end});
      }
      const cn = new network.CircuitNetwork();
      const bindings = new Bindings();
      Object.assign(bindings.networks, networks);
      delete bindings.networks.Main;
      networks.Main.bind(cn, bindings);
      cn.finalize();
      return cn;
    }

Comment "comment"
  = "//" [ \t]* text:$[^\n]*
  / "/*" ([^*]+ / "*" !"/")* "*/"

_ "whitespace"
  = ([ \t\n\r]+ / Comment)*

As = "as"
Then = "then"
Declare = "declare"

ReservedWord
  = SpecialSignal
  / ButtonKind
  / As / Then
  / Declare
  / MaxInt / MinInt

// Network Name
NetworkName "network name"
  = [A-Z][A-Za-z0-9]* { return text(); }
  
// Named Wires
Wire "wire"
  = [A-Z][A-Z0-9_]* { return text(); }

WirePair
  = "(" a:Wire _ "," _ b:Wire ")" { return new WiresRef([a, b]) }
  / a:Wire { return new WiresRef([a]) }
  / "()" { return [] }

// Operands
MaxInt  "maxint" =  "maxint" { return 0x7fffffff; }
MinInt "-maxint" = "-maxint" { return 0x80000000 & 0xffffffff; }
Integer "integer"
  = "0x" x:[0-9a-fA-F]+ {
      if (x.length > 8) {
        error('32 bit integers can be at most 8 digits.');
      }
      return parseInt(x.join(''), 16) & 0xffffffff;
    }
  / "-"? [0-9]+ {
      const x = parseInt(text(), 10);
      const capped = x & 0xffffffff;
      if (capped != x) {
        error(x + ' is not a valid 32 bit signed integer, ' +
              'and would be interpreted as ' + capped + '.');
      }
      return x;
    }
  / MaxInt
  / MinInt
  
Signal "signal"
  = !ReservedWord [a-z][a-z0-9_]* { return new SignalRef(text()); }

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
      return {key: key.name, value: value};
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

Pulse "pulse" = "pulse" { return network.combinators.PulseButton; }
Toggle "toggle" = "toggle" { return network.combinators.ToggleButton; }
ButtonKind = Pulse / Toggle

// Combinators
ConstantCombinator
  = kind:(ButtonKind _ As _)?
    "{" _ values:KeyValues _ "}" _
    "->" _ outputs:WirePair
    {
      const klass = kind ? kind[0] : network.combinators.ConstantCombinator
      const args = [];
      for (const key of Object.keys(values)) {
        args.push(new SignalRef(key));
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
      return new Statement(location(),
          network.combinators.ValueAsValueArithmeticCombinator, 
          inputs, outputs, operator, left, right, outputSignal);
    }

EachAsValueArithmeticCombinator
  = inputs:WirePair _ "->" _
    Each _
    operator:ArithmeticOperator _
    right:Operand _ As _ outputSignal:Signal _
    "->" _ outputs:WirePair
    {
      return new Statement(location(),
          network.combinators.EachAsValueArithmeticCombinator, 
          inputs, outputs, operator, right, outputSignal);
    }

EachAsEachArithmeticCombinator
  = inputs:WirePair _ "->" _
    Each _
    operator:ArithmeticOperator _
    right:Operand _ As _ Each _
    "->" _ outputs:WirePair
    {
      return new Statement(location(),
          network.combinators.EachAsEachArithmeticCombinator, 
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
      return new Statement(location(),
          network.combinators.SimpleDeciderCombinator, 
          inputs, outputs, operator, left, right, outputSignal, !!asOne);
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
      return new Statement(location(),
          network.combinators.SumDeciderCombinator, 
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
      return new Statement(location(),
          network.combinators.FilterDeciderCombinator, 
          inputs, outputs, operator, right, !!asOne);
    }

DeciderCombinator
  = SimpleDeciderCombinator
  / SumDeciderCombinator
  / FilterDeciderCombinator

Display
  = inputs:WirePair _ "->" _
    "[" _ signal:Signal _ "]" {
      return new Statement(location(), network.combinators.Display, inputs, signal);
    }

SingleBinding
  = key:Wire _ "=" _ value:Wire {
    return {kind: 'wires', key: key, value: value}; }
  / key:Signal _ "=" _ value:Signal {
    return {kind: 'signals', key: key.name, value: value.name}; }

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

DeclareColor
  = Declare _ wire:Wire _ As _ color:("red"/"green") {
      return new DeclareColorStatement(location(), new WiresRef([wire]), color)
    }
  
Label
  = level:$"#"+ [ \t]* text:$[^\n]* {
      return new Statement(location(), network.combinators.Label, text, level.length);
    }
    
Statement
  = ConstantCombinator
  / ArithmeticCombinator
  / DeciderCombinator
  / Display
  / SubNetworkReference
  / DeclareColor
  / Label

NetworkParameters
  = wire:Wire _ "," _ rest:NetworkParameters {
      if (rest.has(wire)) {
        error('Duplicate parameter "' + wire + '"');
      }
      rest.add(wire);
      return rest;
    }
  / signal:Signal _ "," _ rest:NetworkParameters {
      if (rest.has(signal.name)) {
        error('Duplicate parameter "' + signal.name + '"');
      }
      rest.add(signal.name);
      return rest;
    }
  / wire:Wire { return new Set([wire]); }
  / signal:Signal { return new Set([signal.name]); }
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