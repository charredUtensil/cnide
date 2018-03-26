network.segmenting = (function(){
  /**
   * The size of a square within which all combinators can connect to each other without
   * poles.
   */
  const CLIQUE_SIZE = 5;
  
  /** The max distance between poles. */
  const POLE_DISTANCE = 8;
  
  const WIRE_INSET = 20;
  
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
  
  /**
   * Computes colors for all wires.
   * N.B. A better algorithm would be to collect all pairs, construct a graph,
   * and produce the bipartite halves. However, this would give a less helpful syntax
   * error. This will produce the error as soon as the problem is found.
   */
  class WireColorCalculator {
    constructor() {
      this.groups_ = {};
      this.opposites_ = {};
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
      for(const i of ['.red'].concat(Object.keys(this.groups_))) {
        if (!wire_colors[i]) {
          for (const j of this.groups_[i].keys()) {
            if (wire_colors[j]) {
              throw new Error('Wire sets not deduped properly');
            }
            wire_colors[j] = 'red'; 
          }
          const o = this.groups_[this.opposites_[i]];
          if (o) {
            for (const j of o.keys()) {
              if (wire_colors[j]) {
                throw new Error('Wire sets not deduped properly');
              }
              wire_colors[j] = 'green'; 
            }
          }
        }
      }
      delete wire_colors['.red'];
      delete wire_colors['.green'];
      return wire_colors;
    }
    
    addSingleWire_(wire) {
      if (!this.groups_[wire]) {
        this.groups_[wire] = new Set([wire]);
      }
    }
    
    addOppositePair_(a, b) {
      this.addSingleWire_(a);
      this.addSingleWire_(b);
      
      try {
        this.merge_(a, this.opposites_[b]);
        this.merge_(b, this.opposites_[a]);
        this.opposites_[b] = a;
        this.opposites_[a] = b;
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
     * Moves everything from the group w1 is in to the group w2 is in.
     */
    merge_(w1, w2) {
      if (!w1 || !w2) {
        return;
      }
      const g1 = this.groups_[w1];
      const g2 = this.groups_[w2];
      if (g1 == g2) {
        return;
      }
      for (const w of g1.keys()) {
        if (this.groups_[this.opposites_[w]] == g2) {
          throw new SegmentingError('Can\'t merge');
        }
        g2.add(w);
        this.groups_[w] = g2;
      }
    }
  }
  
  /** A renderable representation of all wire segments in a circuit network. */
  class Segmenter_ {
    constructor() {
      this.hasParsed = false;
      // positions will change as poles are inserted, but
      // will be stable up to the point the wires have
      // been added.
      this.positions_ = [];
      // This will contain WireSegment objects for the individual
      // connections.
      this.wireSegments = [];
      // wires will contain a map of wire names to lists
      // of combinators using that wire.
      this.wires = {};
      this.wireIndexes = {};
    }
    
    hDistance_(index, connection, nextConnection) {
      const nextI = this.positions_.indexOf(nextConnection.combinator, index);
      return (Math.floor(nextI / CLIQUE_SIZE) * 2 + nextConnection.hOffset) -
          (Math.floor(index / CLIQUE_SIZE) * 2 + connection.hOffset);
    }
    
    needsPole_(previous, current) {
      if (!previous) { return false; }
      for (const conn of getConnections_(previous)) {
        const wi = this.wireIndexes[conn.wire];
        if (wi == 0) { continue; } // Ignore the first combinator.
        const w = this.wires[conn.wire];
        if (!w[wi] || w[wi].combinator == current || w[wi - 1].combinator != previous) {
          continue;
        }
        // At this point, we are certain that previous is a combinator
        // which came the max distance before this and has at least one connection to
        // a combinator after this point. Therefore, a pole is needed.
        return true;
      }
      return false;
    }
    
    parseNetwork(cn, colors) {
      if (this.hasParsed) {
        throw new Error("This segmenter has already parsed a network.");
      }
      this.hasParsed = true;
      for (const combinator of cn.children) {
        this.positions_.push(combinator);
        for (const conn of getConnections_(combinator)) {
          this.wires[conn.wire] = this.wires[conn.wire] || [];
          this.wireIndexes[conn.wire] = 0;
          this.wires[conn.wire].push(conn);
        }
      }
      
      let recentPoles = [];
      // TODO: Could probably resolve this as above
      let recentPolesWires = new Set();
      for (let i = 0; i < this.positions_.length; i++) {
        // Start by looking at the combinators that are about to go out of range and add
        // a pole to extend their range. There is probably a better algorithm for this,
        // but I haven't found one that isn't unreasonably buggy.
        const previous = this.positions_[i - CLIQUE_SIZE * Math.floor(CLIQUE_SIZE / 2)];
        if (recentPoles[0] && previous == recentPoles[0]) {
          // We are too far away from the previous pole to use it any more.
          recentPoles.shift();
          recentPolesWires = new Set(
              recentPoles
                  .reduce((r, p) => r.concat(p.inputs)
                  .concat(p.outputs), []))
        }
        if (this.needsPole_(previous, this.positions_[i])) {
          if (recentPoles.length > CLIQUE_SIZE * CLIQUE_SIZE / 2) {
            // Infinite loop detected.
            throw new SegmentingError('The network is too complex. Try moving relevant combinators closer together.');
          }
          let poleWires = (
              Array.from(new Set(previous.inputs.concat(previous.outputs)))
                  .filter(w => this.wireIndexes[w] < this.wires[w].length)
                  .filter(w => !recentPolesWires.has(w)));
          for (let ri = 0; ri <  recentPoles.length; ri++) {
            const rPole = recentPoles[ri];
            const pw = new Set(poleWires.concat(rPole.inputs).concat(rPole.outputs));
            if (pw.size > 4) { continue; }
            const reds = Array.from(pw).reduce(
                (r, w) => colors[w] == 'red' ? r + 1 : r, 0);
            if (reds > 2 || (pw.size - reds) > 2) { continue; }
            recentPoles.splice(ri, 1);
            poleWires = Array.from(pw);
            ri--;
          }
          poleWires = poleWires.sort();
          for (const w of poleWires) {
            recentPolesWires.add(w);
          }
          poleWires = [
              poleWires.filter(w => colors[w] == 'red'),
              poleWires.filter(w => colors[w] == 'green')];
          // put that into the pole
          
          const pole = new network.combinators.Pole(
              poleWires.map(p => p[0]).filter(w => !!w),
              poleWires.map(p => p[1]).filter(w => !!w));
          cn.add(pole);
          this.positions_.splice(i, 0, pole);
          for (const conn of getConnections_(pole)) {
            const wi = this.wireIndexes[conn.wire];
            this.wires[conn.wire].splice(wi, 0, conn);
          }
          recentPoles.push(pole);
        }
        
        // The combinator is in the correct place. Add its segments to the segment list.
        const combinator = this.positions_[i];
        combinator.rtl = Math.floor(i / CLIQUE_SIZE) % 2 != 0;
        combinator.xPos =
            combinator.rtl ?
            CLIQUE_SIZE - (i % CLIQUE_SIZE) - 1 :
            i % CLIQUE_SIZE;
        combinator.yPos = Math.floor(i / CLIQUE_SIZE) * 2;
        
        // The direction of the next combinator in the list:
        // 0 for down, 1 for right, and -1 to left
        //combinator.nextDir = i % CLIQUE_SIZE == 0 ? 0 : rtl ? -1 : 1;
        
        for (const conn of getConnections_(combinator)) {
          const wi = this.wireIndexes[conn.wire]++;
          if (wi == 0) { continue; } // Ignore the first combinator in the wire.
          const w = this.wires[conn.wire];
          if (w[wi].combinator != combinator) {
            throw new Error('Array for ' + conn.wire + ' is in the wrong order');
          }
          this.wireSegments.push(new WireSegment(colors[conn.wire], w[wi - 1], conn));
        }
      }
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