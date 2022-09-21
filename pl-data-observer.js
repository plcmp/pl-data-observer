import { PlElement, css } from "polylib";
import {normalizePath} from "polylib/common.js";

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

    setTouch(path, chain, upd) {
        let c = chain.at(-2);
        let a = chain.at(-1);
        if (!c) return;
        if (Array.isArray(c)) {
            c._mutations = c._mutations || {upd: [], del: [], add: [], touch: []};
            if (this._checkMutation(a, upd)) {
                if ( upd && c._mutations.add.indexOf(a) < 0 && c._mutations.upd.indexOf(a) < 0 ) {
                    c._mutations.upd.push(a);
                } else if (!upd && c._mutations.add.indexOf(a) < 0 && c._mutations.upd.indexOf(a) < 0 && c._mutations.touch.indexOf(a) < 0) {
                    c._mutations.touch.push(a);
                }
            } else {
                if (upd) {
                    const updIdx = c._mutations.upd.indexOf(a);
                    if (updIdx >= 0) c._mutations.upd.splice(updIdx, 1);
                } else {
                    const touchIdx = c._mutations.touch.indexOf(a);
                    if (touchIdx >= 0) c._mutations.touch.splice(touchIdx, 1);
                }
            }
            upd = false;
        }
        this.setTouch(path.slice(0, -1), chain.slice(0, -1), upd);
    }

    _dataChanged(newVal, old, mutation) {
        if (!this.data) return;
        let path = normalizePath(mutation.path);
        let c = this;
        let chain = path.map( p => c = c[p] );
        let current = chain.at(-1);

        if (Array.isArray(current) && mutation.action === 'splice') {
            if (!current._mutations) {
                current._mutations = { upd: [], del: [], add: [], touch: [] };
            }

            if (mutation.deletedCount > 0) {
                mutation.deleted.forEach((i) => {
                    const addIdx = current._mutations.add.indexOf(i);
                    if (addIdx < 0) {
                        current._mutations.del.push(i);
                        this._clearMutation(i); // clear mutations in deleted element
                        const updIdx = current._mutations.upd.indexOf(i);
                        if (updIdx >= 0) current._mutations.upd.splice(updIdx, 1);
                        const touchIdx = current._mutations.touch.indexOf(i);
                        if (touchIdx >= 0) current._mutations.touch.splice(touchIdx, 1);
                    } else {
                        current._mutations.add.splice(addIdx, 1);
                    }
                });
                this.setTouch(path, chain);
            }

            if (mutation.addedCount > 0) {
                mutation.added.forEach((i) => {
                    const delIdx = current._mutations.del.indexOf(i);
                    if (delIdx < 0) {
                        const aIdx = current._mutations.add.indexOf(i);
                        if (aIdx < 0) {
                            current._mutations.add.push(i);
                        }
                    } else {
                        current._mutations.del.splice(delIdx, 1);
                    }
                });
                this.setTouch(path, chain);
            }


        }
        else if (chain.at(-2) instanceof Object && mutation.action === 'upd') {
            current = chain.at(-2);
            if (current._old) {
                this.setTouch(path, chain, true);
            }
        }

        this.isChanged = this._checkMutation();
    }

    reset(obj) {
        this.isChanged = false;
        this._isChangedArray = false;
        this._clearMutation(obj);
    }

    _checkMutation(obj, firstLevel) {
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
                if (prop.startsWith('_')) continue;
                const o = obj[prop];
                if (o instanceof Object && !(o instanceof Date)) {
                    if (!firstLevel && this._checkMutation(o)) return true;
                } else {
                    if ( obj._old && o !== obj._old[prop]) return true;
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
            obj._old = obj._old || {};
            Object.keys(obj).forEach((k) => {
                if (k === '_old') return;
                if (obj[k] instanceof Object && !(obj[k] instanceof Date)) this.snapshot(obj[k]);
                else obj._old[k] = obj[k];
            });
        }
    }
}

customElements.define('pl-data-observer', PlDataObserver);
