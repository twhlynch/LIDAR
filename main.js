import * as THREE from 'three';
import * as SHADERS from './shaders.js';
import { WalkControls } from './walk_controls.js';
import { FreeControls } from './free_controls.js';

let clock, camera, scene, renderer, controls, raycaster, fly;

const MAX_POINTS = 1_000_000;
const MAZE_SIZE = 21;

let objects;
let collisionObjects;
let interactionObjects;
let mainMaterial;
let nextPointIndex;
let pointsObject;
let scanning;
let pattern;
let DEBUG;
let joystickPosition;
let health;
let collisionRaycaster;

let enemy;
let maze;

init();

// #region init
async function init() {
	// basic setup
	objects = [];
	collisionObjects = [];
	interactionObjects = [];
	nextPointIndex = 0;
	scanning = false;
	pattern = 1;
	DEBUG = false;
	joystickPosition = {x: 0, y: 0, changed: false};

	// setup renderer
	renderer = new THREE.WebGLRenderer({
		antialias: true,
		preserveDrawingBuffer: true,
		alpha: true,
	});
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setAnimationLoop(render);
	document.body.appendChild(renderer.domElement);

	// setup scene
	clock = new THREE.Clock();
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
	controls = new WalkControls(camera, renderer.domElement, collisionObjects);
	fly = new FreeControls(camera, renderer.domElement);
	raycaster = new THREE.Raycaster();
	camera.position.set(2, 2, -2);

	scene.add(new THREE.AmbientLight(0x404040));
	scene.add(new THREE.DirectionalLight(0xffffff, 0.5));

	// setup events
	window.addEventListener('resize', resize);
	window.addEventListener('keydown', keydown);
	window.addEventListener('keyup', keyup);
	renderer.domElement.addEventListener('click', click);
	document.addEventListener('pointerlockchange', pointerLockChange);

	// setup points
	let particleMaterial = new THREE.ShaderMaterial({
		vertexShader: SHADERS.particleVS,
		fragmentShader: SHADERS.particleFS,
	});
	particleMaterial.flatShading = true;

	const positions = new Float32Array(MAX_POINTS * 3);
	const colors = new Float32Array(MAX_POINTS * 3);

	for (let i = 0; i < MAX_POINTS * 3; i++) {
		positions[i] = 1_000_000;
	}

	let particleGeometry = new THREE.BufferGeometry();
	particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

	pointsObject = new THREE.Points(particleGeometry, particleMaterial);
	pointsObject.frustumCulled = false;

	scene.add(pointsObject);

	// add objects
	mainMaterial = new THREE.MeshBasicMaterial({
		color: 0x00ff00,
		wireframe: true,
		transparent: true,
		opacity: 0
	});

	const scale = 5;
	// maze
	const mazeGeometry = generateMaze();
	const maze = new THREE.Mesh(mazeGeometry, mainMaterial);
	maze.rotation.x = -Math.PI / 2;
	maze.scale.set(scale, scale, scale);
	scene.add(maze);
	objects.push(maze);
	collisionObjects.push(maze);

	// enemy
	const enemyGeometry =new THREE.ConeGeometry(1, 5, 16);
	enemy = new THREE.Mesh(enemyGeometry, mainMaterial);
	enemy.position.set(
		(MAZE_SIZE - 2) * scale,
		2,
		-(MAZE_SIZE - 1) * scale + scale,
	);
	enemy.userData.pointColor = new THREE.Color(1, 0, 0);
	enemy.userData.isEnemy = true;
	scene.add(enemy);
	interactionObjects.push(enemy);
	objects.push(enemy);

	// goal
	const goalGeometry = new THREE.ConeGeometry(1, 5, 16);
	const goal = new THREE.Mesh(goalGeometry, mainMaterial);
	goal.position.set(
		(MAZE_SIZE - 2) * scale,
		2,
		-(MAZE_SIZE - 1) * scale + scale,
	);
	goal.userData.pointColor = new THREE.Color(0, 1, 0);
	goal.userData.isGoal = true;
	scene.add(goal);
	interactionObjects.push(goal);
	objects.push(goal);

	// HP
	collisionRaycaster = new THREE.Raycaster();
	health = 100;

	// setup UI
	const scannerButton = document.getElementById('scanner');
	scannerButton.addEventListener('click', () => {
		scanning = !scanning;
	});

	const joystick = document.getElementById('joystick');
	const joystickButton = joystick.children[0];
	const maxLength = joystick.clientWidth / 2;
	joystick.addEventListener('touchmove', (e) => {
		const joystickCenterX = joystick.offsetLeft + maxLength;
		const joystickCenterY = joystick.offsetTop + maxLength;
		let X = Math.max(
			joystick.offsetLeft,
			Math.min(
				e.touches[0].clientX, 
				joystick.offsetLeft + joystick.clientWidth
			)
		) - joystickCenterX;
		let Y = Math.max(
			joystick.offsetTop,
			Math.min(
				e.touches[0].clientY, 
				joystick.offsetTop + joystick.clientHeight
			)
		) - joystickCenterY;

		const length = Math.sqrt(X*X + Y*Y);
		if (length > maxLength) {
			X = (X / length) * maxLength;
			Y = (Y / length) * maxLength;
		}

		joystickButton.style.left = X + 'px';
		joystickButton.style.top = Y + 'px';
		joystickPosition.x = X;
		joystickPosition.y = Y;
		joystickPosition.changed = true;
	});
	joystick.addEventListener('touchend', (e) => {
		joystickButton.style.left = '0px';
		joystickButton.style.top = '0px';
		joystickPosition.x = 0;
		joystickPosition.y = 0;
		joystickPosition.changed = true;
	});
}

