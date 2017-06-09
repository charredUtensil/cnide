(function(){
  const _createHtmlElement = function(parent, tag, classList, text) {
    const element = document.createElement(tag);
    if (classList) {
      for (c of classList){
        element.classList.add(c);
      }
    }
    if (typeof text != 'undefined') {
      element.appendChild(document.createTextNode(text));
    }
    parent.appendChild(element);
    return element;
  };

  const _htmlClassListForSignal = function(signal) {
    if (signal == 'all' || signal == 'any' || signal == 'each') {
      return ['signal', signal];
    } else if (typeof signal == 'string') {
      return ['signal'];
    } else {
      return ['value'];
    }
  };
  
  const _mergeSignals = function(to, from) {
    for (const k of Object.keys(from)) {
      to[k] = (to[k] || 0) + from[k];
      if (!to[k]) {
        delete to[k];
      }
    }
  }
  
  const _factorioHumanize = function(value) {
    const negate = value < 0;
    let v = negate ? -value : value;
    let suffixIndex = 0;
    while (v >= 1000) {
      v /= 1000;
      suffixIndex++;
    }
    return (negate ? '-' : '') + Math.floor(v) + ['', 'K', 'M', 'G'][suffixIndex]
  }
  
  class Networked {
    getDomElement(parent) {
      if (!this.element) {
      	const element =
            _createHtmlElement(parent, 'div', ['networked']);
        this.initElement(element);
        this.element = element;
      }
      return this.element;
    }
    
    initElement(element) {}
  }
  
  class CircuitNetwork extends Networked {
    constructor() {
      super();
      this.state = {};
      this.children = [];
    }
    
    add(child) {
      this.children.push(child);
    }
    
    step() {
      const newState = {};
      for (const c of this.children) {
        c.step(this.state, newState);
      }
      this.state = newState;
    }
    
    initElement(element) {
      element.classList.add('network');
      for (const c of this.children) {
        c.getDomElement(element);
      }
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
    
    appendWireElements(element) {
      this.appendWireElementsHelper_(element, this.inputs, 'input');
      this.appendWireElementsHelper_(element, this.outputs, 'output');
    }
    
    appendWireElementsHelper_(element, wires, io) {
      if (wires) {
        const ul = _createHtmlElement(element, 'ul', [io, 'wires']);
        for (const wire of wires) {
          _createHtmlElement(ul, 'li', [], wire);
        }
      }
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
      this.appendWireElements(root);
      this.body =
        _createHtmlElement(root, 'div', this._CombinatorCssClassList());
      const table = _createHtmlElement(this.body, 'table', ['values']);
      for (const k of Object.keys(this.values)) {
        const tr = _createHtmlElement(table, 'tr');
        _createHtmlElement(tr, 'td', ['signal'], k);
        _createHtmlElement(tr, 'td', ['value'], this.values[k]);
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
      this.appendWireElements(root);
      const elem =
          _createHtmlElement(root, 'div', ['arithmetic', 'combinator']);
      _createHtmlElement(
        elem, 'span', _htmlClassListForSignal(this.left), this.left);
      elem.innerHTML += ' ';
      _createHtmlElement(elem, 'span', ['operator'], this.operator);
      elem.innerHTML += ' ';
      _createHtmlElement(
        elem, 'span', _htmlClassListForSignal(this.right), this.right);
      elem.innerHTML += ' as ';
      _createHtmlElement(
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
      this.appendWireElements(root);
      const elem =
          _createHtmlElement(root, 'div', ['decider', 'combinator']);
      _createHtmlElement(
          elem, 'span', _htmlClassListForSignal(this.left),
          this.left);
      elem.innerHTML += ' ';
      _createHtmlElement(elem, 'span', ['operator'], this.operator);
      elem.innerHTML += ' ';
      _createHtmlElement(
          elem, 'span', _htmlClassListForSignal(this.right),
          this.right);
      elem.innerHTML += ' then ';
      _createHtmlElement(
          elem, 'span', _htmlClassListForSignal(this.outputSignal),
          this.outputSignal);
      elem.innerHTML += ' ';
      _createHtmlElement(
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
        this.valueElement.innerHTML = _factorioHumanize(this.value);
      }
    }
    
    initElement(root) {
      this.appendWireElements(root);
      const elem =
          _createHtmlElement(root, 'div', ['display', 'combinator']);
      _createHtmlElement(elem, 'span', ['signal'], this.signal);
      this.valueElement = _createHtmlElement(
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