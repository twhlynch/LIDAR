import * as THREE from 'three';
import * as SHADERS from './shaders.js';
import { WalkControls } from './walk_controls.js';
import { FreeControls } from './free_controls.js';

let clock, camera, scene, renderer, controls, raycaster, fly;

const MAX_POINTS = 1_000_000;
const MAZE_SIZE = 21;

let objects = [];
let mainMaterial;
let nextPointIndex = 0;
let pointsObject;
let scanning = false;
let pattern = 1;
let DEBUG = false;

let enemy;

init();

// #region init
async function init() {
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
	controls = new WalkControls(camera, renderer.domElement, objects);
	fly = new FreeControls(camera, renderer.domElement);
	raycaster = new THREE.Raycaster();
	camera.position.set(2, 2, -2);

	scene.add(new THREE.AmbientLight(0x404040));
	scene.add(new THREE.DirectionalLight(0xffffff, 0.5));

	// setup events
	window.addEventListener('resize', resize);
	window.addEventListener('keydown', keydown);
	window.addEventListener('keyup', keyup);
	window.addEventListener('click', click);
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

	// enemy
	const enemyVertices = new Float32Array(20 * 3 * 3);
	for(let i = 0; i < 20 * 3 * 3; i++) {
		enemyVertices[i] = (Math.random() - 0.5);
	}
	const enemyGeometry = new THREE.BufferGeometry();
	enemyGeometry.setAttribute('position', new THREE.BufferAttribute(enemyVertices, 3));
	enemy = new THREE.Mesh(enemyGeometry, mainMaterial);
	enemy.scale.y = 5;
	enemy.userData.pointColor = new THREE.Color(1, 0, 0);
	scene.add(enemy);
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
	scene.add(goal);
	objects.push(goal);

	// setup UI
	const scannerButton = document.getElementById('scanner');
	scannerButton.addEventListener('click', () => {
		scanning = !scanning;
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

	if (scanning) scan()

	enemy.position.lerp(camera.position, 0.1 * delta);

	renderer.render(scene, camera);
}

// #region scan
function scan() {
	[
		// 0: skip
		() => {},
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
	const size = 21;

	const maze = Array.from({ length: MAZE_SIZE }, () => Array(MAZE_SIZE).fill(false));
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