// #region events
function resize() {
	let SCREEN_HEIGHT = window.innerHeight;
	let SCREEN_WIDTH = window.innerWidth;

	camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
	camera.updateProjectionMatrix();

	renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
}
function keydown(e) {
	if (e.code === "Space") {
		scanning = true;
	} else if (e.code.startsWith("Digit")) {
		pattern = parseInt(e.code.slice(5));
	} else if (e.code === "KeyP") {
		DEBUG = !DEBUG;
		mainMaterial.opacity = DEBUG ? 1 : 0;
	}
} 
function keyup(e) {
	if (e.code === "Space") {
		scanning = false;
	}
}
function click() {
	renderer.domElement.requestPointerLock();
}
function pointerLockChange() {
	controls.isMouseActive = (document.pointerLockElement === renderer.domElement);
	fly.isMouseActive = (document.pointerLockElement === renderer.domElement);
}

// #region render
function render() {
	const delta = clock.getDelta();

	if (DEBUG) fly.update(delta);
	else controls.update(delta);

	if (scanning) scan();

	if (joystickPosition.changed) {
		controls.moveState.forward = joystickPosition.y < -20;
		controls.moveState.back = joystickPosition.y > 20;
		controls.moveState.right = joystickPosition.x > 20;
		controls.moveState.left = joystickPosition.x < -20;
		controls.updateMovementVector();

		fly.moveState.forward = joystickPosition.y < -20;
		fly.moveState.back = joystickPosition.y > 20;
		fly.moveState.right = joystickPosition.x > 20;
		fly.moveState.left = joystickPosition.x < -20;
		fly.updateMovementVector();

		joystickPosition.changed = false;
	}

	const difference = new THREE.Vector3().subVectors(camera.position, enemy.position);
	const distance = difference.length();
	const direction = difference.normalize();
	const speed = Math.max(distance * 0.1, 2) * delta;
	enemy.position.addScaledVector(direction, speed);

	collisionRaycaster.set(new THREE.Vector3(0, 10, 0).add(camera.position), new THREE.Vector3(0, -1, 0));
	const intersects = collisionRaycaster.intersectObjects(interactionObjects, true);
	if (intersects.length) {
		const collision = intersects[0];
		if (collision.object.userData.isEnemy) {
			health--;
			document.getElementById('health').children[0].style.width = health + '%';
		}
	}

	renderer.render(scene, camera);
}

