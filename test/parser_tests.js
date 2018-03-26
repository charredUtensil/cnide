(function(){
  const assertParses = function(code, statementCount) {
    const result = parser.parse(code);
    testUtils.assert(result.children.length == statementCount,
        'Expected %d statements but got %o', statementCount, result);
  }
  
  const assertNotParses = function(code) {
    try {
      const result = parser.parse(code);
      testUtils.assert(false, 'Expected Syntax Error but got %o', result);
    } catch (e) {
      if (e instanceof parser.SyntaxError) {
        return;
      } else {
        throw e;
      }
    }
  }
  
  const m = function(body) {
    return 'Main() {' + body + '}';
  }
  
  TESTS.parser_notParsesNothing = () => { assertNotParses(''); };
  TESTS.parser_parsesEmptyMain = () => { assertParses(m(''), 0); };
  
  TESTS.parser_parsesComments = () => { assertParses(m('// comment\n'), 0); };
  TESTS.parser_parsesCommentsOutsideMain = () => {
    assertParses('// comment\n' + m('') + '//comment', 0); };
  TESTS.parser_parsesCommentsTerminatedByNewline = () => {
    assertParses(m('// comment\n{x:1}->W'), 1); };
  TESTS.parser_parsesMultiLineComment = () => {
    assertParses(m('/* One\nTwo\nThree\n */'), 0); };
  TESTS.parser_parsesMultiLineCommentWithAsterisks = () => {
    assertParses(m('/** One\n * Two\n * Th*ee\n **/'), 0); };
  TESTS.parser_parsesMultiLineCommentAsWhitespace = () => {
    assertParses(m(
        '/* comment *//* comment */{x:/* comment */1/* comment */}\n' +
        '/* comment */->/* comment */W/* comment */'), 1); };
        
  TESTS.parser_notParsesUnsegmentable = () => {
    assertNotParses(m('(A, B) -> x + 0 as x -> (B, C)\n{x: 1} -> (A, C)')); };
    
  TESTS.parser_parsesConstant = () => { assertParses(m('{x: 9999} -> A'), 1); };
  TESTS.parser_notParsesOverflow = () => {
    assertNotParses(m('{x: 9999999999} -> A'), 1); };
})();