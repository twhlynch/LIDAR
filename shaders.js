export const particleVS = /* glsl */`
	attribute vec3 color;

	varying vec3 vColor;
	varying vec3 vWorldPosition;

	void main() 
	{
		vColor = color;

		vec4 worldPosition = modelMatrix * vec4(position, 1.0);
		vWorldPosition = worldPosition.xyz;

		vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
		gl_PointSize = 0.05 * (300.0 / length(mvPosition.xyz));
		gl_Position = projectionMatrix * mvPosition;
	}`
export const particleFS = /* glsl */`
	varying vec3 vColor;
	varying vec3 vWorldPosition;

	void main()
	{
		gl_FragColor = vec4(vColor, 1.0);
	}
`