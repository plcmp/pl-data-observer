import { PlElement, css } from "polylib";

class PlDataObserver extends PlElement {
    static get properties() {
        return {
            data: {
                type: Array,
                value: () => [],
                observer: '_dataChanged'
            },
            isChanged: {
                type: Boolean,
                value: false
            }
        };
    }

    static get css() {
        return css`
            :host{ 
                display: none;
            }
        `;
    }

    setTouch(match, markUpd) {
        if (!match || !match[1]) return;
        const path = match[1];
        const arr = this.get(path.match(/([\w\.]+)\.\d+$/)[1]);
        const mp = path.replace(/\.(\d+)/, '');
        if (this._paths.length == 0 || this._paths.indexOf(mp) >= 0) {
            // для данного пути требуются мутации
            if (arr) {
                const item = this.get(path);
                if (!arr._mutations) {
                    arr._mutations = {
                        upd: [], del: [], add: [], touch: []
                    };
                }

                if (arr._mutations.add.indexOf(item) < 0
                    && arr._mutations.del.indexOf(item) < 0
                    && arr._mutations.upd.indexOf(item) < 0
                    && arr._mutations.touch.indexOf(item) < 0
                ) {
                    if (markUpd) arr._mutations.upd.push(item);
                    else arr._mutations.touch.push(item);
                }

                this.setTouch(path.match(/(.+\.\d+)\.\w+/));
            }
        }
    }

    _dataChanged(current, old, mutation) {
        if (!this.data) return;
        if (Array.isArray(current)) {
            if (mutation.oldValue && mutation.oldValue.length == 0 && mutation.value.length == 0) {
                return;
            }

            if (mutation.action === 'splice') {
                if (!this.get([mutation.path, '_mutations'])) {
                    this.get(mutation.path)._mutations = {
                        upd: [], del: [], add: [], touch: []
                    };
                }

                if (mutation.deletedCount > 0) {
                    mutation.deleted.forEach((i) => {
                        const addIdx = this.get(`${mutation.path}._mutations.add`).indexOf(i);
                        if (addIdx < 0) {
                            this.get(`${mutation.path}._mutations.del`).push(i);
                            this._clearMutation(i); // очистка мутации у удаленного элеменета
                            const updIdx = this.get(`${mutation.path}._mutations.upd`).indexOf(i);
                            if (updIdx >= 0) this.get(`${mutation.path}._mutations.upd`).splice(updIdx, 1);
                        } else {
                            this.get(`${mutation.path}._mutations.add`).splice(addIdx, 1);
                            this.setTouch(mutation.path.match(/(.+\.\d+)\.\w+/));
                        }
                    });
                }

                if (mutation.addedCount > 0) {
                    mutation.added.forEach((i) => {
                        const delIdx = this.get(`${mutation.path}._mutations.del`).indexOf(i);
                        if (delIdx < 0) {
                            const aIdx = this.get(`${mutation.path}._mutations.add`).indexOf(i);
                            if (aIdx < 0) {
                                this.get(`${mutation.path}._mutations.add`).push(i);
                                this.setTouch(mutation.path.match(/(.+\.\d+)\.\w+/));
                            }
                        } else {
                            this.get(`${mutation.path}._mutations.del`).splice(delIdx, 1);
                        }
                    });
                }
            }

            if (mutation.action === 'upd') {
                const m = mutation.path.match(/(.+)\.(\d+)(\.([\w\.]+))?$/);
                if (m) {
                    const path = m[1];
                    const item = this.get([path, m[2]]);
                    if (this.get(path)._mutations.upd.indexOf(item) < 0 && this.get(path)._mutations.add.indexOf(item) < 0) {
                        this.get(path)._mutations.upd.push(item);
                    }
                    // TODO реализовать откат изменений и удаление мутации изменения
                }
            }

            this.isChanged = this._checkMutation();
        }
    }

