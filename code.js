(function(){
  const _createButton = function(parentElement, text, icon, onClick) {
    const elem = utils.createHtmlElement(parentElement, 'a', ['btn']);
    utils.createHtmlElement(elem, 'i', ['fa', 'fa-' + icon]);
    utils.createHtmlElement(elem, 'span', ['text'], text);
    elem.title = text;
    elem.onclick = onClick;
    return elem;
  }

  class Editor {
    constructor(parentElement) {
      this.wrapperElement = utils.createHtmlElement(parentElement, 'div', ['editing'])
      const menu = utils.createHtmlElement(this.wrapperElement, 'div', ['menu']);
      const edit = utils.createHtmlElement(menu, 'div', ['edit']);
      _createButton(edit, 'Run', 'play', () => this.compileAndRun());
      const run = utils.createHtmlElement(menu, 'div', ['run']);
      _createButton(run, 'Edit', 'code', () => this.returnToEditMode());
      _createButton(run, 'Pause', 'pause', () => this.emulator.pause());
      _createButton(run, 'Step', 'step-forward', () => this.emulator.step());
      _createButton(run, 'Slow', 'play', () => this.emulator.run(500));
      _createButton(run, 'Fast', 'forward', () => this.emulator.run(1000/60));
      const editorElement = utils.createHtmlElement(
          this.wrapperElement, 'div', ['editor']);
      this.textarea = utils.createHtmlElement(editorElement, 'textarea');
      this.textarea.value = localStorage.getItem('autosave') || '';
      this.emulator = null;
    }
    
    autosave() {
      localStorage.setItem('autosave', this.textarea.value);
    }
    
    compileAndRun() {
      this.autosave();
      if (this.emulator) { return; }
      try {
        this.emulator = new Emulator(
            this.textarea.value, this.wrapperElement);
        this.textarea.disabled = true;
        window.setTimeout(() => {
          this.wrapperElement.classList.remove('editing');
          this.wrapperElement.classList.add('running');
        }, 1);
      } catch (e) {
        if (e instanceof parser.SyntaxError) {
          alert('Syntax Error on line ' + e.location.start.line + ':\n' + e.message);
          this.textarea.setSelectionRange(e.location.start.offset, e.location.end.offset);
          this.textarea.blur();
          this.textarea.focus();
        } else {
          throw e;
        }
      }
    }
    
    returnToEditMode() {
      const emulator = this.emulator;
      if (!emulator) { return; }
      this.emulator = null;
      emulator.pause();
      window.setTimeout(() => emulator.remove(), 400);
      this.wrapperElement.classList.remove('running');
      this.wrapperElement.classList.add('editing');
      this.textarea.disabled = false;
    }
  }
  
  class Emulator {
    constructor(code, parentElement) {
      this.interval = 0;
      this.network = parser.parse(code);
      parentElement.appendChild(
        this.network.getDomElement(parentElement));
    };
  
    _step() {
      this.network.step();
    };
  
    pause() {
      if (this.interval) {
        window.clearInterval(this.interval);
        this.interval = 0;
      }
    };
  
    step() {
      this.pause();
      this._step();
    };
  
    run(millisPerTick) {
      this.pause();
      this.interval = window.setInterval(() => this._step(), millisPerTick);
    };
    
    remove() {
      this.pause();
      this.network.getDomElement(null).remove();
    };
  }
  
  window.Editor = Editor;
})();