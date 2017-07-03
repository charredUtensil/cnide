const TESTS = {};

const testUtils = (function() {
  class AssertionError extends Error {
    constructor(args) {
      super(args.shift());
      this.args = args;
    }
    
    log() {
      console.log(this.message, ...this.args);
    }
  }
  
  const assert = function(state, ...args) {
    if (!state) {
      throw new AssertionError(args);
    }
  }

  const runAllTests = function() {
    let passing = 0;
    let failing = 0;
    const table = utils.createHtmlElement(document.body, 'table');
    for (const test of Object.keys(TESTS)) {
      const tr = utils.createHtmlElement(table, 'tr');
      utils.createHtmlElement(tr, 'td', [], test);
      try {
        TESTS[test]();
        passing++;
        tr.classList.add('pass');
        utils.createHtmlElement(tr, 'td', [], 'PASSED');
      } catch (e) {
        failing++;
        tr.classList.add('fail');
        utils.createHtmlElement(tr, 'td', [], 'FAILED');
        console.error('%s FAILED', test);
        if (e.log) {
          e.log();
        } else {
          console.log(e);
        }
      }
    }
    const message = 'Tests finished. ' + passing + ' passed, ' + failing + ' failed.';
    utils.createHtmlElement(document.body, 'div', ['results'], message);
    console.log(message);
  }
  
  const testUtils = {};
  testUtils.assert = assert;
  testUtils.runAllTests = runAllTests;
  return testUtils;
})();