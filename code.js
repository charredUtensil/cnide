(function(){
  const HELLO_WORLD_ = 'Main() {\n  \n}'
  
  const createButton_ = function(parentElement, text, icon, onClick) {
    const elem = utils.createHtmlElement(parentElement, 'a', ['btn']);
    utils.createHtmlElement(elem, 'i', ['icon', 'fa', 'fa-' + icon]);
    utils.createHtmlElement(elem, 'div', ['text'], text);
    elem.title = text;
    elem.onclick = onClick;
    return elem;
  }

  class Editor {
    constructor(parentElement) {
      this.wrapperElement = utils.createHtmlElement(parentElement, 'div', ['editing'])
      const menu = utils.createHtmlElement(this.wrapperElement, 'div', ['menu']);
      
      const edit = utils.createHtmlElement(menu, 'div', ['edit']);
      createButton_(edit, 'Run', 'play', () => this.compileAndRun());
      const gitHub = createButton_(edit, 'GitHub', 'github', () => this.autosave())
      gitHub.href='https://github.com/charredutensil/cnide';
      gitHub.target='blank';
      gitHub.classList.add('right');
      
      const run = utils.createHtmlElement(menu, 'div', ['run']);
      createButton_(run, 'Edit', 'code', () => this.returnToEditMode());
      createButton_(run, 'Pause', 'pause', () => this.emulator.pause());
      createButton_(run, 'Step', 'step-forward', () => this.emulator.step());
      createButton_(run, 'Slow', 'play', () => this.emulator.run(500));
      createButton_(run, 'Fast', 'forward', () => this.emulator.run(1000/60));
      
      const editorElement = utils.createHtmlElement(
          this.wrapperElement, 'div', ['editor']);
      this.textarea = utils.createHtmlElement(editorElement, 'textarea');
      this.textarea.value = localStorage.getItem('autosave') || HELLO_WORLD_;
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
  
    step_() {
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
      this.step_();
    };
  
    run(millisPerTick) {
      this.pause();
      this.interval = window.setInterval(() => this.step_(), millisPerTick);
    };
    
    remove() {
      this.pause();
      this.network.getDomElement(null).remove();
    };
  }
  
  window.Editor = Editor;
})();