// #region scan
function scan() {
	[
		// 0: maze
		() => {
			for (let i = 0; i < MAZE_SIZE; i++) {
				for (let j = 0; j < MAZE_SIZE; j++) {
					const x = 0.02 * (i - (MAZE_SIZE / 2 | 0));
					const y = 0.02 * (j - (MAZE_SIZE / 2 | 0));
					if (!maze[i][j]) scanRay(x / camera.aspect, y);
				}	
			}
			const X = 0.02 * (camera.position.x / 5 - (MAZE_SIZE / 2 | 0))
			const Y = 0.02 * (-camera.position.z / 5 - (MAZE_SIZE / 2 | 0))
			for (let i = 0; i < 5; i++) {
				scanRay(
					(X + (Math.random() - 0.5) * 0.01) / camera.aspect,
					Y + (Math.random() - 0.5) * 0.01
				);
			}
		},
		// 1: circle
		() => {
			const start = Math.random();
			for (let i = 0; i < 200; i++) {
				const angle = i * Math.PI * (3 - Math.sqrt(5)) + start;
				const radius = 0.01 * Math.sqrt(i);
				const x = radius * Math.cos(angle) + Math.random() * 0.02;
				const y = radius * Math.sin(angle) + Math.random() * 0.02;

				scanRay(x / camera.aspect, y);
			}
		},
		// 2: square
		() => {
			for (let i = -4; i <= 4; i++) {
				for (let j = -4; j <= 4; j++) {
					const x = (Math.random() + i) * 0.04;
					const y = (Math.random() + j) * 0.04;

					scanRay(x / camera.aspect, y);
				}
			}
		},
		// 3: horizontal line
		() => {
			for (let i = -4; i <= 4; i++) {
				for (let j = -4; j <= 4; j++) {
					const x = (Math.random() + i) * 0.1;
					const y = (Math.random() + j) * 0.004;
					scanRay(x / camera.aspect, y);
				}
			}
		},
		// 4: verticle line
		() => {
			for (let i = -4; i <= 4; i++) {
				for (let j = -4; j <= 4; j++) {
					const x = (Math.random() + i) * 0.004;
					const y = (Math.random() + j) * 0.1;

					scanRay(x / camera.aspect, y);
				}
			}
		},
		// 5: dot
		() => {
			scanRay(0, 0);
		},
		// 6: dense vertical line
		() => {
			for (let i = -1; i <= 1; i++) {
				for (let j = -10; j <= 10; j++) {
					const x = (Math.random() + i) * 0.004;
					const y = (Math.random() + j) * 0.1;

					scanRay(x / camera.aspect, y);
				}
			}
		},
		// 7: screen
		() => {
			for (let i = -10; i <= 10; i++) {
				for (let j = -10; j <= 10; j++) {
					const x = (Math.random() + i) * 0.1;
					const y = (Math.random() + j) * 0.1;

					scanRay(x, y);
				}
			}
		},
		// 8: skip
		() => {},
		// 9: skip
		() => {},
	][pattern]();
}

