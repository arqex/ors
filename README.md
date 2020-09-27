# ORS - Observable regenerating store

[![npm version](https://badge.fury.io/js/ors.svg)](https://www.npmjs.com/package/ors) [![Build Status](https://secure.travis-ci.org/arqex/ors.svg)](https://secure.travis-ci.org/arqex/ors) [![Coverage Status](https://coveralls.io/repos/github/arqex/ors/badge.svg?branch=master)](https://coveralls.io/github/arqex/ors?branch=master)

The Observable Regenerating Store is a tree data structure that emits events on updates, even if the change happens in one of the leaves, making easier to thing in a reactive way.

An *ORS* can be read or updated like any JS object:
```js
import ors from '@arqex/ors'

let store = ors({
  people: {
    alice: { age: 22 },
    bob: {age: 38}
  }
});

store.addChangeListener( () => console.log('Changed') );

store.people.alice.age = 23; // Will print 'Changed' in the console!
```

ORS is intended to be the single store where centralize all the data of a JavaScript application, it's the simplest way of manage the state: Just use it and listen to changes to update your UI. See how it works.

## Installation
```sh
npm install --save @arqex/ors
```

## Usage
```js
// Import the library
import ors from '@arqex/ors'

// Create a store
let store = ors({
  people: {
    alice: { age: 12, children: [] },
    bob: { age: 38, children: ['alice']  }
  }
});

// We can read from the store like if it was a standard JS object
let alice = store.people.alice;
console.log( alice.age ); // prints out 12

// Listen to changes
store.addChangeListener( () => console.log('Store updated') );

// We can listen to changes in any node
store.people.bob.addChangeListener( () => console.log('Bob updated') );

// Updates can be done like if it was a standard JS object
store.people.bob.children.push('chris'); // This will emit events

console.log( store.people.bob.children[1] ); // Prints out > 'chris'

// Multiple updates in the same cycle are batched and they
// will emit events just once
store.people.bob.age = 39;

//... on the following tick, events are emitted so the console print out
//    in ascending order:
// > 'Bob updated'
// > 'Store updated'
```

## How does ORS work?

ORS has 3 main features. They are probably all the features it has and that makes it simple and powerful.

### Feature 1: It looks like a standard JS object

ORS is really simple to use because we don't need to learn any methods or strategy to make it work. It loks like just any other object:

```js
let store = ors({
  people: [
    {name: 'Jude', age: 20}
  ];
});

// We can access the data like if it was a standard JS object:
store.people[0].name; // Jude

// We can update it as we update any other object
store.people[0].age = 21;
store.people[0].age; // 21

// We can use all array methods
let jude = store.people.pop();
jude; // {name: 'Jude', age: 21}
store.people.length; // 0
```

The stores look like JS standard objects, but they really aren't. Objects and arrays are used as baseIn the background, it uses JS Proxies to keep track of the changes and spread them up through the store.

 but it regenerates when a node gets updated and emit change events.


It has some features that makes it the simplest way of managing the state:
It looks like a standard JS object.
It's completely observable. We can listen for updates at any node, and change events are triggered in the parent nodes when children are updated.
When a child is updated, the whole branch that contains it gets regenerated after the change event, making simpler to use memoization to derive data.


## Usage
To be documented...

## Compatibility
These are the **minimum browser versions** to make ORS work:
<table>
  <tr>
    <td>Chrome</td>
    <td>Firefox</td>
    <td>Edge</td>
    <td>IE</td>
    <td>Safari</td>
  </tr>
  <tr>
    <td>49</td>
    <td>18</td>
    <td>12</td>
    <td>Won't work</td>
    <td>10</td>
  </tr>
</table>

 **Mobile browsers**:
<table>
  <tr>
    <td>Android</td>
    <td>Chrome</td>
    <td>iOS Safari</td>
    <td>Samsung</td>
    <td>Opera</td>
  </tr>
  <tr>
    <td>49</td>
    <td>49</td>
    <td>10</td>
    <td>6.2</td>
    <td>30</td>
  </tr>
</table>

On **Node.js** it works **since version 6.5**.
