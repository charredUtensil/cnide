const TESTS = {};

const testUtils = (function() {
  const assert = function(state, message) {
    if (!state) {
      throw message;
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
        if (Array.isArray(e)) {
          console.log(...e);
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