// #region maze
function generateMaze() {
	maze = Array.from({ length: MAZE_SIZE }, () => Array(MAZE_SIZE).fill(false));
	const visited = Array.from({ length: MAZE_SIZE }, () => Array(MAZE_SIZE).fill(false));

	const directions = [
		[0, 1],
		[1, 0],
		[0, -1],
		[-1, 0],
	];

	function isValid(x, y) {
		return x > 0 && x < MAZE_SIZE - 1 && y > 0 && y < MAZE_SIZE - 1 && !visited[x][y];
	}

	function getOptions(x, y) {
		return directions.filter(([dx, dy]) => {
			const nx = x + dx * 2;
			const ny = y + dy * 2;
			const wx = x + dx;
			const wy = y + dy;
		
			return isValid(nx, ny) && isValid(wx, wy);
		});
	}

	function dfs(x, y) {
		visited[x][y] = true;
		maze[x][y] = true;

		const options = getOptions(x, y).sort(() => Math.random() - 0.5);
		for (const [dx, dy] of options) {
			const nx = x + dx * 2;
			const ny = y + dy * 2;
			const wx = x + dx;
			const wy = y + dy;
		
			if (!visited[nx][ny]) {
				maze[wx][wy] = true;
				dfs(nx, ny);
			}
		}
	}

	dfs(MAZE_SIZE - 2, MAZE_SIZE - 2);

	console.log(maze.map(row => row.map(Number).join('')).join('\n'));

	const geometry = new THREE.BufferGeometry();

	const vertices = [];
	
	for (let i = 0; i < MAZE_SIZE; i++) {
		for (let j = 0; j < MAZE_SIZE; j++) {
			const cell = maze[i][j];
			if (cell === false) {
				for (let [dx, dy] of directions) {
					const nx = i + dx;
					const ny = j + dy;
					if (
						nx >= 0 && nx < MAZE_SIZE &&
						ny >= 0 && ny < MAZE_SIZE &&
						maze[nx][ny] === false
					) {
						vertices.push(i);
						vertices.push(j);
						vertices.push(0);

						vertices.push(i);
						vertices.push(j);
						vertices.push(10);

						vertices.push(nx);
						vertices.push(ny);
						vertices.push(0);

						vertices.push(nx);
						vertices.push(ny);
						vertices.push(0);

						vertices.push(i);
						vertices.push(j);
						vertices.push(10);

						vertices.push(nx);
						vertices.push(ny);
						vertices.push(10);

					}
				}
			}
		}
	}

	// floor
	vertices.push(0);
	vertices.push(MAZE_SIZE - 1);
	vertices.push(0);

	vertices.push(0);
	vertices.push(0);
	vertices.push(0);

	vertices.push(MAZE_SIZE - 1);
	vertices.push(MAZE_SIZE - 1);
	vertices.push(0);

	vertices.push(MAZE_SIZE - 1);
	vertices.push(MAZE_SIZE - 1);
	vertices.push(0);

	vertices.push(0);
	vertices.push(0);
	vertices.push(0);

	vertices.push(MAZE_SIZE - 1);
	vertices.push(0);
	vertices.push(0);

	geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))

	return geometry;
}

// #region functions
function scanRay(x, y) {
	raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
	let intersects = raycaster.intersectObjects(objects, true);
	if (intersects.length) addPoint(intersects[0].point, intersects[0].object.userData.pointColor);
}

function addPoint(point, color = new THREE.Color(1, 1, 1)) {
	const pointColor = color?.clone() || new THREE.Color(1, 1, 1);
	pointColor.r *= 1 + Math.random() * 0.2 - 0.1;
	pointColor.g *= 1 + Math.random() * 0.2 - 0.1;
	pointColor.b *= 1 + Math.random() * 0.2 - 0.1;

	const positions = pointsObject.geometry.attributes.position.array;
	const colors = pointsObject.geometry.attributes.color.array;

	positions[nextPointIndex * 3] = point.x;
	positions[nextPointIndex * 3 + 1] = point.y;
	positions[nextPointIndex * 3 + 2] = point.z;

	colors[nextPointIndex * 3] = pointColor.r;
	colors[nextPointIndex * 3 + 1] = pointColor.g;
	colors[nextPointIndex * 3 + 2] = pointColor.b;

	pointsObject.geometry.attributes.position.needsUpdate = true;
	pointsObject.geometry.attributes.color.needsUpdate = true;

	nextPointIndex = nextPointIndex === MAX_POINTS - 1 ? 0 : nextPointIndex + 1;
}