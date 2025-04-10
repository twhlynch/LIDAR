import * as THREE from 'three';
import * as SHADERS from './shaders.js';
import { FreeControls } from './free_controls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let clock, camera, scene, renderer, controls, loader, raycaster;

const MAX_POINTS = 1_000_000;

let objects = [];
let mainMaterial;
let nextPointIndex = 0;
let pointsObject;
let scanning = false;
let pattern = 1;

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
	controls = new FreeControls(camera, renderer.domElement);
	raycaster = new THREE.Raycaster();
	camera.position.set(0, 0, 37);

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

	loader = new GLTFLoader();

	// const map = await loadModel('map.glb');
	// scene.add(map);
	// objects.push(map);

	const planeGeometry = new THREE.PlaneGeometry(1000, 1000);
	const plane = new THREE.Mesh(planeGeometry, mainMaterial);
	plane.position.set(0, -100, 0);
	plane.rotation.x = -Math.PI / 2
	scene.add(plane);
	objects.push(plane);

	for (let i = 0; i < 10; i++) {
		const geometry = new THREE.TorusKnotGeometry( 10, 3, 10, 6 );
		const object = new THREE.Mesh(geometry, mainMaterial);

		object.position.set(
			Math.random() * 100 - 50,
			Math.random() * 100 - 50,
			Math.random() * 100 - 50
		);

		object.userData.pointColor = new THREE.Color(
			Math.random(),
			Math.random(),
			Math.random()
		);

		scene.add(object);
		objects.push(object);
	}

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
}

// #region render
function render() {
	const delta = clock.getDelta();

	controls.update(delta);

	if (scanning) scan()

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

// #region functions
function scanRay(x, y) {
	raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
	let intersects = raycaster.intersectObjects(objects, true);
	if (intersects.length) addPoint(intersects[0].point, intersects[0].object.userData.pointColor);
}

function addPoint(point, color) {
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

function loadModel(path) {
	return new Promise((resolve) => {
		loader.load(path, function (gltf) {
			let object = gltf.scene.children[0];
			object.traverse((node) => {
				if (node instanceof THREE.Mesh) {
					node.material = mainMaterial;
				}
			});
			resolve(object);
		});
	});
}