// Conditional definition to work also in the browser
// tests where ors is global
if( typeof ors == 'undefined' ){
	var ors = require('../src/ors');
}

// deactivates console.warn
// console.warn = function(){};

let data = {
	a: 1,
	b: { z: 0, y: 1, x:[ 'A', 'B'] },
	c: [1, 2, {w: 3}],
	d: null
};

let os;

describe( "ors", function(){
	
	beforeEach( function(){
		os = ors( data );
		ors.warn = jest.fn();
	});
	
	describe('basics', () => {
		it('Push and listen', done => {
			let os = ors({
				a: [1,2]
			});
	
			os.addChangeListener( updated => {
				expect( updated.a ).toEqual([1,2,3]);
				done();
			});
	
			os.a.push(3);
		});
	});

	describe('creation', () => {
		it( 'Create an ors object', function(){
			expect( data.a ).toEqual( os.a );
			expect( data.b.z ).toEqual( os.b.z );
			expect( data.b.x[0] ).toEqual( os.b.x[0] );
			expect( data.c[0] ).toEqual( os.c[0] );
			expect( data.c[2].w ).toEqual( os.c[2].w );
			expect( data.d ).toEqual( os.d);
		});

		it("State is mutable", function(){
			os.a = 'changed';
			expect(os.a).toBe('changed');
		});

		it("State is serializable", () => {
			expect( JSON.toString(data) ).toBe( JSON.toString(os) );
		})
	});

	describe('methods existence', () => {
		it( 'All methods in place', function(){
			expect( typeof os.emitChange ).toBe( "function" );
			expect( typeof os.addChangeListener ).toBe( "function" );
		});

		it( "Intermediate nodes also have methods", function(){
			expect( typeof os.b.x.emitChange ).toBe( "function" );
			expect( typeof os.b.x.addChangeListener ).toBe( "function" );
		});

		it( "New nodes also have methods", function(){
			os.newOne = {};

			expect( typeof os.newOne.emitChange ).toBe( "function" );
			expect( typeof os.newOne.addChangeListener ).toBe( "function" );
		});

		it( "Original methods are overridden", function(){
			os.newOne = {
				emit: 2,
				on: 2
			};

			expect(typeof os.newOne.emitChange ).toBe( "function");
			expect(typeof os.newOne.addChangeListener ).toBe( "function");
		});
	});


	describe('event emmiting', () => {
		it("State events are emitted on changes", function(done){
			os.addChangeListener( st => {
				expect(st).toEqual(os);
				expect(st.e).toBe('foo');
				expect(os.e).toBe('foo');
				done();
			});

			os.e = 'foo';
		});

		it("State events are emitted on delete", function (done) {
			os.addChangeListener( st => {
				expect(st).toEqual(os);
				expect(st.b).toBe(undefined);
				expect(os.b).toBe(undefined);
				done();
			});

			delete os.b;
		});

		it("State events are emitted on delete leaf", function(done){
			os.addChangeListener( st => {
				expect(st).toEqual(os);
				expect(st.b.z).toBe(undefined);
				expect(Object.keys(st.b).length).toBe(2);
				done();
			});

			delete os.b.z;
		});

		it('events are emitted in ascending order', function(done){
			let order = '';
			/*
			let os = ors({
				b: { x:[ 'A', 'B'] }
			});
			*/

			function listen( node, stamp ){
				node.addChangeListener( function(st) {
					order += stamp;
				});
			}

			listen( os, '1');
			listen( os.b, '2');
			listen( os.b.x, '3');

			os.b.x[2] = 'changed';

			setTimeout( () => {
				expect( order ).toBe('321');
				expect( os.b.x[2] ).toBe('changed');
				done();
			},20);
		});

		it("Add more than one listener to a node", function(done){
			let one, two;
			os.addChangeListener( function () { one = 1 });
			os.addChangeListener( function() { two = 2 });

			os.a = 2;

			setTimeout( function(){
				expect( one ).toBe( 1 );
				expect( two ).toBe( 2 );
				done();
			}, 10);
		});

		it("Remove listeners", function(){
			let called = '',
				listener = function(){
					called += '1';
				}
			;

			os.addChangeListener(listener);
			os.emitChange();
			os.removeChangeListener(listener );
			os.emitChange();

			expect(called).toBe('1');
		});

		it("Removing an unexistant listener doesn't affect others", function(){
			let called = '',
				listener = function () {
					called += '1';
				},
				listener2 = function() {
					called += '2';
				}
			;
			
			os.removeChangeListener(listener2);
			os.addChangeListener(listener);
			os.emitChange();
			os.removeChangeListener(listener2);
			os.emitChange();

			expect(called).toBe('11');
		});

		it("Changes in detached nodes don't emit events", function(done){
			let hits = 0,
				osbx = os.b.x
			;

			os.b.addChangeListener( function (b) {
				hits++;
			});

			osbx.push('C');

			setTimeout(() => {
				osbx.push('D')
			}, 100);
			setTimeout(() => {
				osbx.push('E')
			}, 200);

			setTimeout(() => {
				expect(os.b.x.length).toBe(3);
				expect(hits).toBe(1);
				done();
			}, 300);
		});

		it("Simultaneous changes in different levels should only trigger one state event", function(done){
			let once, twice;
			os.addChangeListener(() => {
				if(!once){
					once = true;
				}
				else {
					twice = true;
				}
			});

			os.e = true;
			os.b.x.push('C');

			setTimeout( () => {
				expect(twice).not.toBe(true);
				done();
			},10)
		});

		it("Changing the same leave twice in a tick only emit one state event with the second value", function(done){
			let once, twice;
			os.addChangeListener(st => {
				if (!once) {
					once = true;
				}
				else {
					twice = true;
				}
				expect(twice).not.toBe( true);
				expect( st.e).toBe(2 );
				done();
			});

			os.e = 1;
			expect(os.e).toBe(1);
			os.e = 2;
			expect(os.e).toBe(2);
		});

		it("Changing the same node multiple times during time, should emit multiple events in the generated nodes", done => {
			let listener = jest.fn();
			os.b.x.addChangeListener( listener);

			os.b.x.push('C');
			setTimeout( () => {
				os.b.x.push('D')
			}, 100 );
			setTimeout( () => {
				os.b.x.push('E')
			}, 200 );

			setTimeout( () => {
				expect( listener ).toHaveBeenCalledTimes(3);
				done();
			},300);
		});
	});

	describe('changes', () => {
		it("State changes are batched", function(done){
			let once = false;
			let twice = false;
			let timer;

			os.addChangeListener( st => {
				if( !once ){
					once = true;
				}
				else {
					twice = true;
				}

				if (!timer) {
					timer = setTimeout(() => {
						expect(st.b.z).toBe(10);
						expect(st.b.y).toBe(11);
						expect(st.b.x).toBe(12);
						expect(st.a).toBe(13);
						expect(os.b.z).toBe(10);
						expect(os.b.y).toBe(11);
						expect(os.b.x).toBe(12);
						expect(os.a).toBe(13);
						expect(twice).not.toBe( true);
						done();
					}, 20);
				}
			});

			os.b.z = 10;
			os.b.y = 11;
			os.b.x = 12;
			os.a = 13;
		});

		it('Preserve unchanged nodes', function(done){
			let data = {
				l1a: [
					{l3a:[1,2,3], l3b:[3,2,1], l3c:{a:{}, b:{}}},
					{}
				],
				l1b: {l2a:[{},{},{}], l2b:[{},{},{}], l2c:[{},{},{}]},
				l1c: []
			};

			// Let get a copy of every node related to the path changed
			let os = ors(data);
			let osl1a = os.l1a;
			let osl1b = os.l1b;
			let osl1c = os.l1c;
			let osl1a0 = os.l1a[0];
			let osl1a1 = os.l1a[1];
			let osl1a0l3a = os.l1a[0].l3a;
			let osl1a0l3b = os.l1a[0].l3b;
			let osl1a0l3c = os.l1a[0].l3c;
			let osl1a0l3ca = os.l1a[0].l3c.a;
			let osl1a0l3cb = os.l1a[0].l3c.b;
			

			os.addChangeListener( st => {
				// Nodes in the path changed needs to be different
				// but siblings needs to be the same objects

				expect(st.l1a).not.toBe( osl1a);
				expect(st.l1b).toBe(osl1b);
				expect(st.l1c).toBe(osl1c);

				expect(st.l1a[0]).not.toBe( osl1a0);
				expect(st.l1a[1]).toBe(osl1a1);
				
				expect(osl1a0l3a).toBe(st.l1a[0].l3a);
				expect(osl1a0l3b).toBe(st.l1a[0].l3b);
				expect(osl1a0l3c).not.toBe( st.l1a[0].l3c);

				expect(osl1a0l3ca).toBe(st.l1a[0].l3c.a);
				expect(osl1a0l3cb).not.toBe( st.l1a[0].l3c.b);

				done();
			});
			
			os.l1a[0].l3c.b = {};
		});

		it('Cant add root nodes to other os', function() {
			let os2 = ors({foo: 'bar'});
			let catched = false;

			try {
				os.os2 = os2;
			}
			catch( err) {
				catched = true;
			}

			expect( catched ).toBe( true );
		});

		it('Cant create loops in a os', () => {
			let catched = false;
			try {
				os.b.x.push( os.b );
			}
			catch (err) {
				catched = true;
			}
			expect( catched ).toBe( true );
		});

		it("Conserve listeners on changes", function(done){
			let hits = 0,
				osb = os.b
			;
			
			os.b.addChangeListener( function(b){
				osb = b;
				hits++;
			});

			os.b.x.push('C');
			setTimeout(() => osb.x.push('D'), 20);
			setTimeout(() => osb.x.push('E'), 40);
			setTimeout(() => osb.x.push('F'), 60);

			setTimeout( () => {
				expect( osb.x.length).toBe(6 );
				expect( hits).toBe(4 );
				done();
			}, 80);
		});

		it("Nested updates can be accessible from the root node", function(done){
			os.addChangeListener( st => {
				expect(st.c.w).toBe(4);
				done();
			});

			os.c.w = 4;
		});

		it("Update object node should update its keys", function(){
			os.b.other = 'new';
			let keys = Object.keys(os.b);
			expect(keys.length).toBe(4);
		});

		it("Update array node should update its keys", function () {
			os.c.push(4);
			
			let count = 0;
			for( let i in os.c ){
				count++;
			}
			
			os.c.forEach( value => {
				count++;
			});
			
			expect(count).toBe(8);
		});

		it("Adding objects to the root should trigger events in the root", done => {
			let listener = jest.fn();
			os.addChangeListener( listener );

			os.obj1 = {};
			os.obj2 = {};

			setTimeout( () => {
				os.obj2.foo = 'bar';
			}, 100);

			setTimeout( () => {
				expect( listener ).toHaveBeenCalledTimes( 2 );
				done();
			}, 200);
		});
		
		it("Adding objects to a branch should trigger events in the root", done => {
			let listener = jest.fn();
			os.addChangeListener( listener );

			os.b.obj1 = {};
			os.b.obj2 = {};

			setTimeout( () => {
				os.b.obj2.foo = 'bar';
			}, 100);

			setTimeout( () => {
				expect( listener ).toHaveBeenCalledTimes( 2 );
				done();
			}, 200);
		});
	});
	
	describe('internals', () => {
		it("Mark event should be kept in the root node", function(done){
			os.addChangeListener( () => {
				if( os.e < 2 ){
					os.e++;
				}
				else {
					expect(os.e).toBe(2);
					done();
				}
			});
			os.e = 0;
		});

		it("Parents need to be set ok", () => {
			expect( os.b.__.parents.has(os.__) ).toBe( true );
			expect( os.c.__.parents.has(os.__) ).toBe( true );
			expect( os.b.__.parents.size).toBe( 1 );
			expect( os.c.__.parents.size).toBe( 1 );

			expect( os.b.x.__.parents.has(os.b.__) ).toBe( true );
			expect( os.b.x.__.parents.size).toBe( 1 );

			expect( os.c[2].__.parents.has(os.c.__) ).toBe( true );
			expect( os.c[2].__.parents.size ).toBe( 1 );
		});

		it("Root children need to point the root as parent", function( done ){
			os.addChangeListener( () => {
				Object.keys(os).forEach( key => {
					if( os[key] && os[key].__ ){
						expect(os[key].__.parents.has(os.__)).toBe(true);
					}
				});
				done();
			});
			os.c.w = 4;
		});

		it("Root node should keep semi-mutable", function( done ){
			os.e = 1;
			setTimeout(() => {
				expect(os.e).toBe(1);
				expect(os.__.update).toBe(undefined);
				done();
			});
		});

		it('Updated nodes should point to the new parent', done => {
			let osb = os.b;
			let osbx = os.b.x;

			os.addChangeListener( () => {
				expect( os.b ).not.toBe( osb );
				expect( os.b.x ).toBe( osbx );
				expect( os.b.w.__.parents.has( os.b.__ ) ).toBe( true );
				expect( os.b.x.__.parents.has( os.b.__ ) ).toBe( true );
				done();
			});

			os.b.w = {foo: 'bar'};
		})
	});

	describe('array methods', () => {
		it('splice', done => {
			let osc = os.c;

			os.c.splice(1,2,'hola');
			expect( os.c ).toEqual([1,'hola']);

			setTimeout(() => {
				expect( os.c ).toEqual([1,'hola']);
				expect( osc ).not.toBe( os.c );
				done();
			}, 100);
		});
	});

	describe('repeated nodes', () => {
		it("Add a oS node to the object is ok if there are no loops", function(done){
			let thrown = false;
			try {
				os.e = os.b;
			}
			catch( err ){
				thrown = true;
			}

			setTimeout( function(){
				expect(os.e).toBe(os.b);
				expect(thrown).toBe( false );
				done();
			},10);
		});

		it("Updating a repeating node should also update the copy", done => {
			os.e = os.b;

			setTimeout( () => {
				os.b.x.push('C');
			}, 100);

			setTimeout( () => {
				expect( os.e.x.length ).toBe(3);
				expect( os.e.x[2] ).toBe('C');
				done();
			}, 200)
		});

		it("Updating a repeating node should emit events in all the nodes", done => {
			let listenerb = jest.fn();
			let listenerx = jest.fn();
			
			os.b.addChangeListener( listenerb );
			os.b.x.addChangeListener( listenerx );

			os.e = os.b.x;
			setTimeout( () => {
				os.e.push('C')
			}, 100);
			setTimeout( () => {
				expect( listenerb ).toHaveBeenCalledWith( os.b );
				expect( listenerx ).toHaveBeenCalledWith( os.e );
				done();
			}, 200);
		})
	});




	
});


