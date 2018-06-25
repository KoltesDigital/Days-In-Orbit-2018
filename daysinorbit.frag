/*{
	IMPORTED: {
		controller: {
			PATH: './controller.png'
		},
		daysinorbit: {
			PATH: './daysinorbit.png'
		},
	},
	PASSES: [
		{
			TARGET: 'sgamepad',
			FLOAT: true,
		},
		{
			TARGET: 'igamepad',
			FLOAT: true,
		},
		{
			MODEL: {
				PATH: './models/Cooper.obj',
				MATERIAL: './models/Cooper.mtl',
			},
			fs: './daysinorbit.frag',
			vs: './model.vert',
			TARGET: 'model',
			BLEND: 'NORMAL',
		}, {
			TARGET: 'rendering',
		},
		{}
	],
	audio: true,
	frameskip: 5,
	gamepad: true,
	midi: true,
	pixelRatio: 1,
	vertexMode: "TRIANGLES",
}*/
precision mediump float;

uniform float time;
uniform vec2 resolution;
uniform sampler2D midi;
uniform sampler2D note;
uniform float volume;
uniform sampler2D samples;
uniform sampler2D spectrum;
uniform sampler2D gamepad;
uniform sampler2D sgamepad;
uniform sampler2D igamepad;
uniform sampler2D controller;
uniform sampler2D daysinorbit;
uniform int PASSINDEX;
uniform sampler2D material0;
uniform sampler2D model;
uniform sampler2D backbuffer;
uniform sampler2D rendering;

varying vec2 vUv;

const float PI = 3.1415927;
const float TAU = 6.2831853;

#define palette(t, a, b, c, d) (a+b*cos(TAU*(c*t+d)))

const vec2 leftStick = vec2(0., 1.);
const vec2 rightStick = vec2(2., 3.);

