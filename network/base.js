const network = (function(){
  const MAX_INT = 2147483647;
  const COMBINATOR_HALF_HEIGHT = 96 / 2;
  
  /**
   * Modifies the "to" object to add every value for every key from the "from" object.
   * This essentially "merges" two wire values together to form the final result.
   * Keys with a value of 0 are removed. Values are clamped within -MAX_INT...MAX_INT.
   */
  const mergeSignals_ = function(to, from) {
    for (const k of Object.keys(from)) {
      const result = (to[k] || 0) + from[k];
      if (result) {
        to[k] = result <= -MAX_INT ? -MAX_INT :
                result >= MAX_INT ? MAX_INT : result;
      } else {
        delete to[k];
      }
    }
  }
  
  /**
   * Circuit network which contains all combinators and other networked things.
   */
  class CircuitNetwork extends utils.Renderable {
    constructor() {
      super();
      this.tick = 0;
      /**
       * State is a map of wire names to maps of signal names to values.
       */
      this.state = {};
      this.hiliteWires = new Set();
      this.children = [];
      this.colorCalculator = new network.segmenting.WireColorCalculator();
    }
    
    /** Adds the child to this network. */
    add(child) {
      this.children.push(child);
      this.colorCalculator.add(child.inputs);
      this.colorCalculator.add(child.outputs);
    }
    
    /** Forces a wire to be a color. */
    forceColor(wire, color) {
      this.colorCalculator.forceColor(wire, color);
    }
    
    /** Runs the simulation one tick forward. */
    step() {
      this.tick++;
      const newState = {};
      for (const c of this.children) {
        c.step(this.state, newState);
      }
      this.state = newState;
      this.updateStateElem_();
    }
    
    /** @Override */
    initElement(root) {
      root.classList.add('network-wrapper');
      this.networkElement = utils.createHtmlElement(root, 'div', ['network']);
      let yMax = 0;
      for (const c of this.children) {
        c.createElements(this.networkElement, this);
        if (c.yPos > yMax) { yMax = c.yPos; }
      }
      this.networkElement.style.height = (yMax + 2) * COMBINATOR_HALF_HEIGHT;
      this.stateElem = utils.createHtmlElement(
          utils.createHtmlElement(root, 'div', ['state-wrapper']), 'div', ['state']);
      this.updateStateElem_();
      this.updateSegmentOverlay_();
      this.onresize_ = () => this.updateSegmentOverlay_();
      window.addEventListener('resize', this.onresize_);
    }
    
    destroy() {
      if (this.onresize_) {
        window.removeEventListener('resize', this.onresize);
      }
    }
    
    finalize() {
      this.colors = this.colorCalculator.getColors();
      this.segments = network.segmenting.getSegments(this, this.colors);
    }
    
    setHiliteWires(wires) {
      this.hiliteWires = new Set(wires);
      this.updateSegmentOverlay_();
      this.updateStateElem_();
    }
    
    updateSegmentOverlay_() {
      if (this.segmentUnderlay) {
        this.segmentUnderlay.remove();
      }
      if (this.segmentOverlay) {
        this.segmentOverlay.remove();
      }
      this.segmentUnderlay = createSvgElement_(this.networkElement, 'svg');
      this.segmentUnderlay.classList.add('underlay');
      this.segmentOverlay = createSvgElement_(this.networkElement, 'svg');
      this.segmentOverlay.classList.add('overlay');
      const rect = this.networkElement.getBoundingClientRect();
      for (const svg of [this.segmentUnderlay, this.segmentOverlay]) {
        svg.classList.add('segments');
        svg.setAttribute('width', rect.width);
        svg.setAttribute('height', this.networkElement.scrollHeight);
      }
      const activeConnections = {};
      for (const segment of this.segments) {
        const active = this.hiliteWires.has(segment.from.wire);
        const fromRect =
            segment.from.combinator.thumbnail.getBoundingClientRect();
        const toRect =
            segment.to.combinator.thumbnail.getBoundingClientRect();
        const path = createSvgElement_(active ? this.segmentOverlay : this.segmentUnderlay, 'path');
        
        const x1 = {red: fromRect.left + 20,
                    green: fromRect.right - 20}[segment.color] - rect.left;
        const x2 = {red: toRect.left + 20,
                    green: toRect.right - 20}[segment.color] - rect.left;
        const y1 = [fromRect.top + 10,
                    fromRect.bottom - 20][segment.from.hOffset] +
                   {red: 0, green: 10}[segment.color] - rect.top;
        const y2 = [toRect.top + 10,
                    toRect.bottom - 20][segment.to.hOffset] +
                   {red: 0, green: 10}[segment.color] - rect.top;
        
        //TODO: one path / sgv
        //TODO: use angled paths
        path.setAttribute('d', ['M', x1, y1, 'L' + x2 + ',' + y2].join(' '));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-width', 4);
        path.setAttribute('stroke', segment.getColorAttr(active));
        if (active) {
          const k1 = x1 + ',' + y1;
          if (!(activeConnections[k1])) {
            activeConnections[k1] = {x: x1, y: y1};
          }
          const k2 = x2 + ',' + y2;
          if (!(activeConnections[k2])) {
            activeConnections[k2] = {x: x2, y: y2};
          }
        }
      }
      for (const k of Object.keys(activeConnections)) {
        const c = activeConnections[k];
        const circle = createSvgElement_(this.segmentOverlay, 'circle');
        circle.setAttribute('cx', c.x);
        circle.setAttribute('cy', c.y);
        circle.setAttribute('r', 6);
        circle.setAttribute('stroke-width', 2);
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('fill', 'white');
      }
    }
    
    updateStateElem_() {
      this.stateElem.innerHTML = '';
      const wireHighlights = {};
      const wires = new Set(Object.keys(this.state).concat(Object.keys(wireHighlights)));
      for (const wire of Array.from(wires).sort()) {
        if (Object.keys(this.state[wire]).length == 0 && !(wire in wireHighlights)) {
          continue;
        }
        const wireClasses = ['wire', this.colors[wire]];
        if (wire in wireHighlights) {
          wireClasses.push('highlight');
        }
        const wireElem = utils.createHtmlElement(this.stateElem, 'div', wireClasses);
        utils.createHtmlElement(wireElem, 'div', ['name'], wire);
        const signalTable = utils.createHtmlElement(wireElem, 'table', []);
        for (const k of Object.keys(this.state[wire]).sort()) {
          const tr = utils.createHtmlElement(signalTable, 'tr', []);
          utils.createHtmlElement(tr, 'td', ['signal'], k);
          utils.createHtmlElement(tr, 'td', ['value'], this.state[wire][k]);
        }
      }
    }
  }
   
  const createSvgElement_ = function(root, tag) {
    const elem = document.createElementNS('http://www.w3.org/2000/svg', tag);
    root.appendChild(elem);
    return elem;
  }
  
  /** Something that can be connected to a circuit network. */
  class Combinator {
    constructor(inputs, outputs) {
      this.inputs = inputs;
      this.outputs = outputs;
      this.lastOutput = {};
      this.xPos = -1;
      this.yPos = -1;
    }
    
    /**
     * Runs the simulation for this object one tick forward.
     * Args:
     *   state: The current (previous) state.
     *   newState: The state after the current tick completes. This should be modified by
     *       this function however it will affect the new state.
     */
    step(state, newState) {
      const input = {};
      for (const w of this.inputs) {
       mergeSignals_(input, state[w] || {});
      }
      this.lastOutput = this.getOutput(input);
      for (const w of this.outputs) {
        newState[w] = newState[w] || {}
        mergeSignals_(newState[w], this.lastOutput);
      }
    }
    
    createElements(parent, cn) {
      const classList = ['combinator', this.cssClass()];
      this.thumbnail = utils.createHtmlElement(parent, 'div', classList.concat(['thumbnail']));
      this.thumbnail.style.left = 20 * this.xPos + '%';
      this.thumbnail.style.top = (COMBINATOR_HALF_HEIGHT * this.yPos) + 'px';
      this.detail = utils.createHtmlElement(parent, 'div', classList.concat(['detail']));
      this.initElements();
      this.thumbnail.onclick = () => {
        cn.setHiliteWires(this.inputs.concat(this.outputs));
      }
    }
    
    cssClass() { throw NotImplementedError(); }
    
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
    
    initElements() {}
    
    /** Parses an operand as a number or signal, returning the value. */
    opToNumber_(values, operand) {
      if (typeof operand == 'string') {
        return values[operand] || 0;
      } else {
        return operand;
      }
    }
  }
    
  const network = {};
  network.CircuitNetwork = CircuitNetwork;
  network.Combinator = Combinator
  return network;
})();

window.network = network;