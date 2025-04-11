import * as THREE from 'three';

const _changeEvent = { type: 'change' };

class WalkControls extends THREE.EventDispatcher {

	constructor( object, domElement, objects ) {

		super();

		if ( domElement === undefined ) {

			console.warn( 'WalkControls: The second parameter "domElement" is now mandatory.' );
			domElement = document;

		}

		this.object = object;
		this.domElement = domElement;
		this.objects = objects;

		// API

		this.gravity = -0.981
		this.movementSpeed = 10.0;
		this.rollSpeed = 0.01;
		this.isMouseActive = false;

		// disable default target object behavior

		// internals

		const scope = this;

		const EPS = 0.000001;

		const lastQuaternion = new THREE.Quaternion();
		const lastPosition = new THREE.Vector3();

		this.raycaster = new THREE.Raycaster();

		this.moveState = { left: 0, right: 0, forward: 0, back: 0, up: 0, down: 0, pitchUp: 0, pitchDown: 0, yawLeft: 0, yawRight: 0};
		this.moveVector = new THREE.Vector3( 0, 0, 0 );
		this.rotationVector = new THREE.Vector3( 0, 0, 0 );
		this.eulerVector = new THREE.Euler(0, 0, 0, 'YXZ');

		this.touchCount = 0;
		this.touchPosition = new THREE.Vector3(0, 0, 0);

		this.keydown = function ( event ) {

			if ( event.altKey ) {

				return;

			}

			let active = false;

			switch ( event.code ) {

				case 'KeyW': this.moveState.forward = 1; active = true; break;
				case 'KeyS': this.moveState.back = 1; active = true; break;

				case 'KeyA': this.moveState.left = 1; active = true; break;
				case 'KeyD': this.moveState.right = 1; active = true; break;

				case 'ArrowUp': this.moveState.pitchUp = 1; active = true; break;
				case 'ArrowDown': this.moveState.pitchDown = 1; active = true; break;

				case 'ArrowLeft': this.moveState.yawLeft = 1; active = true; break;
				case 'ArrowRight': this.moveState.yawRight = 1; active = true; break;

			}

			if (active) {
				this.updateMovementVector();
				this.updateRotationVector();
			}

		};

		this.keyup = function ( event ) {

			let active = false;

			switch ( event.code ) {

				case 'KeyW': this.moveState.forward = 0; active = true; break;
				case 'KeyS': this.moveState.back = 0; active = true; break;

				case 'KeyA': this.moveState.left = 0; active = true; break;
				case 'KeyD': this.moveState.right = 0; active = true; break;

				case 'ArrowUp': this.moveState.pitchUp = 0; active = true; break;
				case 'ArrowDown': this.moveState.pitchDown = 0; active = true; break;

				case 'ArrowLeft': this.moveState.yawLeft = 0; active = true; break;
				case 'ArrowRight': this.moveState.yawRight = 0; active = true; break;
			}

			if (active) {
				this.updateMovementVector();
				this.updateRotationVector();
			}

		};

		this.mousedown = function ( event ) {

			if(this.isMouseActive)
			{
				switch ( event.button ) {

					case 0: this.moveState.forward = 1; break;
					case 2: this.moveState.back = 1; break;
				}

				this.updateMovementVector();
			}
		};

		this.mousemove = function ( event ) {

			if(this.isMouseActive)
			{
				this.moveState.yawLeft = -event.movementX;
				this.moveState.pitchDown = event.movementY;

				this.updateRotationVector();
				this.updateMovementVector();
			}
		};

		this.mouseup = function ( event ) {

			if(this.isMouseActive)
			{
				switch ( event.button ) {

					case 0: this.moveState.forward = 0; break;
					case 2: this.moveState.back = 0; break;
				}

				this.updateMovementVector();
			}
		};

		this.touchstart = function(event){
			this.touchCount = event.targetTouches.length;
			this.touchPosition.x = event.targetTouches[0].screenX;
			this.touchPosition.y = event.targetTouches[0].screenY;

			console.log('start: ' + this.touchCount);

			this.moveState.forward = this.touchCount > 1? 1.0 : 0.0;
			this.updateMovementVector();
		};

		this.touchend = function(event){
			this.touchCount = event.targetTouches.length;
			console.log('end: ' + this.touchCount);

			this.moveState.forward = this.touchCount > 1? 1.0 : 0.0;
			this.updateMovementVector();
		};

		this.touchcancel = function(event){
			this.touchCount = event.targetTouches.length;
			console.log('cancel: ' + this.touchCount);

			this.moveState.forward = this.touchCount > 1? 1.0 : 0.0;
			this.updateMovementVector();
		};

		this.touchmove = function(event){
			if(this.touchCount > 0)
			{
				this.moveState.yawLeft = event.targetTouches[0].screenX - this.touchPosition.x;
				this.moveState.pitchDown = this.touchPosition.y - event.targetTouches[0].screenY;

				this.touchPosition.x = event.targetTouches[0].screenX;
				this.touchPosition.y = event.targetTouches[0].screenY;

				this.updateRotationVector();
				this.updateMovementVector();
			}
		};

		this.update = function ( delta ) {

			const moveMult = delta * scope.movementSpeed;
			const rotMult = scope.rollSpeed;

			// walls
			for (let i = 0; i < 2; i++) { // assume worst case is 2 walls 
				scope.raycaster.set(scope.object.position, scope.moveVector);
				const moveIntersects = scope.raycaster.intersectObjects(scope.objects, true);

				if (moveIntersects.length) {
					const collision = moveIntersects[0];
					if (collision.distance < 0.5) {
						const normal = collision.face.normal.clone().applyQuaternion(collision.object.quaternion);
						scope.moveVector.sub(normal.multiplyScalar(scope.moveVector.dot(normal)))
					}
				}
			}

			// ground
			let gravity = scope.gravity * moveMult;

			scope.raycaster.set(scope.object.position, new THREE.Vector3(0, -1, 0));
			const groundIntersects = scope.raycaster.intersectObjects(scope.objects, true);

			if (groundIntersects.length) {
				const collision = groundIntersects[0];
				if (collision.distance <= 1 + Math.abs(gravity)) {
					gravity = 1 - collision.distance;
				}
			}

			scope.object.position.y += gravity;

			scope.object.position.x += scope.moveVector.x * moveMult;
			scope.object.position.y += scope.moveVector.y * moveMult;
			scope.object.position.z += scope.moveVector.z * moveMult;

			scope.eulerVector.x += scope.rotationVector.x * rotMult;
			scope.eulerVector.y += scope.rotationVector.y * rotMult;
			scope.eulerVector.z = 0.0;

			scope.eulerVector.x = Math.min(Math.max(scope.eulerVector.x, -Math.PI * 0.5), Math.PI * 0.5);

			scope.object.quaternion.setFromEuler(scope.eulerVector);

			scope.rotationVector.x = 0.0;
			scope.rotationVector.y = 0.0;
			scope.rotationVector.z = 0.0;

			if (
				lastPosition.distanceToSquared( scope.object.position ) > EPS ||
				8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS
			) {

				scope.dispatchEvent( _changeEvent );
				lastQuaternion.copy( scope.object.quaternion );
				lastPosition.copy( scope.object.position );

			}

		};

		this.updateMovementVector = function () {
			const quaternion = scope.object.quaternion.clone();
			quaternion.x = 0;
			quaternion.z = 0;

			this.moveVector.set(
				- this.moveState.left + this.moveState.right,
				- this.moveState.down + this.moveState.up,
				- this.moveState.forward + this.moveState.back,
			).applyQuaternion(quaternion).normalize();
		};

		this.updateRotationVector = function () {
			this.rotationVector.x = ( - this.moveState.pitchDown + this.moveState.pitchUp );
			this.rotationVector.y = ( - this.moveState.yawRight + this.moveState.yawLeft );

			this.moveState.pitchDown = 0;
			this.moveState.pitchUp = 0;
			this.moveState.yawRight = 0;
			this.moveState.yawLeft = 0;
		};

		this.getContainerDimensions = function(){
			if(this.domElement != document)
			{
				return {
					size: [ this.domElement.offsetWidth, this.domElement.offsetHeight ],
					offset: [ this.domElement.offsetLeft, this.domElement.offsetTop ]
				};

			}
			else
			{
				return {
					size: [ window.innerWidth, window.innerHeight ],
					offset: [ 0, 0 ]
				};
			}
		};

		this.dispose = function(){
			this.domElement.removeEventListener( 'contextmenu', contextmenu );
			this.domElement.removeEventListener( 'mousedown', _mousedown );
			this.domElement.removeEventListener( 'mousemove', _mousemove );
			this.domElement.removeEventListener( 'mouseup', _mouseup );

			this.domElement.removeEventListener("touchstart", _touchstart);
			this.domElement.removeEventListener("touchend", _touchend);
			this.domElement.removeEventListener("touchcancel", _touchcancel);
			this.domElement.removeEventListener("touchmove", _touchmove);

			window.removeEventListener( 'keydown', _keydown );
			window.removeEventListener( 'keyup', _keyup );
		};

		const _mousemove = this.mousemove.bind( this );
		const _mousedown = this.mousedown.bind( this );
		const _mouseup = this.mouseup.bind( this );
		const _touchstart = this.touchstart.bind( this );
		const _touchend = this.touchend.bind( this );
		const _touchcancel = this.touchcancel.bind( this );
		const _touchmove = this.touchmove.bind( this );
		const _keydown = this.keydown.bind( this );
		const _keyup = this.keyup.bind( this );

		this.domElement.addEventListener( 'contextmenu', contextmenu );

		this.domElement.addEventListener( 'mousemove', _mousemove );
		this.domElement.addEventListener( 'mousedown', _mousedown );
		this.domElement.addEventListener( 'mouseup', _mouseup );

		this.domElement.addEventListener("touchstart", _touchstart, false);
		this.domElement.addEventListener("touchend", _touchend, false);
		this.domElement.addEventListener("touchcancel", _touchcancel, false);
		this.domElement.addEventListener("touchmove", _touchmove, false);

		window.addEventListener( 'keydown', _keydown );
		window.addEventListener( 'keyup', _keyup );

		this.updateMovementVector();
		this.updateRotationVector();
	}
}

function contextmenu(event)
{
	event.preventDefault();
}

export { WalkControls };
