const utils = (function(){
  const utils = {};
  
  utils.createHtmlElement = function(parent, tag, classList, text) {
    const element = document.createElement(tag);
    if (classList) {
      for (c of classList){
        element.classList.add(c);
      }
    }
    if (typeof text != 'undefined') {
      element.appendChild(document.createTextNode(text));
    }
    if (parent) {
      parent.appendChild(element);
    }
    return element;
  }
  
  utils.factorioHumanize = function(value) {
    const negate = value < 0;
    let v = negate ? -value : value;
    let suffixIndex = 0;
    while (v >= 1000) {
      v /= 1000;
      suffixIndex++;
    }
    return (negate ? '-' : '') + Math.floor(v) + ['', 'K', 'M', 'G'][suffixIndex]
  }
  
  class NotImplementedError extends Error {}
  
  class Renderable {
    getDomElement(parent) {
      if (!this.element) {
      	const element = utils.createHtmlElement(parent, 'div', []);
        this.initElement(element);
        this.element = element;
      }
      return this.element;
    }
    
    initElement(element) {}
  }
  utils.Renderable = Renderable;
  
  return utils;
})();

window.onerror = function(msg, src, line, col, error) {
  document.body.classList.add('fatal');
  try {
    src = src.substring(src.indexof('cnide'));
  } catch (e) {}
  try {
    if (src && line) {
      msg = msg + ' [line ' + line + ', col ' + col + ' of ' + src + ']';
    }
  } catch (e) {}
  try {
    utils.createHtmlElement(
        document.body, 'div', ['fatal-error-message'], msg);
  } catch (e) {}
  return false;
}