vec2 axes(sampler2D gp, vec2 stick) {
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

float smin(float a, float b, float k) {
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}
float smax(float a, float b, float k) {
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( a, b, h ) + k*h*(1.0-h);
}

#define rand(x) fract(sin(x)*1e4)
float hash(float n) { return fract(sin(n) * 1e4); }
float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

float noise(float x) {
	float i = floor(x);
	float f = fract(x);
	float u = f * f * (3.0 - 2.0 * f);
	return mix(hash(i), hash(i + 1.0), u);
}

float noise(vec2 x) {
	vec2 i = floor(x);
	vec2 f = fract(x);

	// Four corners in 2D of a tile
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));

	// Simple 2D lerp using smoothstep envelope between the values.
	// return vec3(mix(mix(a, b, smoothstep(0.0, 1.0, f.x)),
	//			mix(c, d, smoothstep(0.0, 1.0, f.x)),
	//			smoothstep(0.0, 1.0, f.y)));

	// Same code, with the clamps in smoothstep and common subexpressions
	// optimized away.
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float noise(vec3 x) {
	const vec3 step = vec3(110, 241, 171);

	vec3 i = floor(x);
	vec3 f = fract(x);

	// For performance, compute the base input to a 1D hash from the integer part of the argument and the
	// incremental change to the 1D based on the 3D -> 1D wrapping
    float n = dot(i, step);

	vec3 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix( hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y),
               mix(mix( hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z);
}

float fbm(float x, int o) {
	float v = 0.0;
	float a = 0.5;
	float shift = float(100);
	for (int i = 0; i < o; ++i) {
		v += a * noise(x);
		x = x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}

float fbm(vec2 x, int o) {
	float v = 0.0;
	float a = 0.5;
	vec2 shift = vec2(100);
	// Rotate to reduce axial bias
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
	for (int i = 0; i < o; ++i) {
		v += a * noise(x);
		x = rot * x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}

float fbm(vec3 x, int o) {
	float v = 0.0;
	float a = 0.5;
	vec3 shift = vec3(100);
	for (int i = 0; i < o; ++i) {
		v += a * noise(x);
		x = x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}

float linstep(float x) {
	return floor(x) + smoothstep(0., 1., fract(x));
}

#define knob(v) texture2D(midi, vec2(176. / 256., v / 128.)).x*2.
#define freq(f) texture2D(spectrum, vec2(f,0.)).x
#define md(p,m) mod(p-m*.5,m)-m*.5
void amod(inout vec2 p,float d){float a=md(atan(p.y,p.x),TAU/d);p=vec2(cos(a),sin(a))*length(p);}

vec2 ls, rs;
float r;

float map(vec3 p)
{
	p.xy += 10.;
	p.z += time*10.;
	p.xy *= rot(p.z*.02*sin(time*.01));
	p = md(p,30.+10.*sin(time*.1));
	float d = dot(p, normalize(sign(p))) - 2.;
	return d;
}

void main(void)
{
	ls = axes(sgamepad, leftStick);
	rs = axes(igamepad, rightStick);
	r = linstep(time)*PI;

	vec2 uv =  gl_FragCoord.xy / resolution.xy;
	vec2 uvc = uv - 0.5;
	uvc /= vec2(resolution.y / resolution.x, 1);

	int pass = 0;

	if (PASSINDEX == pass++) {
		vec4 gp = texture2D(gamepad, uv);
		if (uv.y>.5) gp-=.5;
		gl_FragColor = mix(texture2D(sgamepad, uv), gp, .1);
	}

	if (PASSINDEX == pass++) {
		vec4 gp = texture2D(sgamepad, uv);
		gl_FragColor = texture2D(igamepad, uv) + gp;
	}

	if (PASSINDEX == pass++) {
		gl_FragColor = texture2D(material0, vUv);
	}

	if (PASSINDEX == pass++) {
		vec3 ro = vec3(0., 0., -10.),
			rd = normalize(vec3(uvc, .8 - length(uvc) * knob(19.) * 4.)),
			p = ro;

		rd.xz *= rot(hash(floor(time))-.5)*2.;
		float f = 0.,
			g = 0.;
		for (float ff = 0.; ff < 1.; ff += .01)
		{
			f = ff;
			float d = map(p);
			g += .001/(.1+d*d);
			if (d<.001) break;
			p += d * rd;
		}

		vec3 c = f * .5
		 * palette(
			f,
			vec3(sin(uv*TAU + time)+.5, .5),
			vec3(.5),
			vec3(1),
			vec3(0.)
			);
		c += g*volume*.5;
		c *= knob(18.);
		//c=mix(clamp(c,0.,1.),vec3(.1,.2,.3)*.1, 1.-exp(-5.*f));*/

		vec3 sd = vec3(0.,0.,1.);
		for (float s = 0.; s < 128.; ++s)
		{
			float sr = rand(s)*128.+time,
				rr = fract(sr),
				rb = floor(sr);
			vec4 rnd = rand(rb + vec4(0, 3, 5, 8));
			float a = rnd.w * TAU;
			vec3 p = vec3(cos(a), sin(a), 0.) * (10. + 50. * rnd.x),
				rop = ro - p,
				n = normalize(cross(sd, rd)),
				n2 = cross(rd, n);
			float d = dot(n, rop),
				t = dot(rop, n2) / dot(sd, n2),
				z = mix(200., -50., rr);
				c += (.01 + .01*volume)/d/d * step(-10., t) * smoothstep(10., 0., abs(t - z))	* knob(16.);
		}

		vec4 mc = texture2D(model, uv);
		c = mix(c, mc.rgb, mc.a * knob(17.));

		uvc.x -= .5;
		uvc *= rot(time);

		gl_FragColor = vec4(c*knob(53.),1.);
	}

	if (PASSINDEX == pass++) {

		float segment = hash(floor(uvc * 10.)+hash(time));
		if (segment < knob(31.))
		{
			uvc += segment;
		}

		amod(uvc, floor(knob(49.)*5.)+1.);
		uv = uvc * vec2(resolution.y / resolution.x, 1) + .5;

		vec3 c = vec3(0.);
		for(int i = 0; i < 3; ++i)
		{
			c[i] = texture2D(rendering, (uv-.5)*(float(i)*knob(27.)*.1+1.)+.5)[i];
		}

		vec4 contc = texture2D(controller, uvc*2.+.5);
		c = mix(c, vec3(sin(10.*time)*.5+.5), contc.a*knob(61.));

						vec4 dioc = texture2D(daysinorbit, uvc*(1.-.5*freq(.3))+.5);
						c = mix(c, vec3(1.), dioc.a*knob(62.));

		c = mix(c, texture2D(backbuffer, uv).rgb, knob(23.));

		gl_FragColor = vec4(c, 1.);
	}
}
