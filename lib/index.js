'use strict';

/**
 * Module dependencies.
 */

import dbg from 'debug';

/**
 * Module variables.
 */

const debug = dbg('event-store-cmd');
const noop = () => {};
const reserved = {
  constructor: 1,
  command: 1,
  handle: 1,
  commit: 1,
  bind: 1,
  exec: 1
};

export default class Base {

  /**
   * Base constructor.
   *
   * @param {String} name
   * @param {Bus} bus
   * @param {Repository} store
   * @param {Object} options
   */

  constructor(store, options) {
    if (this.constructor === Entity) {
      throw new Error('Can not instantiate abstract class.', this);
    }
    this.options = options;
    this.store = store;
  }

  /**
   * Called upon incomming command.
   *
   * @param {String} cmd
   * @param {Object} message
   * @param {Function} fn
   */

  handle(cmd, message, fn = noop) {
    if (arguments.length > 3) return;
    debug(`incomming request ${cmd} with message %j`, message);
    if ('function' !== typeof fn) {
      return debug(new Error(`Invalid callback provided.`));
    }
    this.get(message.id, this.exec(...arguments));
  }

  /**
   * Execute command.
   *
   * @param {String} cmd
   * @param {Object} message
   * @param {Function} fn
   * @return {Function}
   */

  exec(cmd, message, fn) {
    const command = this.command(cmd);
    if (!command) return fn(new Error(`Invalid command: ${cmd}.`));
    return (err, entity, cached) => {
      if (err) return fn(err);
      command(Object.freeze(message), entity, fn);
    }
  }

  /**
   * Get valid command.
   *
   * @param {String} cmd
   * @return {Object|Null}
   */

  command(cmd) {
    if (reserved[cmd] || !this[cmd]) return null;
    debug(`found valid command ${cmd}`);
    return this[cmd].bind(this);
  }

  /**
   * Get entity instance.
   *
   * @param {String} id
   * @param {Function} fn
   */

  get(id, fn) {
    if (!id) return fn(new Error(`Invalid entity id.`));
    this.store.get(id, (err, entity, cached) => {
      if (err) return fn(err);
      if (!entity) return fn(new Error(`Unable to load entity ${id}.`));
      debug(`found valid entity ${entity.id} to handle command`);
      fn(null, entity, cached);
    });
  }

  /**
   * Save entity to store stream.
   *
   * @param {Condo} entity
   * @param {Object} data
   * @param {Function} fn
   */

  commit(entity, data, fn) {
    if ('function' === typeof data) {
      fn = data;
      data = null;
    }
    debug(`saving entity ${entity.id}`);
    this.store.commit(entity, (err) => {
      if (err) return fn(err);
      fn(null, data || entity.data);
    });
  }

}
