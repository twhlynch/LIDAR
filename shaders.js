export const particleVS = /* glsl */`
	attribute vec3 color;
	varying vec3 vColor;

	varying float vDistance;

	void main() 
	{
		vColor = color;

		vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
		vDistance = length(mvPosition.xyz);

		gl_PointSize = 1.0 / vDistance;
		gl_Position = projectionMatrix * mvPosition;
	}
`
export const particleFS = /* glsl */`
	varying vec3 vColor;
	varying float vDistance;

	void main()
	{
		vec4 color = vec4(vColor, 1.0);
		float fogAmount = clamp(vDistance * 0.03, 0.0, 1.0);
		color.rgb = mix(color.rgb, vec3(0.0), fogAmount);

		gl_FragColor = color;
	}
`