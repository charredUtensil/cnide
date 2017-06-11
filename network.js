(function(){
  const _htmlClassListForSignal = function(signal) {
    if (signal == 'all' || signal == 'any' || signal == 'each') {
      return ['signal', signal];
    } else if (typeof signal == 'string') {
      return ['signal'];
    } else {
      return ['value'];
    }
  }
  
  const _mergeSignals = function(to, from) {
    for (const k of Object.keys(from)) {
      to[k] = (to[k] || 0) + from[k];
      if (!to[k]) {
        delete to[k];
      }
    }
  }
  
  class CircuitNetwork extends utils.Renderable {
    constructor() {
      super();
      this.tick = 0;
      this.state = {};
      this.children = [];
    }
    
    add(child) {
      this.children.push(child);
    }
    
    step() {
      this.tick++;
      const newState = {};
      for (const c of this.children) {
        c.step(this.state, newState);
      }
      this.state = newState;
      this.renderDebugPane_();
    }
    
    initElement(root) {
      root.classList.add('network-wrapper');
      const networkElement = utils.createHtmlElement(root, 'div', ['network']);
      for (const c of this.children) {
        c.getDomElement(networkElement);
      }
      this.debugPane = utils.createHtmlElement(root, 'div', ['debug']);
      this.renderDebugPane_();
    }
    
    renderDebugPane_() {
      this.debugPane.innerHTML = '';
      utils.createHtmlElement(this.debugPane, 'div', ['tick'], 'Tick #' + this.tick);
      const table = utils.createHtmlElement(this.debugPane, 'table');
      for (const wire of Object.keys(this.state).sort()) {
        if (Object.keys(this.state[wire]).length == 0) {
          continue;
        }
        const wireTr = utils.createHtmlElement(table, 'tr', []);
        utils.createHtmlElement(wireTr, 'th', [], wire);
        const wireTable = utils.createHtmlElement(
            utils.createHtmlElement(wireTr, 'td', []), 'table', []);
        for (const k of Object.keys(this.state[wire]).sort()) {
          const tr = utils.createHtmlElement(wireTable, 'tr', []);
          utils.createHtmlElement(tr, 'td', ['signal'], k);
          utils.createHtmlElement(tr, 'td', ['value'], this.state[wire][k]);
        }
      }
    }
  }
  
  class Networked extends utils.Renderable {
    step(state, newState) {}
    
    initElement(root) {
      root.classList.add('networked');
    }
  }
  
  class Combinator extends Networked {
    constructor(inputs, outputs) {
      super();
      this.inputs = inputs;
      this.outputs = outputs;
      this.element = null;
    }
    
    step(state, newState) {
      const input = {};
      for (const w of this.inputs) {
      	_mergeSignals(input, state[w] || {});
      }
      const output = this.getOutput(input);
      for (const w of this.outputs) {
        newState[w] = newState[w] || {}
      	_mergeSignals(newState[w], output);
      }
    }
    
    getOutput(input) { return {}; }
    
    _opToNumber(values, operand) {
      if (typeof operand == "string") {
        return values[operand] || 0;
      } else {
        return operand;
      }
    }
    
    appendWireElements_(element, wires, io) {
      if (wires) {
        const ul = utils.createHtmlElement(element, 'ul', [io, 'wires']);
        for (const wire of wires) {
          utils.createHtmlElement(ul, 'li', [], wire);
        }
      }
    }
    
    initElement(root) {
      super.initElement(root);
      this.appendWireElements_(root, this.inputs, 'input');
      this.appendWireElements_(root, this.outputs, 'output');
    }
  }
  
  class ConstantCombinator extends Combinator {
  	constructor(outputs, values) {
      super([], outputs);
      this.values = values;
    }
    
    getOutput(inputs) {
      return this.values;
    }
    
    _CombinatorCssClassList() {
      return ['constant', 'combinator'];
    }
    
    initElement(root) {
      super.initElement(root);
      this.body =
        utils.createHtmlElement(root, 'div', this._CombinatorCssClassList());
      const table = utils.createHtmlElement(this.body, 'table', ['values']);
      for (const k of Object.keys(this.values)) {
        const tr = utils.createHtmlElement(table, 'tr');
        utils.createHtmlElement(tr, 'td', ['signal'], k);
        utils.createHtmlElement(tr, 'td', ['value'], this.values[k]);
      }
    }
  }
  
  class ToggleButton extends ConstantCombinator {
  	constructor(outputs, values) {
      super(outputs, values);
      this.active = false;
    }
    
    getOutput(inputs) {
      return this.active ? super.getOutput(inputs) : {};
    }
    
    _setActive(active) {
      if (active) {
        this.body.classList.add('active');
      } else {
        this.body.classList.remove('active');
      }
      this.active = active;
    }
    
    _CombinatorCssClassList() {
      return ['toggle', 'button', 'constant', 'combinator']
    }
    
    initElement(root) {
      super.initElement(root);
      this.body.onclick = () => this._setActive(!this.active);
    }
  }
  
  class PulseButton extends ToggleButton {
    getOutput(inputs) {
      const result = super.getOutput(inputs);
      this._setActive(false);
      return result;
    }
    
    _CombinatorCssClassList() {
      return ['pulse', 'button', 'constant', 'combinator']
    }
  }
  
  // Combined functions for operators for arithmetic / deciders.
  const OPERATOR_FUNCTIONS = {
      '+':  (a, b) => a + b,
      '-':  (a, b) => a - b,
      '*':  (a, b) => a * b,
      '/':  (a, b) => Math.floor(a / b),
      '%':  (a, b) => a % b,
      '&':  (a, b) => a & b,
      '|':  (a, b) => a | b,
      '^':  (a, b) => a ^ b,
      '>>': (a, b) => a >> b,
      '<<': (a, b) => a << b,
      '<':  (a, b) => a < b,
      '<=': (a, b) => a <= b,
      '=':  (a, b) => a == b,
      '!=': (a, b) => a != b,
      '>=': (a, b) => a >= b,
      '>':  (a, b) => a > b};
  
  class ArithmeticCombinator extends Combinator {
    constructor(inputs, outputs, operator, left, right, outputSignal) {
      super(inputs, outputs);
      this.operator = operator;
      this.operatorFn = OPERATOR_FUNCTIONS[operator];
      this.left = left;
      this.right = right;
      this.outputSignal = outputSignal;
    }
    
    _apply(values, a, b) {
      return this.operatorFn(
          this._opToNumber(values, a),
          this._opToNumber(values, b));
    }
    
    initElement(root) {
      super.initElement(root);
      const elem =
          utils.createHtmlElement(root, 'div', ['arithmetic', 'combinator']);
      utils.createHtmlElement(
        elem, 'span', _htmlClassListForSignal(this.left), this.left);
      elem.innerHTML += ' ';
      utils.createHtmlElement(elem, 'span', ['operator'], this.operator);
      elem.innerHTML += ' ';
      utils.createHtmlElement(
        elem, 'span', _htmlClassListForSignal(this.right), this.right);
      elem.innerHTML += ' as ';
      utils.createHtmlElement(
        elem, 'span', _htmlClassListForSignal(this.outputSignal),
        this.outputSignal);
    }
  }
  
  class ValueAsValueArithmeticCombinator extends ArithmeticCombinator {
    getOutput(input) {
      const r = {};
      r[this.outputSignal] =
      this._apply(input, this.left, this.right);
      return r;
    }
  }
  
  class EachAsValueArithmeticCombinator extends ArithmeticCombinator {
    constructor(inputs, outputs, operator, right, outputSignal) {
      super(inputs, outputs, operator, 'each', right, outputSignal);
    }
    
    getOutput(input) {
      let sum = 0;
      for (const k of Object.keys(input)) {
        sum += this._apply(input, k, this.right);
      }
      const r = {};
      r[this.outputSignal] = sum;
      return r;
    }
  }
  
  class EachAsEachArithmeticCombinator extends ArithmeticCombinator {
    constructor(inputs, outputs, operator, right) {
      super(inputs, outputs, operator, 'each', right, 'each');
    }
    
    getOutput(input) {
      const r = {};
      for (const k of Object.keys(input)) {
        r[k] = this._apply(input, k, this.right);
      }
      return r;
    }
  }
  
  class DeciderCombinator extends Combinator {
    constructor(inputs, outputs, operator, left, right, outputSignal,
        asOne) {
      super(inputs, outputs);
      this.operator = operator;
      this.operatorFn = OPERATOR_FUNCTIONS[operator];
      this.left = left;
      this.right = right;
      this.outputSignal = outputSignal;
      this.asOne = asOne;
    }
    
    _compare(values, a, b) {
      return this.operatorFn(
          this._opToNumber(values, a),
          this._opToNumber(values, b));
    }
    
    initElement(root) {
      super.initElement(root);
      const elem =
          utils.createHtmlElement(root, 'div', ['decider', 'combinator']);
      utils.createHtmlElement(
          elem, 'span', _htmlClassListForSignal(this.left),
          this.left);
      elem.innerHTML += ' ';
      utils.createHtmlElement(elem, 'span', ['operator'], this.operator);
      elem.innerHTML += ' ';
      utils.createHtmlElement(
          elem, 'span', _htmlClassListForSignal(this.right),
          this.right);
      elem.innerHTML += ' then ';
      utils.createHtmlElement(
          elem, 'span', _htmlClassListForSignal(this.outputSignal),
          this.outputSignal);
      elem.innerHTML += ' ';
      utils.createHtmlElement(
          elem, 'span', ['as'], this.asOne ? 'as 1' : 'as input');
    }
  }
  
  class SimpleDeciderCombinator extends DeciderCombinator {
    constructor(inputs, outputs, operator, left, right, outputSignal,
        asOne) {
      super(inputs, outputs, operator, left, right, outputSignal,
          asOne);
      this.isAny = left == 'any';
      this.isAll = left == 'all';
      this.conditionMet = false;
    }
    
    _checkCondition(values) {
      if (!this.isAny && !this.isAll) {
        return this._compare(values, this.left, this.right);
      }
      for (const k of Object.keys(input)) {
        const condition = this._compare(input, k, this.right);
        if (this.isAny && condition) { return true; }
        if (this.isAll && !condition) { return false; }
      }
      return this.isAll;
    }
    
    getOutput(input) {
      this.conditionMet = this._checkCondition(input);
      if (!this.conditionMet) { return {}; }
      if (this.outputSignal == 'all') {
        if (this.asOne) {
          const r = {};
          for (const k of Object.keys(input)) {
            r[k] = 1;
          }
          return r;
        } else {
          return input;
        }
      } else {
        const r = {};
        r[this.outputSignal] =
            this.asOne ? 1 : input[this.outputSignal];
        return r;
      }
    }
  }
  
  class SumDeciderCombinator extends DeciderCombinator {
    constructor(inputs, outputs, operator, right, outputSignal,
        asOne) {
      super(inputs, outputs, operator);
      this.right = right;
      this.outputSignal = outputSignal;
      this.asOne = asOne;
    }
    
    getOutput(input) {
      let sum = 0;
      for (const k of Object.keys(input)) {
        const condition = this._compare(input, k, this.right);
        if (!condition) { break; }
        sum += this.asOne ? 1 : input[k];
      }
      const r = {};
      r[this.outputSignal] = sum;
      return r;
    }
  }
  
  class FilterDeciderCombinator extends DeciderCombinator {
    constructor(inputs, outputs, operator, right, asOne) {
      super(inputs, outputs, operator);
      this.right = right;
      this.asOne = asOne;
    }
    
    getOutput(input) {
      const r = {};
      for (const k of Object.keys(input)) {
        const condition = this._compare(input, k, this.right);
        if (!condition) { break; }
        r[k] = this.asOne ? 1 : input[k];
      }
      return r;
    }
  }
  
  class Display extends Combinator {
    constructor(inputs, signal) {
      super(inputs, []);
      this.signal = signal;
      this.value = 0;
      this.valueElement = null;
    }
    
    getOutput(input) {
      this.value = input[this.signal] || 0;
      if (this.valueElement) {
        this.valueElement.innerHTML = utils.factorioHumanize(this.value);
      }
    }
    
    initElement(root) {
      super.initElement(root);
      const elem =
          utils.createHtmlElement(root, 'div', ['display', 'combinator']);
      utils.createHtmlElement(elem, 'span', ['signal'], this.signal);
      this.valueElement = utils.createHtmlElement(
          elem, 'span', ['value'], '' + this.value);
    }
  }
  
  class Comment extends Networked {
    constructor(text) {
      super();
      this.text = text;
    }
    
    join(other) {
      return new Comment(this.text + '\n' + other.text);
    }
    
    step(state, newState) {}
    
    initElement(root) {
      super.initElement(root);
      root.classList.add('comment');
      root.textContent = this.text;
    }
  }
  
  const network = {};
  network.CircuitNetwork = CircuitNetwork;
  network.Display = Display;
  network.ConstantCombinator = ConstantCombinator;
  network.PulseButton = PulseButton;
  network.ToggleButton = ToggleButton;
  network.ArithmeticCombinator = ArithmeticCombinator;
  network.ValueAsValueArithmeticCombinator = ValueAsValueArithmeticCombinator;
  network.EachAsValueArithmeticCombinator = EachAsValueArithmeticCombinator;
  network.EachAsEachArithmeticCombinator = EachAsEachArithmeticCombinator;
  network.SimpleDeciderCombinator = SimpleDeciderCombinator;
  network.SumDeciderCombinator = SumDeciderCombinator;
  network.FilterDeciderCombinator = FilterDeciderCombinator;
  network.Display = Display;
  network.Comment = Comment;
  window.network = network;
})();