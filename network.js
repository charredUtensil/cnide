(function(){
  /** Returns the list of classes for a given value, signal, or special signal. */
  const htmlClassListForSignal_ = function(signal) {
    if (signal == 'all' || signal == 'any' || signal == 'each') {
      return ['signal', signal];
    } else if (typeof signal == 'string') {
      return ['signal'];
    } else {
      return ['value'];
    }
  }
  
  /**
   * Modifies the "to" object to add every value for every key from the "from" object.
   * This essentially "merges" two wire values together to form the final result.
   * Keys with a value of 0 are removed.
   */
  const mergeSignals_ = function(to, from) {
    for (const k of Object.keys(from)) {
      to[k] = (to[k] || 0) + from[k];
      if (!to[k]) {
        delete to[k];
      }
    }
  }
  
  /**
   * The root circuit network which contains all combinators and other networked things.
   */
  class CircuitNetwork extends utils.Renderable {
    constructor() {
      super();
      this.tick = 0;
      /**
       * State is a map of wire names to maps of signal names to values.
       */
      this.state = {};
      this.children = [];
    }
    
    /** Adds the child to this network. */
    add(child) {
      this.children.push(child);
    }
    
    /** Runs the simulation one tick forward. */
    step() {
      this.tick++;
      const newState = {};
      for (const c of this.children) {
        c.step(this.state, newState);
      }
      this.state = newState;
      this.renderDebugPane_();
    }
    
    /** @Override */
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
  
  /** Something that can be connected to a circuit network. */
  class Networked extends utils.Renderable {
    /**
     * Runs the simulation for this object one tick forward.
     * Args:
     *   state: The current (previous) state.
     *   newState: The state after the current tick completes. This should be modified by
     *       this function however it will affect the new state.
     */
    step(state, newState) {}
    
    /** @Override */
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
    
    /** @Override that delegates to getOutput() */
    step(state, newState) {
      const input = {};
      for (const w of this.inputs) {
      	mergeSignals_(input, state[w] || {});
      }
      const output = this.getOutput(input);
      for (const w of this.outputs) {
        newState[w] = newState[w] || {}
      	mergeSignals_(newState[w], output);
      }
    }
    
    /**
     * Runs the simulation one tick forward.
     * Args:
     *   input: A map of signal names to values for the sum of wires connected to the
     *       input of this combinator.
     * Returns:
     *   A map of signal names to values for the wires connected to the output of this
     *       combinator.
     */
    getOutput(input) { return {}; }
    
    /** Parses an operand as a number or signal, returning the value. */
    opToNumber_(values, operand) {
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
    
    /** @Override */
    initElement(root) {
      super.initElement(root);
      this.appendWireElements_(root, this.inputs, 'input');
      this.appendWireElements_(root, this.outputs, 'output');
    }
  }
  
  /** A combinator which always outputs a constant value. */
  class ConstantCombinator extends Combinator {
  	constructor(outputs, values) {
      super([], outputs);
      this.values = values;
    }
    
    /** @Override */
    getOutput(inputs) {
      return this.values;
    }
    
    CombinatorCssClassList_() {
      return ['constant', 'combinator'];
    }
    
    /** @Override */
    initElement(root) {
      super.initElement(root);
      this.body =
        utils.createHtmlElement(root, 'div', this.CombinatorCssClassList_());
      const table = utils.createHtmlElement(this.body, 'table', ['values']);
      for (const k of Object.keys(this.values)) {
        const tr = utils.createHtmlElement(table, 'tr');
        utils.createHtmlElement(tr, 'td', ['signal'], k);
        utils.createHtmlElement(tr, 'td', ['value'], this.values[k]);
      }
    }
  }
  
  /** A constant combinator that is turned on/off by clicking on it. */
  class ToggleButton extends ConstantCombinator {
  	constructor(outputs, values) {
      super(outputs, values);
      this.active = false;
    }
    
    /** @Override */
    getOutput(inputs) {
      return this.active ? super.getOutput(inputs) : {};
    }
    
    setActive_(active) {
      if (active) {
        this.body.classList.add('active');
      } else {
        this.body.classList.remove('active');
      }
      this.active = active;
    }
    
    CombinatorCssClassList_() {
      return ['toggle', 'button', 'constant', 'combinator']
    }
    
    /** @Override */
    initElement(root) {
      super.initElement(root);
      this.body.onclick = () => this.setActive_(!this.active);
    }
  }
  
  /** A toggle button combinator that resets itself on each tick. */
  class PulseButton extends ToggleButton {
    getOutput(inputs) {
      const result = super.getOutput(inputs);
      this.setActive_(false);
      return result;
    }
    
    CombinatorCssClassList_() {
      return ['pulse', 'button', 'constant', 'combinator']
    }
  }
  
  /**
   * Functions for operators for arithmetic and decider combinators. Each function
   * performs the operation on its two inputs and returns the result. The arithmetic
   * functions return numbers and the decider functions return booleans.
   */
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
  
  /**
   * A combinator that performs operations on numbers.
   * This class is abstract. Subclasses define behavior based on which special signals are
   * present.
   */
  class ArithmeticCombinator extends Combinator {
    constructor(inputs, outputs, operator, left, right, outputSignal) {
      super(inputs, outputs);
      this.operator = operator;
      this.operatorFn = OPERATOR_FUNCTIONS[operator];
      this.left = left;
      this.right = right;
      this.outputSignal = outputSignal;
    }
    
    apply_(values, a, b) {
      return this.operatorFn(
          this.opToNumber_(values, a),
          this.opToNumber_(values, b));
    }
    
    /** @Override */
    initElement(root) {
      super.initElement(root);
      const elem =
          utils.createHtmlElement(root, 'div', ['arithmetic', 'combinator']);
      utils.createHtmlElement(
        elem, 'span', htmlClassListForSignal_(this.left), this.left);
      elem.innerHTML += ' ';
      utils.createHtmlElement(elem, 'span', ['operator'], this.operator);
      elem.innerHTML += ' ';
      utils.createHtmlElement(
        elem, 'span', htmlClassListForSignal_(this.right), this.right);
      elem.innerHTML += ' as ';
      utils.createHtmlElement(
        elem, 'span', htmlClassListForSignal_(this.outputSignal),
        this.outputSignal);
    }
  }
  
  /** An arithmetic combinator without special signals. */
  class ValueAsValueArithmeticCombinator extends ArithmeticCombinator {
    getOutput(input) {
      const r = {};
      r[this.outputSignal] =
      this.apply_(input, this.left, this.right);
      return r;
    }
  }
  
  /** An arithmetic combinator with "each" as its left input. */
  class EachAsValueArithmeticCombinator extends ArithmeticCombinator {
    constructor(inputs, outputs, operator, right, outputSignal) {
      super(inputs, outputs, operator, 'each', right, outputSignal);
    }
    
    getOutput(input) {
      let sum = 0;
      for (const k of Object.keys(input)) {
        sum += this.apply_(input, k, this.right);
      }
      const r = {};
      r[this.outputSignal] = sum;
      return r;
    }
  }
  
  /** An arithmetic combinator with "each" as its left input and output. */
  class EachAsEachArithmeticCombinator extends ArithmeticCombinator {
    constructor(inputs, outputs, operator, right) {
      super(inputs, outputs, operator, 'each', right, 'each');
    }
    
    getOutput(input) {
      const r = {};
      for (const k of Object.keys(input)) {
        r[k] = this.apply_(input, k, this.right);
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
    
    compare_(values, a, b) {
      return this.operatorFn(
          this.opToNumber_(values, a),
          this.opToNumber_(values, b));
    }
    
    initElement(root) {
      super.initElement(root);
      const elem =
          utils.createHtmlElement(root, 'div', ['decider', 'combinator']);
      utils.createHtmlElement(
          elem, 'span', htmlClassListForSignal_(this.left),
          this.left);
      elem.innerHTML += ' ';
      utils.createHtmlElement(elem, 'span', ['operator'], this.operator);
      elem.innerHTML += ' ';
      utils.createHtmlElement(
          elem, 'span', htmlClassListForSignal_(this.right),
          this.right);
      elem.innerHTML += ' then ';
      utils.createHtmlElement(
          elem, 'span', htmlClassListForSignal_(this.outputSignal),
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
    
    checkCondition_(values) {
      if (!this.isAny && !this.isAll) {
        return this.compare_(values, this.left, this.right);
      }
      for (const k of Object.keys(input)) {
        const condition = this.compare_(input, k, this.right);
        if (this.isAny && condition) { return true; }
        if (this.isAll && !condition) { return false; }
      }
      return this.isAll;
    }
    
    getOutput(input) {
      this.conditionMet = this.checkCondition_(input);
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
        const condition = this.compare_(input, k, this.right);
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
        const condition = this.compare_(input, k, this.right);
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