    /**
     * Обсервер, срабатывающий при изменении значения массива **data**.
     *
     * Используется для:
     * * Указания того, что объект был изменен;
     * * Установки свойства-объекта **_mutations** внутри **data**;
     * * Формирования информации внутри **_mutations**.
     * @param {Object} x - детальная информация о состоянии свойства **data**.
     * @return {void}
     * @private
     */
    _dataCanged(x, old, mutation) {
        if (!this.data) return;
        if (mutation.path.match(/\.length$/)) return;
        let m = mutation.action.match(/^(.*)\.splice$/);
        if (m) {
            this.isChanged = true;
            this._isChangedArray = true;
            const path = m[1];
            const mp = path.replace(/\.(\d+)\./g, '.*.');
            if (this._paths.length == 0 || this._paths.indexOf(mp) >= 0) {
                if (!this.get([path, '_mutations'])) {
                    this.get(path)._mutations = {
                        upd: [], del: [], add: [], touch: []
                    };
                }
                x.value.indexSplices[0].removed.forEach((i) => {
                    const addIdx = this.get([path, '_mutations.add']).indexOf(i);
                    if (addIdx < 0) {
                        this.get([path, '_mutations.del']).push(i);
                        this._clearMutation(i);
                        const touchIdx = this.get([path, '_mutations.touch']).indexOf(i);
                        if (touchIdx >= 0) this.get([path, '_mutations.touch']).splice(touchIdx, 1);
                        this.setTouch(path.match(/(.+\.\d+)\.\w+/));
                        const updIdx = this.get([path, '_mutations.upd']).indexOf(i);
                        if (updIdx >= 0) this.get([path, '_mutations.upd']).splice(updIdx, 1);
                    } else {
                        this.get([path, '_mutations.add']).splice(addIdx, 1);
                        this.setTouch(path.match(/(.+\.\d+)\.\w+/));
                    }
                });

                if (x.value.indexSplices[0].removed.length) {
                    this._isChangedArray = this.isChanged = this._checkMutation();
                }

                const index = x.value.indexSplices[0].index;
                for (let addIdx = index; addIdx < index + x.value.indexSplices[0].addedCount; addIdx++) {
                    const obj = this.get([path, addIdx]);
                    const delIdx = this.get([path, '_mutations.del']).indexOf(obj);
                    if (delIdx < 0) {
                        const aIdx = this.get([path, '_mutations.add']).indexOf(obj);
                        if (aIdx < 0) {
                            this.get([path, '_mutations.add']).push(obj);
                            this.setTouch(path.match(/(.+\.\d+)\.\w+/));
                        }
                    } else {
                        this.get([path, '_mutations.del']).splice(delIdx, 1);
                    }
                }
            } else {
                // для данного пути не требуется отслеживать мутации,
                // поэтому помечаем родительский объект как изменненный
                this.setTouch(path.match(/(.+\.\d+)\.\w+/), true);
            }
        } else {
            m = x.path.match(/(.+)\.(\d+)(\.([\w\.]+))?$/);
            if (m) {
                if (!this.observeSystemFields && m[4] && m[4][0] === '_') {
                    return;
                }
                const path = m[1];
                if (this._paths.length == 0 || this._paths.indexOf(path.replace(/\.(\d+)\./g, '.*.')) >= 0) {
                    if (!this.get([path, '_mutations'])) {
                        this.get(path)._mutations = {
                            upd: [], del: [], add: [], touch: []
                        };
                    }
                    const item = this.get([path, m[2]]);
                    if (this.get(path)._mutations.upd.indexOf(item) < 0
                        && this.get(path)._mutations.add.indexOf(item) < 0) {
                        this.get(path)._mutations.upd.push(item);
                        const touchIdx = this.get(path)._mutations.touch.indexOf(item);
                        if (touchIdx >= 0) this.get(path)._mutations.touch.splice(touchIdx, 1);
                        this.setTouch(path.match(/(.+\.\d+)\.\w+/));
                    }
                }
            }

            // если внутри измененного обьекта есть отслеживаемые пути то принудительно вызываем инициализацию массивов
            if (this._paths.length > 0) {
                this._paths
                    .forEach(i => {
                        if (i.indexOf(x.path.replace(/\.(\d+)\./g, '.*.')) !== 0) return;
                        let path = x.path;
                        // для всех отслеживаний на которые может повлиять изменение текущего пути
                        const el = this.get(path);
                        // проверяем являются ли отслеживаемый путь непустым массивом
                        if (Array.isArray(el) && el.length > 0) {
                            // имитируем добавление всех элементов в массив
                            this._dataCanged({
                                path: `${path}.splices`,
                                value: {
                                    indexSplices: [
                                        {
                                            index: 0,
                                            removed: [],
                                            addedCount: el.length
                                        }
                                    ]
                                }
                            });
                        }
                    });

                let path = '';
                this._paths.forEach(i => {
                    if (x.path.replace(/\.(\d+)\./g, '.*.').indexOf(i) === 0)
                        path = i;
                });


                const prop = x.path.split('.');
                if (prop.length > 1)
                    prop.pop();
                path = prop.join('.');
                m = x.path.match(/\.(\w+)$/);
                if (m && !this.observeSystemFields && m[1] && m[1][0] === '_') {
                    return;
                }
                const el = this.get(path);
                if (el instanceof Object) {
                    if (el.__old) {
                        this.__changed = this.__changed || {};
                        const prop = x.path.split('.').pop();
                        if ((el.__old[prop] !== el[prop] && !this.useNonStrictEquality)
                            || (el.__old[prop] != el[prop] && this.useNonStrictEquality)) {
                            this.__changed[x.path] = true;
                            this.set([path, '__changed'], true);
                        } else {
                            delete this.__changed[x.path];
                            this.set([path, '__changed'], false);
                        }
                        if (!this._isChangedArray) this.isChanged = Object.keys(this.__changed).length !== 0;
                    }
                }
            }
        }
    }


