export const particleVS = /* glsl */`
	attribute vec3 color;
	varying vec3 vColor;

	void main() 
	{
		vColor = color;

		gl_PointSize = 1.0;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`
export const particleFS = /* glsl */`
	varying vec3 vColor;

	void main()
	{
		gl_FragColor = vec4(vColor, 1.0);
	}
`