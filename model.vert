precision mediump float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute float vertexId;
attribute float objectId;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat3 uvTransform;
uniform float time;
uniform vec2 resolution;
uniform float volume;

varying vec2 vUv;
varying float vObjectId;
varying vec4 v_color;

uniform sampler2D sgamepad;
uniform sampler2D igamepad;

const vec2 leftStick = vec2(0., 1.);
const vec2 rightStick = vec2(2., 3.);

vec2 axes(sampler2D gp, vec2 stick)
{
	return vec2(
		texture2D(gp, vec2(stick.x / 128., 1.)).x,
		-texture2D(gp, vec2(stick.y / 128., 1.)).x
	);
}

mat2 rot(float t) {
  float s = sin(t);
  float c = cos(t);
  return mat2(c, s, -s, c);
}

#define hash(x) fract(sin(x)*1e4)
void main() {
  vec3 pos = position;
	vec2 rs = axes(igamepad, rightStick);

	pos *= 1. + volume * .005;
	pos.xz *= rot(time*.3);
  pos.yz *= rot(time*.5);
  pos.x *= resolution.y / resolution.x;

  pos.xy += axes(sgamepad, leftStick);

	pos.x += (hash(vertexId)-.5)*max(0.,sin(time));
	pos.y += (hash(vertexId+1.)-.5)*max(0.,sin(time));
	pos.y += (hash(vertexId+2.)-.5)*max(0.,sin(time));

	//pos.xy += sin(vec2(2,3)*time*.2);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos * .5, 1.0);

  vUv = uv;
  vObjectId = objectId;
  v_color = vec4(1);
}
