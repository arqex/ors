/* ors v0.8.0 (2020-9-26)
 * https://github.com/passpill-io/ors
 * By Javier Marquez - javi@arqex.com
 * License: MIT
 */
 (function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		define(['exports', 'ors'], factory);
	} else if (typeof exports === 'object') {
		module.exports = factory();
	} else {
		root.ors = factory();
	}
}(this, function () {
	'use strict';
	// ----------
// State queues
// ----------
var queue = [];

function flushTimers() {
  let t;
  while( t = queue.shift() ){
    t();
  }
}

///////////
// On state
///////////
let instanceCounter = 0;
let rebuiltNodes = new WeakMap();

function ors(data, options) {
  rebuiltNodes = new WeakMap();
  let root = enhanceNode( data );
  root.__.rootName = (options || {}).name || ('os' + (++instanceCounter));
  return root;
}


	var activateQueue;
	if( typeof window !== 'undefined' && window.setImmediate ){
		let immId = false;
		activateQueue = function(){
			if( !immId ){
				immId = window.setImmediate( function() {
					immId = false;
					flushTimers();
				});
			}
		}
	}
	else if (typeof window !== 'undefined' && window.addEventListener ) {
		let o = window.origin;
		if (!o || o === 'null') o = '*';

		window.addEventListener('message', function (e) {
			e.data === 'now' && flushTimers();
		});
		activateQueue = window.postMessage.bind(window, 'now', o);
	}
	else {
		activateQueue = function () {
			process.nextTick(flushTimers);
		}
	}
	

var waitFor = function( clbk ){
  queue.push(clbk);
  activateQueue();
  return 1;
};

function enhanceNode( data ){
  if( isLeaf( data ) ){
    return data;
  }
  else if( !isOrs( data ) ){
    return createNode( data, true );
  }
  return data;
}

function createNode( data, deepCreation ){
  let __ = {
    parents: new Set(),
    clbks: [],
    timer: false,
    dirty: false
  };

  let source = getEmpty(data);
  if( deepCreation ){
    iterateKeys( data, function( key ){
      source[key] = enhanceNode( data[key] );
      if( isOrs(source[key]) ){
        source[key].__.parents.add(__);
      }
    });
  }
  else {
    source = clone( data )
  }

  let handlers = Object.assign( {__: __}, proxyHandlers );
  let node = new Proxy( source, handlers );

  __.setDirty = function(){
    if( __.dirty ) return;

    __.dirty = true;
    if( isRoot(node) ){
      enqueueRootChange( node );
    }
    else {
      __.parents.forEach( function(grandpa) {
        grandpa.setDirty();
      });
    }
  }

  __.getAscendancy = function( ascendancy ){
    ascendancy.add( node );

    __.parents.forEach( parent => {
      parent.getAscendancy( ascendancy );
    });

    return ascendancy;
  }

  return node;
}

function enqueueRootChange( node ){
  if( !node.__.timer ){
    node.__.timer = waitFor( () => {
      delete node.__.timer;
      updateRoot(node);
      node.emitChange(node);
    });
  }
}

function updateRoot(root){
  iterateKeys( root, function( key, child ){
    if( isDirty( child ) ){
      let nextNode = cleanNode( child );
      transferProps( child, nextNode, root, root );
      root[ key ] = nextNode;
      nextNode.emitChange( nextNode );
    }
  });

  root.__.dirty = false;
}

function cleanNode( node ) {
  let nextNode = createNode( getEmpty( node ) );
  nextNode.__.init = true;

  iterateKeys( node, function( key, child ){
    if( isDirty( child ) ){
      let nextChild = cleanNode( child );
      transferProps( child, nextChild, node, nextNode );
      nextNode[ key ] = nextChild;
      nextChild.emitChange( nextChild );
    }
    else {
      nextNode[key] = child;
    }
  });

  delete node.__.dirty;
  delete nextNode.__.init;
  return nextNode;
}


function transferProps( prevNode, nextNode, prevParent, nextParent ){
  let transferClbks = false;
  if( isOrs(prevNode) ){
    prevNode.__.parents.delete( prevParent.__ );
    transferClbks = true;
  }

  if( isOrs(nextNode) ){
    nextNode.__.parents.add( nextParent.__ );
    if( transferClbks ) {
      nextNode.__.clbks = prevNode.__.clbks.slice();
    }
  }
}

function assertNoLoops( parents, node ){
  if( isLeaf(node) ){
    return;
  }

  // Check if the parent is already added
  if( parents.has(node) ){
    err('Trying to add a node that is already added. Loops are not allowed in ORS.');
  }
  
  iterateKeys( node, function(key) {
    assertNoLoops( parents, node[key]);
  });
}


////////
// Proxy handlers
///////
var proxyHandlers = {
  set: function (obj, prop, value) {
    if( typeof value === 'function' ){
      ors.warn('Adding functions to a oS is not allowed. They will be omitted.');
      return true;
    }

    if( isRoot(value) ){
      err('Cant add root nodes to another os.');
    }

    if( !isLeaf(value) ){
      assertNoLoops( this.__.getAscendancy( new Set() ), value );
    }

    obj[prop] = enhanceNode( value );
    if( !this.__.init ){
      this.__.setDirty();
    }
    
    return true;
  },
  
  deleteProperty: function (obj, prop) {
    delete obj[prop];
    if( !this.__.init ){
      this.__.setDirty();
    }
    return true;
  },
  get: function (obj, prop) {
    if (prop === '__') {
      return this.__;
    }
    if (nodeMethods[prop]) {
      return nodeMethods[prop];
    }
    return obj[prop];
  }
};


///////////
// Extra methods for nodes
///////////
const nodeMethods = {
  addChangeListener: function(clbk) {
    if (typeof clbk !== 'function') {
      return ors.warn("The listener is not a function.")
    }
    this.__.clbks.push( clbk );
  },
  removeChangeListener: function(clbk) {
    let clbks = this.__.clbks;
    let idx = clbks.length;
    let removed = false;

    while( idx-- > 0 ){
      if( clbk === clbks[idx] ){
        clbks.splice( idx, 1 );
        removed = true;
      }
    }

    if( !removed ){
      ors.warn("Couldn't find the listener to remove.");
    }
  },
  emitChange: function ( state ) {
    this.__.clbks.forEach( clbk => {
      clbk( state );
    });
  },
  flatten: function() {
    return JSON.parse( JSON.stringify(this) );
  }
}


////////////
// HELPERS
////////////
function isOrs(data) {
  return data && data.__;
}

function isLeaf(data){
  return !(data instanceof Object);
}

function isRoot(data){
  return data && data.__ && data.__.rootName;
}

function isDirty(data){
  return isOrs(data) && data.__.dirty;
}

function getEmpty( node ){
  return node.splice ? [] : {};
}

function clone( node ){
  if (node.slice) return node.slice();

  let c = {};
  for (let key in node) {
    c[key] = node[key];
  }
  return c;
}

function iterateKeys( obj, clbk ){
  if(obj.splice){
    obj.forEach( (it, key) => clbk(key) );
  }
  for( let key in obj ){
    clbk(key, obj[key]);
  }
}

function err(msg) {
  throw new Error('ors ERROR: ' + msg);
}

ors.warn = function(msg) {
  console.warn('ors WARNING: ' + msg);
}


	return ors;
}));