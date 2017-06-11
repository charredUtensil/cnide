const utils = (function(){
  const u = {};
  
  u.createHtmlElement = function(parent, tag, classList, text) {
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
  
  u.factorioHumanize = function(value) {
    const negate = value < 0;
    let v = negate ? -value : value;
    let suffixIndex = 0;
    while (v >= 1000) {
      v /= 1000;
      suffixIndex++;
    }
    return (negate ? '-' : '') + Math.floor(v) + ['', 'K', 'M', 'G'][suffixIndex]
  }
  
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
  u.Renderable = Renderable;
  
  return u;
})();