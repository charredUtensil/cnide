(function(){
  class Editor {
    constructor(parentElement) {
      this.wrapperElement = utils.createHtmlElement(parentElement, 'div', ['editing'])
      const menu = utils.createHtmlElement(this.wrapperElement, 'div', ['menu']);
      utils.createHtmlElement(menu, 'a', ['edit', 'btn'], 'Run\u25B6').onclick =
          () => this.compileAndRun();
      utils.createHtmlElement(menu, 'a', ['run', 'btn'], 'Edit').onclick =
          () => this.returnToEditMode();
      utils.createHtmlElement(menu, 'a', ['run', 'btn'], '\u2759\u2759').onclick =
          () => this.emulator.pause();
      utils.createHtmlElement(menu, 'a', ['run', 'btn'], '\u2759\u25B6').onclick =
          () => this.emulator.step();
      utils.createHtmlElement(menu, 'a', ['run', 'btn'], '\u25B6').onclick =
          () => this.emulator.run(500);
      utils.createHtmlElement(menu, 'a', ['run', 'btn'], '\u25B6\u25B6').onclick =
          () => this.emulator.run(1000/60);
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
      try {
        this.emulator = new Emulator(
            this.textarea.value, this.wrapperElement);
        this.wrapperElement.classList.remove('editing');
        this.wrapperElement.classList.add('running');
      } catch (e) {
        if (e instanceof parser.SyntaxError) {
          alert(e.message);
          this.textarea.select();
          this.textarea.setSelectionRange(e.location.start.offset, e.location.end.offset);
        } else {
          throw e;
        }
      }
    }
    
    returnToEditMode() {
      this.emulator.pause();
      this.emulator.remove();
      this.wrapperElement.classList.remove('running');
      this.wrapperElement.classList.add('editing');
      this.emulator = null;
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