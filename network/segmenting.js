network.segmenting = (function(){
  /**
   * The size of a square within which all combinators can connect to each other without
   * poles.
   */
  const CLIQUE_SIZE = 5;
  
  /** The distance between poles. */
  const POLE_DISTANCE = 8;
  
  const WIRE_INSET = 20;
  const SVG_COLORS = {red: 'red', green: 'green'}
  
  class SegmentingError extends Error {}
  
  /** A point where a wire is connected. */
  class WireConnection {
    constructor(combinator, wire, hOffset) {
      this.combinator = combinator;
      this.wire = wire;
      this.hOffset = hOffset;
    }
  }
  
  /** A wire between two connections. */
  class WireSegment {
    constructor(color, from, to) {
      this.color = color;
      this.from = from;
      this.to = to;
    }
    
    getColorAttr(active) {
      return SVG_COLORS[this.color];
    }
  }
  
  /** Returns an array of up to 4 WireConnections bound to this combinator. */
  const getConnections_ = function(combinator) {
    const results = [];
    if (combinator.inputs) {
      for (wire of combinator.inputs) {
        results.push(new WireConnection(combinator, wire, 0));
      }
    }
    if (combinator.outputs) {
      for (wire of combinator.outputs) {
        results.push(new WireConnection(combinator, wire, 1));
      }
    }
    return results;
  }
  
  /** A set of wires which are all the same color. */
  class SameColorWires_ {
    constructor(wires) {
      this.set = new Set(wires);
      this.opposite = null;
    }
  }
  
  /**
   * Computes colors for all wires.
   * N.B. A better algorithm would be to collect all pairs, construct a graph,
   * and produce the bipartite halves. However, this would give a less helpful syntax
   * error. This will produce the error as soon as the problem is found.
   */
  class WireColorCalculator {
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
          throw new SegmentingError('invalid args');
      }
    }
    
    forceColor(wire, color) {
      if (color == 'red') {
        this.addOppositePair_(wire, '.green');
      } else if (color == 'green') {
        this.addOppositePair_(wire, '.red');
      } else {
        throw new Error('Invalid color: "' + color + '"');
      }
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
            wire_colors[j] = 'red'; 
          }
          for (const j of this.scs_[i].opposite.set.keys()) {
            wire_colors[j] = 'green'; 
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
      
      try {
        this.merge_(this.scs_[a], this.scs_[b].opposite);
        this.scs_[b].opposite = this.scs_[a];
        this.merge_(this.scs_[b], this.scs_[a].opposite);
        this.scs_[a].opposite = this.scs_[b];
      } catch (e) {
        if (e instanceof SegmentingError) {
          throw new SegmentingError(
              'Wires ' + a + ' and ' + b + ' must be the same color and cannot be ' +
              'added to the same side of a combinator.');
        } else {
          throw e;
        }
      }
    }
    
    /**
     * Merges two SameColorWires into one SameColorWires.
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
          throw new SegmentingError('Can\'t merge');
        }
        sc1.set.add(w);
        this.scs_[w] = sc1;
      }
    }
  }
  
  /** A renderable representation of all wire segments in a circuit network. */
  class Segmenter_ {
    constructor() {
      // positions will change as poles are inserted, but
      // will be stable up to the point the wires have
      // been added.
      this.positions_ = [];
      // This will contain WireSegment objects for the individual
      // connections.
      this.wireSegments = [];
    }
    
    /*destroy() {
      if (this.onresize_) {
        window.removeEventListener('resize', this.onresize);
      }
    }*/
    
    hDistance_(index, connection, nextConnection) {
      const nextI = this.positions_.indexOf(nextConnection.combinator, index);
      return (Math.floor(nextI / CLIQUE_SIZE) + nextConnection.hOffset) -
          (Math.floor(index / CLIQUE_SIZE) + connection.hOffset);
    }
    
    parseNetwork(cn, colors) {
      this.positions_ = [];
      // wires will contain a map of wire names to lists
      // of the index of the combinator in positions, for any wires
      // whose segments haven't been placed yet.
      const wires = {};
      for (const combinator of cn.children) {
        this.positions_.push(combinator);
        for (const conn of getConnections_(combinator)) {
          wires[conn.wire] = wires[conn.wire] || [];
          wires[conn.wire].push(conn);
        }
      }
      for (let i = 0; i < this.positions_.length; i++) {
        const combinator = this.positions_[i];
        combinator.xPos = i % CLIQUE_SIZE;
        combinator.yPos = Math.floor(i / CLIQUE_SIZE) * 2;
        let needPole = false;
        for (const conn of getConnections_(combinator)) {
          wires[conn.wire].shift();
          const nextConnection = wires[conn.wire][0];
          if (!nextConnection) { continue; }
          if (this.hDistance_(i, conn, nextConnection) > CLIQUE_SIZE) {
            // The next combinator may be too far to connect, so add a pole.
            needPole = true;
          } else {
            // Can't connect the combinator yet. It might be bumped by another
            // wire adding a pole.
          }
        }
        if (needPole) {
          const pole = new network.combinators.Pole(combinator.inputs, combinator.outputs);
          cn.add(pole);
          // First insert the pole into the overall positions obj. The pole is inserted so
          // there are no gaps in coverage, so the next combinator (that the current one can't
          // reach) is within or past this pole's range.
          const poleIndex = i + CLIQUE_SIZE *
              (combinator instanceof network.combinators.Pole ? POLE_DISTANCE : CLIQUE_SIZE);
          for (let j = this.positions_.length; j < poleIndex; j++) {
            this.positions_[j] = new network.combinators.Label('');
          }
          this.positions_.splice(poleIndex, 0, pole);
          for (const conn of getConnections_(combinator)) {
            const poleConn = new WireConnection(pole, conn.wire, conn.hOffset);
            // Link the combinator to the pole.
            this.wireSegments.push(new WireSegment(colors[conn.wire], conn, poleConn));
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
            wires[conn.wire].splice(indexInQueue, 0, poleConn);
          }
        }
        for (const conn of getConnections_(combinator)) {
          const nextConnection = wires[conn.wire][0];
          if (!nextConnection) { continue; }
          if (this.hDistance_(i, conn, nextConnection) <= CLIQUE_SIZE) {
            const ws = new WireSegment(colors[conn.wire], conn, nextConnection);
            this.wireSegments.push(ws);
          }
        }     
      }
    }
    
    initElement(root) {
      root.classList.add('segment-wrapper');
      this.grid = utils.createHtmlElement(root, 'div', ['blueprint-grid']);
      let tr = null;
      for (let i = 0; i < this.positions_.length; i++) {
        if (i % CLIQUE_SIZE == 0) {
          tr = utils.createHtmlElement(this.grid, 'div', ['row']);
        }
        this.positions_[i].getDomElement(tr);
      }
      this.onresize_ = () => this.updateSvg_(root);
      window.addEventListener('resize', this.onresize_);
      this.updateSvg_(root);
    }
  }
   
  
  const getSegments = function(cn, colors) {
    const segmenter = new Segmenter_()
    segmenter.parseNetwork(cn, colors)
    return segmenter.wireSegments;
  }
  
  const segmenting = {};
  segmenting.CLIQUE_SIZE = CLIQUE_SIZE;
  segmenting.SegmentingError = SegmentingError;
  segmenting.WireConnection = WireConnection;
  segmenting.WireSegment = WireSegment;
  segmenting.WireColorCalculator = WireColorCalculator;
  segmenting.getSegments = getSegments;
  return segmenting;
})();