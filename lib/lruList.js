/**
 * create a lru Cache
 * @param length
 * @returns {{put: Function, get: Function, remove: Function}}
 */
exports.createLRUList = function (length) {
  var size = 0,
    data = {},
    capacity = length,
    lruHash = {},
    freshEnd = null,
    staleEnd = null;

  return {
    put: function(key, value) {
      var lruEntry = lruHash[key] || (lruHash[key] = {key: key});

      refresh(lruEntry);

      if (!(key in data)) size++;
      data[key] = value;

      if (size > capacity) {
        this.remove(staleEnd.key);
      }
      return value;
    },

    get: function(key) {
      var lruEntry = lruHash[key];
      if (!lruEntry) return;
      refresh(lruEntry);
      return data[key];
    },

    /**
     * @param {Function | String} key - function(realKey){return boolean}
     * @returns {*} return the real key if argument 'key' is function, otherwise return boolean
     */
    has: function(key) {
      var keys = Object.keys(lruHash), realKey;
      if (typeof key == 'function') {
        !keys.some(function(_key) {
          realKey = _key;
          return key(_key);
        }) && (realKey = void 0);
        return realKey
      }
      return keys.indexOf(key) != -1
    },

    pop: function() {
      if (staleEnd) return {
        key: staleEnd.key,
        data: this.remove(staleEnd.key)
      }
    },

    remove: function(key) {
      var lruEntry = lruHash[key], ret;

      if (!lruEntry) return;

      if (lruEntry == freshEnd) freshEnd = lruEntry.p;
      if (lruEntry == staleEnd) staleEnd = lruEntry.n;
      link(lruEntry.p, lruEntry.n);

      ret = data[key];
      delete lruHash[key];
      delete data[key];
      size--;
      return ret;
    },

    removeAll: function() {
      data = {};
      size = 0;
      lruHash = {};
      freshEnd = staleEnd = null;
    },

    size: function() {
      return size;
    }
  };

  /**
   * makes the `entry` the freshEnd of the LRU linked list
   */
  function refresh(entry) {
    if (entry != freshEnd) {
      if (!staleEnd) {
        staleEnd = entry;
      } else if (staleEnd == entry) {
        staleEnd = entry.n;
      }

      link(entry.p, entry.n);
      link(freshEnd, entry);
      freshEnd = entry;
      freshEnd.n = null;
    }
  }

  /**
   *  p         n
   * <-- entry -->
   *
   *     staleEnd           ....           freshEnd
   *  .., entryX,  entry.p,  entry,  entry.n,  entryY ..
   */

  function link(prevEntry, nextEntry) {
    if (nextEntry != prevEntry) {
      if (nextEntry) nextEntry.p = prevEntry;
      if (prevEntry) prevEntry.n = nextEntry;
    }
  }
}