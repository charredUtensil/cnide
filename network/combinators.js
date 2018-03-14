network.combinators = (function(){
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
   * A pair of power poles.
   * These have no syntax for creating them,
   * but are created as needed when combinators are too far apart.
   */
  class Pole extends network.Combinator {
    /** @Override */
    cssClass() { return 'pole'; }
    
    /** @Override */
    step(..._) {}
  }
  
  /** A combinator which always outputs a constant value. */
  class ConstantCombinator extends network.Combinator {
  	constructor(outputs, ...args) {
      super([], outputs);
      this.values = {};
      for (let i = 0; i < args.length; i += 2) {
        this.values[args[i]] = args[i + 1];
      }
    }
    
    /** @Override */
    cssClass() { return 'constant'; }
    
    /** @Override */
    getOutput(inputs) {
      return this.values;
    }
    
    /** @Override */
    initElements() {
      const keys = Object.keys(this.values);
      if (keys.length == 1) {
        utils.createHtmlElement(this.thumbnail, 'div', ['signal'], keys[0]);
        utils.createHtmlElement(this.thumbnail, 'div', ['value'],
                                utils.factorioHumanize(this.values[keys[0]]));
      }
    }
  }
  
  /** A constant combinator that is turned on/off by clicking on its switch. */
  class ToggleButton extends ConstantCombinator {
  
    /** @Override */
    getOutput(inputs) {
      return this.active ? super.getOutput(inputs) : {};
    }
    
    setActive_(active) {
      if (active) {
        this.thumbnail.classList.add('active');
        this.detail.classList.add('active');
      } else {
        this.thumbnail.classList.remove('active');
        this.detail.classList.remove('active');
      }
      this.active = active;
    }
    
    /** @Override */
    cssClass() {
      return 'toggle';
    }
    
    faIcons_() {
      return {active: 'power-off', inactive: 'circle-o'};
    }
    
    /** @Override */
    initElements() {
      super.initElements();
      for (parent of [this.thumbnail, this.detail]) {
        const button = utils.createHtmlElement(parent, 'div', ['button']);
        button.onclick = () => this.setActive_(!this.active);
        const fa = this.faIcons_();
        utils.createHtmlElement(
            button, 'i', ['icon', 'inactive', 'fa', 'fa-' + fa.inactive]);
        utils.createHtmlElement(
            button, 'i', ['icon', 'active', 'fa', 'fa-' + fa.active]);
      }
    }
  }
  
  /** A toggle button combinator that resets itself on each tick. */
  class PulseButton extends ToggleButton {
    getOutput(inputs) {
      const result = super.getOutput(inputs);
      this.setActive_(false);
      return result;
    }
    
    /** @Override */
    cssClass() {
      return 'pulse';
    }
    
    faIcons_() {
      return {active: 'dot-circle-o', inactive: 'circle-o'};
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
  class ArithmeticCombinator extends network.Combinator {
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
    cssClass() {
      return 'arithmetic';
    }
    
    /** @Override */
    initElements() {
      utils.createHtmlElement(this.thumbnail, 'div', ['operator'], this.operator);
      utils.createHtmlElement(
        this.detail, 'span', htmlClassListForSignal_(this.left), this.left);
      this.detail.innerHTML += ' ';
      utils.createHtmlElement(this.detail, 'span', ['operator'], this.operator);
      this.detail.innerHTML += ' ';
      utils.createHtmlElement(
        this.detail, 'span', htmlClassListForSignal_(this.right), this.right);
      utils.createHtmlElement(this.detail, 'span', ['as'], ' as ');
      utils.createHtmlElement(
        this.detail, 'span', htmlClassListForSignal_(this.outputSignal),
        this.outputSignal);
    }
  }
  
  /** An arithmetic combinator without special signals. */
  class ValueAsValueArithmeticCombinator extends ArithmeticCombinator {
    /** @Override */
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
    
    /** @Override */
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
    
    /** @Override */
    getOutput(input) {
      const r = {};
      for (const k of Object.keys(input)) {
        r[k] = this.apply_(input, k, this.right);
      }
      return r;
    }
  }
  
  class DeciderCombinator extends network.Combinator {
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
    
    /** @Override */
    cssClass() {
      return 'decider';
    }
    
    /** @Override */
    initElements() {
      utils.createHtmlElement(this.thumbnail, 'div', ['operator'], this.operator);
      utils.createHtmlElement(
          this.detail, 'span', htmlClassListForSignal_(this.left),
          this.left);
      this.detail.innerHTML += ' ';
      utils.createHtmlElement(this.detail, 'span', ['operator'], this.operator);
      this.detail.innerHTML += ' ';
      utils.createHtmlElement(
          this.detail, 'span', htmlClassListForSignal_(this.right),
          this.right);
      utils.createHtmlElement(this.detail, 'span', ['then'], ' then ');
      if (this.asOne) {
        utils.createHtmlElement(
            this.detail, 'span', ['as'], '1 as ');
      }
      utils.createHtmlElement(
          this.detail, 'span', htmlClassListForSignal_(this.outputSignal),
          this.outputSignal);
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
      for (const k of Object.keys(values)) {
        const condition = this.compare_(values, k, this.right);
        if (this.isAny && condition) { return true; }
        if (this.isAll && !condition) { return false; }
      }
      return this.isAll;
    }
    
    /** @Override */
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
            this.asOne ? 1 : input[this.outputSignal] || 0;
        return r;
      }
    }
  }
  
  class SumDeciderCombinator extends DeciderCombinator {
    constructor(inputs, outputs, operator, right, outputSignal, asOne) {
      super(inputs, outputs, operator);
      this.right = right;
      this.outputSignal = outputSignal;
      this.asOne = asOne;
    }
    
    /** @Override */
    getOutput(input) {
      let sum = 0;
      for (const k of Object.keys(input)) {
        const condition = this.compare_(input, k, this.right);
        if (!condition) { continue; }
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
    
    /** @Override */
    getOutput(input) {
      const r = {};
      for (const k of Object.keys(input)) {
        const condition = this.compare_(input, k, this.right);
        if (!condition) { continue; }
        r[k] = this.asOne ? 1 : input[k];
      }
      return r;
    }
  }
  
  class Display extends network.Combinator {
    constructor(inputs, signal) {
      super(inputs, []);
      this.signal = signal;
      this.value = 0;
      this.valueElement = null;
    }
    
    /** @Override */
    getOutput(input) {
      this.value = input[this.signal] || 0;
      if (this.valueElement) {
        this.valueElement.innerHTML = utils.factorioHumanize(this.value);
      }
    }
    
    /** @Override */
    cssClass() {
      return 'display';
    }
    
    /** @Override */
    initElements() {
      utils.createHtmlElement(this.thumbnail, 'div', ['signal'], this.signal);
      this.valueElement = utils.createHtmlElement(
          this.thumbnail, 'div', ['value'], '' + this.value);
    }
  }
  
  class Label extends network.Combinator {
    constructor(text, level) {
      super([], []);
      this.text = text;
      this.level = Math.min(level, 3);
    }
    
    /** @Override */
    cssClass() {
      return 'label';
    }
    
    /** @Override */
    step(..._) {}
    
    initElements() {
      for (const elem of [this.thumbnail, this.detail]) {
        elem.classList.add('h' + this.level);
        elem.textContent = this.text;
      }
    }
  }
  
  const combinators = {};
  combinators.Pole = Pole;
  combinators.Display = Display;
  combinators.ConstantCombinator = ConstantCombinator;
  combinators.PulseButton = PulseButton;
  combinators.ToggleButton = ToggleButton;
  combinators.ValueAsValueArithmeticCombinator = ValueAsValueArithmeticCombinator;
  combinators.EachAsValueArithmeticCombinator = EachAsValueArithmeticCombinator;
  combinators.EachAsEachArithmeticCombinator = EachAsEachArithmeticCombinator;
  combinators.SimpleDeciderCombinator = SimpleDeciderCombinator;
  combinators.SumDeciderCombinator = SumDeciderCombinator;
  combinators.FilterDeciderCombinator = FilterDeciderCombinator;
  combinators.Display = Display;
  combinators.Label = Label;
  return combinators;
})();
