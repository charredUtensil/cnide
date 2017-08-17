const blueprints = (function(){
  const blueprints = {};
  
  // The size of a square within which all combinators can
  // connect to each other without poles.
  const CLIQUE_SIZE = 5;
  const POLE_DISTANCE = 8;
  const WIRE_INSET = 20;
  const COLORS = ['red', 'green']
  const RED = 0;
  const GREEN = 1;
  
  class BlueprintError extends Error {
    
  }
  
  class WireConnection {
    constructor(node, wire, hOffset) {
      this.node = node;
      this.wire = wire;
      this.hOffset = hOffset;
    }
  }
  
  const connections_ = function(node) {
    const results = [];
    if (node.inputs) {
      for (wire of node.inputs) {
        results.push(new WireConnection(node, wire, 0));
      }
    }
    if (node.outputs) {
      for (wire of node.outputs) {
        results.push(new WireConnection(node, wire, 1));
      }
    }
    return results;
  }
  
  class WireSegment {
    constructor(color, from, to) {
      this.color = color;
      this.from = from;
      this.to = to;
    }
  }
  
  class SameColorWires_ {
    constructor(items) {
      this.set = new Set(items);
      this.opposite = null;
    }
  }
  
  /**
   * Computes colors for all wires
   * N.B. A better algorithm would be to collect all pairs, construct a graph,
   * and produce the bipartite halves. However, this would give a less helpful syntax error.
   */
  class WireColorCalculator_ {
    constructor() {
      // SameColorWires keyed by their member wires
      this.scs_ = {};
      this.addOppositePair_('.red', '.green');
    }
    
    add(wires) {
      switch (wires.length) {
        case 0: return;
        case 1:
          this.addSingleWire_(wires[0]);
          return;
        case 2:
          this.addOppositePair_(...wires);
          return;
        default:
          throw new BlueprintError('invalid args');
      }
    }
    
    forceRed(wire) {
      this.addOppositePair_(wire, '.green');
    }
    
    forceGreen(wire) {
      this.addOppositePair_(wire, '.red');
    }
    
    /**
     * Returns a map of wire names to 'red' or 'green'.
     * Red is always preferred over green.
     */
    getColors() {
      const wire_colors = {};
      for(const i of ['.red'].concat(Object.keys(this.scs_))) {
        if (!wire_colors[i]) {
          for (const j of this.scs_[i].set.keys()) {
            wire_colors[j] = RED; 
          }
          for (const j of this.scs_[i].opposite.set.keys()) {
            wire_colors[j] = GREEN; 
          }
        }
      }
      delete wire_colors['.red'];
      delete wire_colors['.green'];
      return wire_colors;
    }
    
    addSingleWire_(wire) {
      if (!this.scs_[wire]) {
        this.scs_[wire] = new SameColorWires_([wire]);
        this.scs_[wire].opposite = new SameColorWires_([]);
      }
    }
    
    addOppositePair_(a, b) {
      this.addSingleWire_(a);
      this.addSingleWire_(b);
      
      this.merge_(this.scs_[a], this.scs_[b].opposite);
      this.scs_[b].opposite = this.scs_[a];
      this.merge_(this.scs_[b], this.scs_[a].opposite);
      this.scs_[a].opposite = this.scs_[b];
    }
    
    /**
     * Turns two scs into one sc.
     */
    merge_(sc1, sc2) {
      if (sc1 == sc2) { return; }
      if (sc1.set.size < sc2.set.size) {
        this.reallyMerge_(sc2, sc1);
      } else {
        this.reallyMerge_(sc1, sc2);
      }
    }
    
    reallyMerge_(sc1, sc2) {
      for (const w of sc2.set.keys()) {
        if (sc1.opposite.set.has(w)) {
          throw new BlueprintError('Can\'t merge wires');
        }
        sc1.set.add(w);
        this.scs_[w] = sc1;
      }
    }
  }
  
  const extractNodes_ = function(cn) {
    const nodes = [];
    for (child of cn.children) {
      if (child instanceof network.CircuitNetwork) {
        nodes.push(...extractNodes(child));
      } else {
        nodes.push(child);
      }
    }
    return nodes;
  }
  
  class Blueprint extends utils.Renderable {
    constructor() {
      super();
      
      // positions will change as poles are inserted, but
      // will be stable up to the point the wires have
      // been added.
      this.positions_ = [];
      // This will contain WireSegment objects for the individual
      // connections.
      this.wireSegments_ = [];
      this.onresize_ = null;
    }
    
    destroy() {
      if (this.onresize_) {
        window.removeEventListener("resize", this.onresize);
      }
    }
    
    hDistance_(index, connection, nextConnection) {
      const nextI = this.positions_.indexOf(nextConnection.node, index);
      return (Math.floor(nextI / CLIQUE_SIZE) + nextConnection.hOffset) -
          (Math.floor(index / CLIQUE_SIZE) + connection.hOffset);
    }
    
    parseNetwork(cn) {
      const start = this.positions_.length;
      // wires will contain a map of wire names to lists
      // of the index of the node in positions, for any wires
      // whose segments haven't been placed yet
      const wires = {};
      const colorCalculator = new WireColorCalculator_();
      for (const node of extractNodes_(cn)) {
        this.positions_.push(node);
        if (node.inputs) { colorCalculator.add(node.inputs) };
        if (node.outputs) { colorCalculator.add(node.outputs) };
        for (const conn of connections_(node)) {
          wires[conn.wire] = wires[conn.wire] || []
          wires[conn.wire].push(conn);
        }
      }
      const colors = colorCalculator.getColors();
      for (let i = start; i < this.positions_.length; i++) {
        const node = this.positions_[i];
        let needPole = false;
        for (const conn of connections_(node)) {
          wires[conn.wire].shift();
          const nextConnection = wires[conn.wire][0];
          if (!nextConnection) { continue; }
          if (this.hDistance_(i, conn, nextConnection) > CLIQUE_SIZE) {
            // The next node may be too far to connect, so add a pole.
            needPole = true;
          } else {
            // Can't connect the node yet. It might be bumped by another
            // wire adding a pole.
          }
        }
        if (needPole) {
          const pole = new network.Pole();
          // First insert the pole into the overall positions obj
          // The pole is inserted so there are no gaps in coverage, so the
          // next node (that the current one can't reach) is either reachable
          // by this next pole or it's even further away.
          const poleIndex = i + CLIQUE_SIZE *
              (node instanceof network.Pole ? POLE_DISTANCE : CLIQUE_SIZE);
          for (let j = this.positions_.length; j < poleIndex; j++) {
            this.positions_[j] = new network.Label('');
          }
          this.positions_.splice(poleIndex, 0, pole);
          for (const conn of connections_(node)) {
            // Link the node to the pole.
            this.wireSegments_.push(
                new WireSegment(conn.wire, conn.node, pole));
            // Next insert the pole connections into all the wire queues at
            // their correct positions.
            let indexInQueue = 0;
            if (wires[conn.wire][0]) {
              for (let j = i; j < this.poleIndex; j++) {
                if (this.positions_[j] == wires[conn.wire][indexInQueue]) {
                  indexInQueue++;
                }
              }
            }
            wires[conn.wire].splice(indexInQueue, 0, new WireConnection(
                pole, conn.wire, conn.hOffset));
          }
        }
        for (const conn of connections_(node)) {
          const nextConnection = wires[conn.wire][0];
          if (!nextConnection) { continue; }
          if (this.hDistance_(i, conn, nextConnection) <= CLIQUE_SIZE) {
            const ws = new WireSegment(colors[conn.wire], conn, nextConnection);
            this.wireSegments_.push(ws);
          }
        }     
      }
    }
    
    initElement(root) {
      root.classList.add('blueprint-wrapper');
      this.grid = utils.createHtmlElement(root, 'div', ['blueprint-grid']);
      let tr = null;
      for (let i = 0; i < this.positions_.length; i++) {
        if (i % CLIQUE_SIZE == 0) {
          tr = utils.createHtmlElement(this.grid, 'div', ['row']);
        }
        this.positions_[i].getDomElement(tr);
      }
      this.onresize_ = () => this.updateSvg_(root);
      window.addEventListener("resize", this.onresize_);
      this.updateSvg_(root);
    }
    
    updateSvg_(root) {
      if (this.svg) {
        this.svg.remove();
      }
      if (!this.wireSegments_) {
        return;
      }
      this.svg = createSvgElement_(root, 'svg');
      this.svg.classList.add('blueprint-overlay');
      const rect = this.grid.getBoundingClientRect();
      this.svg.setAttribute('width', rect.width);
      this.svg.setAttribute('height', rect.height);
      for (const segment of this.wireSegments_) {
        const fromRect = segment.from.node.getDomElement().getBoundingClientRect();
        const toRect = segment.to.node.getDomElement().getBoundingClientRect();
        const arc = createSvgElement_(this.svg, 'path');
        const x1 = [fromRect.left + WIRE_INSET,
                    fromRect.right - WIRE_INSET][segment.color] - rect.left;
        const x2 = [toRect.left + WIRE_INSET,
                    toRect.right - WIRE_INSET][segment.color] - rect.left;
        const y1 = [fromRect.top + WIRE_INSET,
                    fromRect.bottom - WIRE_INSET][segment.from.hOffset] - rect.top;
        const y2 = [toRect.top + WIRE_INSET,
                    toRect.bottom - WIRE_INSET][segment.to.hOffset] - rect.top;
        const dist = Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
        const direction = x1 < x2 ? 0 : 1;
        arc.setAttribute('d', ['M', x1, y1, 'A', dist, dist, 0, 0, direction, x2, y2].join(' '));
        arc.setAttribute('fill', 'none');
        arc.setAttribute('stroke-width', 2);
        arc.setAttribute('stroke', COLORS[segment.color]);
      }
    }
  }
  
  const createSvgElement_ = function(root, tag) {
    const elem = document.createElementNS('http://www.w3.org/2000/svg', tag);
    root.appendChild(elem);
    return elem;
  }
  
  const exportString = function(cn) {
    const blueprint = new Blueprint()
    blueprint.parseNetwork(cn);
    return blueprint.exportString();
  }
  
  blueprints.BlueprintError = BlueprintError;
  blueprints.Blueprint = Blueprint;
  return blueprints;
})();