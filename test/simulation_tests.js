(function(){
  const assertStateEquals = function(expected, actual) {
    const message = ["Expected %o but was %o", expected, actual];
    const wires = Object.keys(expected);
    testUtils.assert(wires.length == Object.keys(actual).length, ...message);
    for (const wire of wires) {
      testUtils.assert(wire in actual, ...message);
      const signals = Object.keys(expected[wire]);
      testUtils.assert(signals.length == Object.keys(actual[wire]).length, ...message);
      for (const signal of signals) {
        testUtils.assert(expected[wire][signal] === actual[wire][signal], ...message);
      }
    }
  }

  const simulateAndAssertTests = function(code, ticks, expectedState) {
    const simulatedNetwork = parser.parse(code);
    simulatedNetwork.getDomElement(document.createElement('div'));
    for (let i = 0; i < ticks; i++) {
      simulatedNetwork.step();
    }
    assertStateEquals(expectedState, simulatedNetwork.state);
  }

  // Basic tests
  TESTS.simulate_noop = () => simulateAndAssertTests('Main(){}', 1, {});
  TESTS.simulate_constant = () => simulateAndAssertTests(
      'Main(){ {signal: 1} -> WIRE }', 1,
      { 'WIRE': { 'signal': 1 } });
    
  const testSingleCombinator = function(combinator, expectedOutputSignals) {
    simulateAndAssertTests(
        'Main(){ {b:13,a:4,c:612} -> IN IN -> ' + combinator + ' -> OUT }', 2,
        { 'IN': { 'a': 4, 'b': 13, 'c': 612 },
          'OUT': expectedOutputSignals });
  }

  TESTS.simulate_addition = () => testSingleCombinator('a + b as x', { 'x': 17 });
  TESTS.simulate_multiplication = () => testSingleCombinator('a * b as x', { 'x': 52 });

  // Special Signal Each
  TESTS.simulate_eachAsEach = () => testSingleCombinator(
      'each + 10 as each', { 'a': 14, 'b': 23, 'c': 622 });
  TESTS.simulate_eachAsSignal = () => testSingleCombinator(
      'each + 10 as x', { 'x': 4+10 + 13+10 + 612+10 });
  TESTS.simulate_eachThenEach = () => testSingleCombinator(
      'each > 10 then each', { 'b': 13, 'c': 612 });
  TESTS.simulate_eachThen1AsEach = () => testSingleCombinator(
      'each > 10 then 1 as each', { 'b': 1, 'c': 1 });
  TESTS.simulate_eachThenSignal = () => testSingleCombinator(
      'each > 10 then x', { 'x': 13 + 612 });
  TESTS.simulate_eachThen1AsSignal = () => testSingleCombinator(
      'each > 10 then 1 as x', { 'x': 2 });
  
  // Special Signal All
  TESTS.simulate_allThen1AsSignal_noneTrue = () => testSingleCombinator(
      'all > 0 then 1 as x', { 'x': 1 });
  TESTS.simulate_allThen1AsSignal_someTrue = () => testSingleCombinator(
      'all > 10 then 1 as x', { });
  TESTS.simulate_allThen1AsSignal_noneTrue = () => testSingleCombinator(
      'all > 700 then 1 as x', { });
  TESTS.simulate_signalThenAll = () => testSingleCombinator(
      'a > 0 then all', { 'a': 4, 'b': 13, 'c': 612 });
  TESTS.simulate_signalThen1AsAll = () => testSingleCombinator(
      'a > 0 then 1 as all', { 'a': 1, 'b': 1, 'c': 1 });
  TESTS.simulate_everythingThenEverything = () => testSingleCombinator(
      'everything > 0 then everything', { 'a': 4, 'b': 13, 'c': 612 });
      
  // Special Signal Any
  TESTS.simulate_anyThen1AsSignal_noneTrue = () => testSingleCombinator(
      'any > 0 then 1 as x', { 'x': 1 });
  TESTS.simulate_anyThen1AsSignal_someTrue = () => testSingleCombinator(
      'any > 10 then 1 as x', { 'x': 1 });
  TESTS.simulate_anyThen1AsSignal_noneTrue = () => testSingleCombinator(
      'any > 700 then 1 as x', { });
  TESTS.simulate_anythingThenEverything = () => testSingleCombinator(
      'anything > 600 then everything', { 'a': 4, 'b': 13, 'c': 612 });

  // Overflow / Underflow
  TESTS.simulate_outputOverflow = () => simulateAndAssertTests(
      'Main(){ {signal: 9999999999999} -> WIRE }', 1,
      { 'WIRE': { 'signal': 2147483647 } });
  TESTS.simulate_outputUnderflow = () => simulateAndAssertTests(
      'Main(){ {signal: -9999999999999} -> WIRE }', 1,
      { 'WIRE': { 'signal': -2147483647 } });
  TESTS.simulate_inputOverflow = () => simulateAndAssertTests(
      'Main(){ {signal: 2000000000} -> (A, B) (A, B) -> signal / 2 as signal -> OUT }', 2,
      { 'A': { 'signal': 2000000000 },
        'B': { 'signal': 2000000000 },
        'OUT': { 'signal': 1073741823 } });

  // Sub-networks
  TESTS.simulate_subnetwork_bindsWires = () => simulateAndAssertTests(
    `Main() {
      {a:42} -> ALPHA
      Sub(IN=ALPHA, OUT=OMEGA)
    }
    
    Sub(IN, OUT) {
      IN -> a / 2 as b -> OUT
    }`,
    2, { 'ALPHA': {'a': 42}, 'OMEGA': {'b': 21} });
  TESTS.simulate_subnetwork_maintainsInternalState = () => simulateAndAssertTests(
    `Main() {
      {a:42} -> ALPHA
      Sub(IN=ALPHA, OUT=OMEGA)
    }
    
    Sub(IN, OUT) {
      IN -> a / 2 as b -> INTERNAL
      INTERNAL -> b * 4 as c -> OUT
    }`,
    3, { 'ALPHA': {'a': 42}, 'OMEGA': {'c': 84}, 'Sub.1.INTERNAL': {'b': 21} });
  TESTS.simulate_subnetwork_oneWire = () => simulateAndAssertTests(
    `Main() {
      {a:42} -> ALPHA
      Sub(PARAM=ALPHA)
    }
    
    Sub(PARAM) {
      PARAM -> a / 2 as b -> PARAM
    }`,
    2, { 'ALPHA': {'a': 42, 'b': 21} });
  TESTS.simulate_subnetwork_substitutesSignals = () => simulateAndAssertTests(
    `Main() {
      {a:42} -> ALPHA
      Sub(IN=ALPHA, OUT=OMEGA, input_signal=a, output_signal=b)
    }
    
    Sub(IN, OUT, input_signal, output_signal) {
      IN -> input_signal / 2 as output_signal -> OUT
    }`,
    2, { 'ALPHA': {'a': 42}, 'OMEGA': {'b': 21} });
  TESTS.simulate_subnetwork_substitutesSignals_inConstant = () => simulateAndAssertTests(
    `Main() {
      Sub(OUT=OMEGA, param=x)
    }
    
    Sub(OUT, param) {
      {param: 42} -> OUT
    }`,
    1, { 'OMEGA': {'x': 42} });
})();
