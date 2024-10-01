import {Db, MongoClient} from "@spica-server/database";
import {ChangeStream} from "mongodb";

const originalCollection = Db.prototype.collection;

Db.prototype.collection = function(name: string) {
  const coll = originalCollection.bind(this)(...arguments);
  const originalWatch = coll.watch;
  coll.watch = function() {
    _prepare();
    const stream = originalWatch.bind(this)(...arguments);
    stream.on("ready", () => {
      if (_resolve) {
        _resolve([name, ...arguments]);
      }
    });
    _poll(stream);
    return stream;
  };
  return coll;
};

const originalWatch = MongoClient.prototype.watch;

MongoClient.prototype.watch = function() {
  _prepare();
  const stream = originalWatch.bind(this)(...arguments);
  stream.on("ready", () => {
    if (_resolve) {
      _resolve(arguments);
    }
  });
  _poll(stream);
  return stream;
};

let _nextChangePromise: Promise<unknown>;
let _resolveChange: (...args) => any;

let _nextPromise: Promise<Array<string | object>>;
let _resolve: (...args) => any;

function _poll(stream: ChangeStream) {
  stream.on("change", e => {
    if (_resolveChange) {
      // Call the callback at the end of the queue just to be safe
      setImmediate(_resolveChange, e);
    }
  });
  const i = setInterval(() => {
    if (stream["cursor"] && stream["cursor"].cursorState.cursorId) {
      clearInterval(i);
      stream.emit("ready" as any, stream["cursor"].cursorState.cursorId.toString());
    }
  }, 1);
}

function _prepare() {
  _nextPromise = new Promise(resolve => (_resolve = resolve));
  stream.change.next();
}

export namespace stream {
  export namespace change {
    export function next() {
      _nextChangePromise = new Promise(resolve => (_resolveChange = resolve));
    }
    export function wait() {
      return _nextChangePromise;
    }
  }

  export function wait() {
    return _nextPromise;
  }
}