    reset(obj) {
        this.isChanged = false;
        this._isChangedArray = false;
        this._clearMutation(obj);
    }

    _checkMutation(obj) {
        obj = obj || this.data;
        if (Array.isArray(obj)) {
            if (obj._mutations) {
                if (obj._mutations.upd.length
                    || obj._mutations.del.length
                    || obj._mutations.add.length
                    || obj._mutations.touch.length) {
                    return true;
                }
            }

            for (let i = 0, c = obj.length; i < c; i++) {
                let o = obj[i];
                if (o instanceof Object && this._checkMutation(o))
                    return true;
            }
        } else if (obj instanceof Object) {
            for (const prop in obj) {
                const o = obj[prop];
                if (o instanceof Object && this._checkMutation(o)) {
                    return true;
                }
            }
        }
        return false;
    }

    _clearMutation(obj) {
        obj = obj || this.data;
        if (Array.isArray(obj)) {
            if (obj._mutations) {
                obj._mutations = {
                    upd: [], del: [], add: [], touch: []
                };
            }
            obj.forEach((o) => {
                if (o instanceof Object) this._clearMutation(o);
            });
        } else if (obj instanceof Object) {
            for (const prop in obj) {
                const o = obj[prop];
                if (o instanceof Object) this._clearMutation(o);
            }
        }
    }

    snapshot(obj) {
        this.isChanged = false;
        obj = obj || this.data;
        if (Array.isArray(obj)) {
            obj.forEach((i) => {
                if (i instanceof Object) this.snapshot(i);
            });
        } else {
            obj.__old = obj.__old || {};
            Object.keys(obj).forEach((k) => {
                if (k == '__old') return;
                if (obj[k] instanceof Object && !(obj[k] instanceof Date)) this.snapshot(obj[k]);
                else obj.__old[k] = obj[k];
            });
        }
    }


    clear(obj) {
        this.isChanged = false;
        obj = obj || this.data;
        if (obj instanceof Object) {
            delete obj.__old;
            for (const prop in obj) {
                const o = obj[prop];
                if (o instanceof Object) this.clear(o);
            }
        }
    }
}

customElements.define('pl-data-observer', PlDataObserver);
