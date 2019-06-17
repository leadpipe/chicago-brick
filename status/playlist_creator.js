import Sortable from './node_modules/sortablejs/modular/sortable.esm.js';

function makeEditableText(el, getFn, setFn) {
  el.textContent = getFn();
  el.addEventListener('dblclick', () => {
    el.contentEditable = true;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    el.focus();
  });
  el.addEventListener('keydown', e => {
    if (e.keyCode == 13) {
      window.getSelection().removeAllRanges();
      el.blur();
    }
  });
  el.addEventListener('blur', () => {
    const v = Number(el.textContent);
    if (!Number.isNaN(v)) {
      setFn(v);
    }
    el.contentEditable = false;
    el.textContent = getFn();
  });
}

export class PlaylistCreator {
  constructor(container, applyPlaylistFn) {
    this.container = container;
    this.applyPlaylistFn = applyPlaylistFn;
    container.querySelector('#close-creator')
        .addEventListener('click', () => this.close());
    container.querySelector('#apply-playlist')
        .addEventListener('click', () => this.applyPlaylist());
    container.querySelector('#clear-playlist')
        .addEventListener('click', () => this.clearPlaylist());
    container.querySelector('#load-live')
        .addEventListener('click', () => this.loadLivePlaylist());
    container.querySelector('#new-layout')
        .addEventListener('click', () => this.newLayout());

    // A playlist is a list of layouts.
    // A layout is a duration + a list of modules + a module duration.
    // A module is a name of a module.
    this.playlist = [];

    this.livePlaylist = null;

    this.moduleConfig = null;
  }
  clearPlaylist() {
    this.playlist = [];
    this.render();
  }
  loadLivePlaylist() {
    // Make a deep-copy of the live playlist, so we don't modify the
    // copy we were passed-in.
    this.playlist = JSON.parse(JSON.stringify(this.livePlaylist));
    this.render();
  }
  newLayout() {
    let duration = 1800;
    let moduleDuration = 300;
    if (this.playlist.length) {
      const lastLayout = this.playlist[this.playlist.length - 1];
      duration = lastLayout.duration;
      moduleDuration = lastLayout.moduleDuration;
    }
    this.playlist.push({modules: ['_empty'], duration, moduleDuration});
    this.render();
  }
  setLivePlaylist(livePlaylist) {
    this.livePlaylist = livePlaylist;
  }
  setModuleConfig(moduleConfig) {
    this.moduleConfig = moduleConfig;
    this.renderModuleConfig();
  }
  open() {
    this.container.style.right = '0';
  }
  close() {
    this.container.style.right = `-${this.container.offsetWidth}px`;
  }
  applyPlaylist() {
    this.close();
    this.applyPlaylistFn(this.playlist);
  }

  render() {
    const playlistEl = this.container.querySelector('#current-playlist');
    Array.from(playlistEl.children).forEach(e => e.remove());

    Sortable.create(playlistEl, {
      group: 'layouts',
      animation: 150,
      removeOnSpill: true,
      onEnd: evt => {
        if (!evt.item.parentElement) {
          // Remove the item.
          this.playlist.splice(evt.oldIndex, 1);
        } else {
          // Need to move.
          const layout = this.playlist[evt.oldIndex];
          this.playlist.splice(evt.oldIndex, 1);
          this.playlist.splice(evt.newIndex, 0, layout);
        }
      },
    });

    for (const layout of this.playlist) {
      const layoutEl = document.createElement('div');
      layoutEl.className = 'layout';

      const header = document.createElement('div');
      header.className = 'header';
      header.textContent = 'Layout ';

      const durationEl = document.createElement('span');
      makeEditableText(durationEl, () => layout.duration, d => layout.duration = d);
      header.appendChild(durationEl);

      header.appendChild(document.createTextNode('s ('));

      const moduleDurationEl = document.createElement('span');
      makeEditableText(moduleDurationEl, () => layout.moduleDuration, d => layout.moduleDuration = d);
      header.appendChild(moduleDurationEl);

      header.appendChild(document.createTextNode('s / module)'));

      layoutEl.appendChild(header);

      for (const moduleName of layout.modules) {
        const mEl = document.createElement('div');
        mEl.classList.add('module');

        const nEl = document.createElement('span');
        nEl.textContent = moduleName;
        mEl.appendChild(nEl);

        layoutEl.appendChild(mEl);
      }
      Sortable.create(layoutEl, {
        group: 'modules',
        animation: 150,
        filter: '.header,.footer',
        removeOnSpill: true,
        onMove: (evt) => {
          if ((evt.related.className == 'header' && !evt.willInsertAfter) ||
              (evt.related.className == 'footer' && evt.willInsertAfter)) {
            return false;
          }
        },
        onEnd: evt => {
          if (!evt.item.parentElement) {
            // Remove the item.
            evt.oldIndex--;
            layout.modules.splice(evt.oldIndex, 1);
          } else if (evt.to == layoutEl) {
            evt.newIndex--;
            if (evt.from == layoutEl) {
              // Need to move.
              evt.oldIndex--;
              const name = layout.modules[evt.oldIndex];
              layout.modules.splice(evt.oldIndex, 1);
              layout.modules.splice(evt.newIndex, 0, name);
            } else {
              // Need to add.
              console.log(evt.clone.textContent);
            }
          }
        },
        onAdd: evt => {
          if (evt.to == layoutEl) {
            evt.newIndex--;
            // Need to add.
            layout.modules.splice(evt.newIndex, 0, evt.clone.firstChild.textContent);
          }
        }
      });


      const footer = document.createElement('div');
      footer.className = 'footer';
      footer.innerHTML = '&nbsp;'
      layoutEl.appendChild(footer);

      playlistEl.appendChild(layoutEl);
    }
  }

  renderModuleConfig() {
    const modulesEl = this.container.querySelector('#all-known-modules');
    Array.from(modulesEl.children).forEach(m => m.remove());

    for (const name in this.moduleConfig) {
      const module = this.moduleConfig[name];
      const mEl = document.createElement('div');
      mEl.className = 'module';

      const nEl = document.createElement('span');
      nEl.textContent = name;
      mEl.appendChild(nEl);

      if (module.extends) {
        mEl.appendChild(document.createTextNode(' extends '));
        const eEl = document.createElement('span');
        eEl.textContent = module.extends;
        mEl.appendChild(eEl);
      }
      modulesEl.appendChild(mEl);
    }

    Sortable.create(modulesEl, {
      group: {
        name: 'modules',
        pull: 'clone',
        put: false,
      },
      draggable: '.module',
      animation: 150,
      sort: false,
      onMove: (evt) => {
        if ((evt.related.className == 'header' && !evt.willInsertAfter) ||
            (evt.related.className == 'footer' && evt.willInsertAfter)) {
          return false;
        }
      },
      onEnd: (evt) => {
        Array.from(evt.item.childNodes).slice(1).forEach(e => e.parentNode.removeChild(e));
      }
    });
  }
}
