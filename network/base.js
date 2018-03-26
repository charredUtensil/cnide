const network = (function(){
  const COMBINATOR_HALF_HEIGHT = 96 / 2;
  
  const INSET_X = 20;
  const INSET_Y = 10;
  const WIRES_OFFSET = 5;
  
  const hiliteColor_ = function(index) {
    switch (index) {
      case  1: return '#f00';
      case  2: return '#e50';
      case -1: return '#0c0';
      case -2: return '#0b4';
      default: return '#444';
    }
  }
  
  /**
   * Modifies the "to" object to add every value for every key from the "from" object.
   * This essentially "merges" two wire values together to form the final result.
   * Keys with a value of 0 are removed. Integers over 32 bits are truncated.
   */
  const mergeSignals_ = function(to, from) {
    for (const k of Object.keys(from)) {
      const result = ((to[k] || 0) + from[k]) & 0xffffffff;
      if (result) {
        to[k] = result;
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
      this.hiliteWires = {};
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
      const detailWrapper = utils.createHtmlElement(root, 'div', ['detail-wrapper']);
      let yMax = 0;
      for (const c of this.children) {
        c.createElements(this.networkElement, detailWrapper, this);
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
    
    setSelected(combinator, wires) {
      if (this.selected) {
        this.selected.thumbnail.classList.remove('selected');
        this.selected.detail.classList.remove('selected');
      }
      this.selected = combinator;
      if (combinator) {
        this.selected.thumbnail.classList.add('selected');
        this.selected.detail.classList.add('selected');
      }
      
      wires = Array.from(new Set(wires)).sort();
      
      this.hiliteWires = {};
      const colorsUsed = new Set();
      for (let i = 0; i < wires.length; i++) {
        const wire = wires[i];
        const color = this.colors[wire];
        if (colorsUsed.has(color)) {
          this.hiliteWires[wire] = {red: 2, green: -2}[color];
        } else {
          colorsUsed.add(color);
          this.hiliteWires[wire] = {red: 1, green: -1}[color];
        }
      }
      
      this.updateSegmentOverlay_();
      this.updateStateElem_();
    }
    
    drawOverallPath_(svg, combinatorWidth, totalHeight) {
      const path = createSvgElement_(svg, 'path');
      const x1 = combinatorWidth / 2;
      const x2 = x1 * (network.segmenting.CLIQUE_SIZE * 2 - 1);
      const d = ['M', x1, COMBINATOR_HALF_HEIGHT];
      let y = COMBINATOR_HALF_HEIGHT;
      let rtl = false;
      for (; y < totalHeight; y += COMBINATOR_HALF_HEIGHT * 2) {
        d.push('L' + (rtl ? x2 : x1) + ',' + y);
        d.push('L' + (rtl ? x1 : x2) + ',' + y);
        rtl = !rtl;
      }
      path.setAttribute('d', d.join(' '));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-width', 20);
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke', '#333');
      for (c of [{x: x1, y: COMBINATOR_HALF_HEIGHT},
                 {x: (rtl ? x2 : x1), y: y - COMBINATOR_HALF_HEIGHT * 2}]) {
        const circle = createSvgElement_(svg, 'circle');
        circle.setAttribute('cx', c.x);
        circle.setAttribute('cy', c.y);
        circle.setAttribute('r', 18);
        circle.setAttribute('fill', '#333');
      }
    }
    
    updateSegmentOverlay_() {
      if (this.segmentUnderlay) {
        this.segmentUnderlay.remove();
      }
      if (this.segmentOverlay) {
        this.segmentOverlay.remove();
      }
      if (!this.segments) {
        return;
      }
      this.segmentUnderlay = createSvgElement_(this.networkElement, 'svg');
      this.segmentUnderlay.classList.add('underlay');
      this.segmentOverlay = createSvgElement_(this.networkElement, 'svg');
      this.segmentOverlay.classList.add('overlay');
      const rect = this.networkElement.getBoundingClientRect();
      const combinatorWidth = rect.width / network.segmenting.CLIQUE_SIZE;
      for (const svg of [this.segmentUnderlay, this.segmentOverlay]) {
        svg.classList.add('segments');
        svg.setAttribute('width', rect.width);
        svg.setAttribute('height', this.networkElement.scrollHeight);
      }
      this.drawOverallPath_(
          this.segmentUnderlay, combinatorWidth, this.networkElement.scrollHeight);
      const activeWires = Object.keys(this.hiliteWires).sort();
      const activeConnections = {};
      
      // The 'd' attributes for each path, indexed by hiliteIndex
      const pathDs = {};
      
      for (const segment of this.segments) {
        const hiliteIndex = this.hiliteWires[segment.from.wire] || 0;
        
        const xOffset = connXOffset_(combinatorWidth, hiliteIndex);
        
        const x1 = segment.from.combinator.xPos * combinatorWidth + xOffset;
        const x2 = segment.to.combinator.xPos * combinatorWidth + xOffset;
        const y1 = connYPos_(segment.from, hiliteIndex);
        const y2 = connYPos_(segment.to, hiliteIndex);
        
        const d = pathDs[hiliteIndex] || (pathDs[hiliteIndex] = [])
        d.push('M', x1, y1);
        // Elbowing logic: harder than it seems to detangle one line. :/
        if (Math.abs(x1 - x2) > 1 && Math.abs(y1 - y2) > 1) {
          // Need an elbow since this isn't screen-perpendicular.
          if (segment.to.combinator.rtl == (x1 < x2)) {
            // Down, then across would cross the 'to' row the wrong way.
            if (segment.from.combinator.rtl == (x1 < x2)) {
              // Across, then down would also cross the 'from' row the wrong way.
              // We need two elbows at a row going the right way.
              const yMd = y1 + COMBINATOR_HALF_HEIGHT * 2;
              d.push('L' + x1 + ',' + yMd, 'L' + x2 + ',' + yMd);
            } else {
              d.push('L' + x2 + ',' + y1);
            }
          } else if (y1 > y2) {
            // This segment is within the same line, and it's going up.
            // Can't cross at either 'from' or 'to' since this could overlap.
            const xMd =
                (Math.abs(x1 - x2) > combinatorWidth * 1.5) ?
                // There's at least one combinator between the two, so cross there.
                x1 + (segment.to.combinator.rtl ? -combinatorWidth : combinatorWidth) :
                // No space, so use the tiny space between the two.
                (Math.floor(x1 / combinatorWidth) + (segment.to.combinator.rtl ? 0 : 1)) * combinatorWidth - hiliteIndex * WIRES_OFFSET;
            d.push('L' + xMd + ',' + y1, 'L' + xMd + ',' + y2);
          } else {
            d.push('L' + x1 + ',' + y2);
          }
        }
        d.push('L' + x2 + ',' + y2);
        if (hiliteIndex) {
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
      for (const k of Object.keys(pathDs)) {   
        const hiliteIndex = parseInt(k);
        const path = createSvgElement_(
            hiliteIndex ? this.segmentOverlay : this.segmentUnderlay, 'path');
        path.setAttribute('d', pathDs[hiliteIndex].join(' '));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-width', 5);
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('stroke', hiliteColor_(hiliteIndex));
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
      utils.createHtmlElement(this.stateElem, 'div', ['tick'], 'Tick #' + this.tick);
      const wires = new Set(Object.keys(this.state).concat(Object.keys(this.hiliteWires)));
      for (const wire of Array.from(wires).sort()) {
        if (Object.keys(this.state[wire] || {}).length == 0 &&
            !(this.hiliteWires[wire])) {
          continue;
        }
        const wireElem =
            utils.createHtmlElement(this.stateElem, 'div', ['wire', this.colors[wire]]);
        if (this.hiliteWires[wire]) {
          wireElem.style.color = hiliteColor_(this.hiliteWires[wire]);
        }
        wireElem.onclick = () => {
          this.setSelected(null, [wire]);
        }
        utils.createHtmlElement(wireElem, 'div', ['name'], wire);
        if (this.state[wire]) {
          const signalTable =
              utils.createHtmlElement(wireElem, 'table', ['signal-table']);
          for (const k of Object.keys(this.state[wire]).sort()) {
            const tr = utils.createHtmlElement(signalTable, 'tr', []);
            utils.createHtmlElement(tr, 'td', ['signal'], k);
            utils.createHtmlElement(tr, 'td', ['value'], this.state[wire][k]);
          }
        }
      }
    }
  }
   
  const createSvgElement_ = function(root, tag) {
    const elem = document.createElementNS('http://www.w3.org/2000/svg', tag);
    root.appendChild(elem);
    return elem;
  }
  
  const connXOffset_ = function(combinatorWidth, hiliteIndex) {
    return hiliteIndex ?
        // Highlighted wires: negative means start from the right.
        (hiliteIndex > 0 ?
         (hiliteIndex - 1) * WIRES_OFFSET + INSET_X :
         (hiliteIndex + 1) * WIRES_OFFSET - INSET_X + combinatorWidth):
        // Non-highlighted wires: just go from center
        combinatorWidth / 2;
  }
  
  const connYPos_ = function(conn, hiliteIndex) {
    const origin = (conn.combinator.yPos + 1) * COMBINATOR_HALF_HEIGHT;
    if (!hiliteIndex) {
      return origin + (conn.hOffset ? WIRES_OFFSET : -WIRES_OFFSET);
    }
    const offset =
        INSET_Y - COMBINATOR_HALF_HEIGHT +
        (((hiliteIndex + 5) % 5) - 1) * WIRES_OFFSET;
    return origin + (conn.hOffset ? -offset : offset);
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
    
    createElements(thumbParent, detailParent, cn) {
      const classList = ['combinator', this.cssClass()];
      this.thumbnail =
          utils.createHtmlElement(thumbParent, 'div', classList.concat(['thumbnail']));
      this.thumbnail.style.left = 20 * this.xPos + '%';
      this.thumbnail.style.top = (COMBINATOR_HALF_HEIGHT * this.yPos) + 'px';
      this.detail =
          utils.createHtmlElement(detailParent, 'div', classList.concat(['detail']));
      this.initElements();
      this.thumbnail.onclick = () => {
        cn.setSelected(this, this.inputs.concat(this.outputs));
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