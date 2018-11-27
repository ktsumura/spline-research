// Copyright 2018 Raph Levien

//! A library of primitives for curves and splines.

/// A simple container for 2-vectors
class Vec2 {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	norm() {
		return Math.hypot(this.x, this.y);
	}

	dot(other) {
		return this.x * other.x + this.y * other.y;
	}

	cross(other) {
		return this.x * other.y - this.y * other.x;
	}
}

class CubicBez {
	/// Argument is array of coordinate values [x0, y0, x1, y1, x2, y2, x3, y3].
	constructor(coords) {
		this.c = coords;
	}

	weightsum(c0, c1, c2, c3) {
		let x = c0 * this.c[0] + c1 * this.c[2] + c2 * this.c[4] + c3 * this.c[6];
		let y = c0 * this.c[1] + c1 * this.c[3] + c2 * this.c[5] + c3 * this.c[7];
		return new Vec2(x, y);
	}

	eval(t) {
		let mt = 1 - t;
		let c0 = mt * mt * mt;
		let c1 = 3 * mt * mt * t;
		let c2 = 3 * mt * t * t;
		let c3 = t * t * t;
		return this.weightsum(c0, c1, c2, c3);
	}

	deriv(t) {
		let mt = 1 - t;
		let c0 = -3 * mt * mt;
		let c3 = 3 * t * t;
		let c1 = -6 * t * mt - c0;
		let c2 = 6 * t * mt - c3;
		return this.weightsum(c0, c1, c2, c3);
	}

	deriv2(t) {
		let mt = 1 - t;
		let c0 = 6 * mt;
		let c3 = 6 * t;
		let c1 = 6 - 18 * mt;
		let c2 = 6 - 18 * t;
		return this.weightsum(c0, c1, c2, c3);
	}

	curvature(t) {
		let d = this.deriv(t);
		let d2 = this.deriv2(t);
		return d.cross(d2) / Math.pow(d.norm(), 3);
	}

	atanCurvature(t) {
		let d = this.deriv(t);
		let d2 = this.deriv2(t);
		return Math.atan2(d.cross(d2), Math.pow(d.norm(), 3));
	}
}

function testCubicBez() {
	let c = new Float64Array(8);
	for (var i = 0; i < 8; i++) {
		c[i] = Math.random();
	}
	let cb = new CubicBez(c);
	let t = Math.random();
	let epsilon = 1e-6;
	let xy0 = cb.eval(t);
	let xy1 = cb.eval(t + epsilon);
	console.log(new Vec2((xy1.x - xy0.x) / epsilon, (xy1.y - xy0.y) / epsilon));
	console.log(cb.deriv(t));

	let dxy0 = cb.deriv(t);
	let dxy1 = cb.deriv(t + epsilon);
	console.log(new Vec2((dxy1.x - dxy0.x) / epsilon, (dxy1.y - dxy0.y) / epsilon));
	console.log(cb.deriv2(t));
}

/// Solve tridiagonal matrix system. Destroys inputs, leaves output in x.
///
/// Solves a[i] * x[i - 1] + b[i] * x[i] + c[i] * x[i + 1] = d[i]
///
/// Inputs are array-like objects (typed arrays are good for performance).
///
/// Note: this is not necessarily the fastest, see:
/// https://en.wikibooks.org/wiki/Algorithm_Implementation/Linear_Algebra/Tridiagonal_matrix_algorithm
function tridiag(a, b, c, d, x) {
	let n = x.length;
	for (var i = 1; i < n; i++) {
		let m = a[i] / b[i - 1];
		b[i] -= m * c[i - 1];
		d[i] -= m * d[i - 1];
	}
	x[n - 1] = d[n - 1] / b[n - 1];
	for (var i = n - 2; i >= 0; i--) {
		x[i] = (d[i] - c[i] * x[i + 1]) / b[i];
	}
}

function testTridiag(n) {
	let a = new Float64Array(n);
	let b = new Float64Array(n);
	let c = new Float64Array(n);
	let d = new Float64Array(n);
	let x = new Float64Array(n);

	for (var i = 0; i < n; i++) {
		a[i] = Math.random();
		b[i] = 2 + Math.random();
		c[i] = Math.random();
		d[i] = Math.random();
		x[i] = Math.random();
	}
	let bsave = new Float64Array(b);
	let dsave = new Float64Array(d);
	let xsave = new Float64Array(x);
	tridiag(a, b, c, d, x);
	b = bsave; d = dsave;
	console.log(b[0] * x[0] + c[0] * x[1] - d[0]);
	for (var i = 1; i < n - 1; i++) {
		console.log(a[i] * x[i - 1] + b[i] * x[i] + c[i] * x[i + 1] - d[i]);
	}
	console.log(a[n - 1] * x[n - 2] + b[n - 1] * x[n - 1] - d[n - 1]);
}

//testTridiag(10);
//testCubicBez();

/// Create a smooth cubic bezier.
function myCubic(th0, th1) {
	function myCubicLen(th0, th1) {
		let offset = 0.3 * Math.sin(th1 * 2 - 0.4 * Math.sin(th1 * 2));
		let drive = 2.0;
		let scale = 1.0 / (3 * Math.tanh(drive));
		let len = scale * Math.tanh(drive * Math.cos(th0 - offset));
		return len;
	}

	var coords = new Float64Array(8);
	let len0 = myCubicLen(th0, th1);
	coords[2] = Math.cos(th0) * len0;
	coords[3] = Math.sin(th0) * len0;

	let len1 = myCubicLen(th1, th0);
	coords[4] = 1 - Math.cos(th1) * len1;
	coords[5] = Math.sin(th1) * len1;
	coords[6] = 1;
	return coords;
}

/// Make a curvature map of a function that gives coords of a single bezier, suitable for gnuplot
function makeCurvatureMap(f) {
	let n = 200;
	for (var j = 0; j < n; j++) {
		let th1 = -Math.PI/2 + Math.PI * j / (n - 1);
		for (var i = 0; i < n; i++) {
			let th0 = -Math.PI/2 + Math.PI * i / (n - 1);
			let cb = new CubicBez(f(th0, th1));
			let atanK = cb.atanCurvature(0);
			console.log(`${th0} ${th1} ${atanK}`);
		}
		console.log('');
	}
}

function isNode() {
	try {
		return this === global;
	} catch(e) {
		return false;
	}
}

if (isNode()) {
	makeCurvatureMap(myCubic);
}

//! Base class for two parameter curve families

class TwoParamCurve {
	/// Render the curve, providing an array of _interior_ cubic bezier
	/// control points only. Return value is an array of 3n-1 Vec2's.
	// render(th0, th1)
}

class MyCurve extends TwoParamCurve {
	render(th0, th1) {
		let c = myCubic(th0, th1);
		return [new Vec2(c[2], c[3]), new Vec2(c[4], c[5])];
	}
}

//! Global spline solver

// normalize theta to -pi..pi
function mod2pi(th) {
	let twopi = 2 * Math.PI;
	let frac = th * (1 / twopi);
	return twopi * (frac - Math.round(frac)); 
}


class TwoParamSpline {
	constructor(curve, ctrlPts) {
		this.curve = curve;
		this.ctrlPts = ctrlPts;
	}

	/// Determine initial tangent angles, given array of Vec2 control points.
	initialThs() {
		var ths = new Float64Array(this.ctrlPts.length);
		for (var i = 1; i < ths.length - 1; i++) {
			let dx0 = this.ctrlPts[i].x - this.ctrlPts[i - 1].x;
			let dy0 = this.ctrlPts[i].y - this.ctrlPts[i - 1].y;
			let l0 = Math.hypot(dx0, dy0);
			let dx1 = this.ctrlPts[i + 1].x - this.ctrlPts[i].x;
			let dy1 = this.ctrlPts[i + 1].y - this.ctrlPts[i].y;
			let l1 = Math.hypot(dx1, dy1);
			let th0 = Math.atan2(dy0, dx0);
			let th1 = Math.atan2(dy1, dx1);
			let bend = mod2pi(th1 - th0);
			let th = mod2pi(th0 + bend * l0 / (l0 + l1));
			ths[i] = th;
			if (i == 1) { ths[0] = th0; }
			if (i == ths.length - 2) { ths[i + 1] = th1; }
		}
		this.ths = ths;
		return ths;
	}

	// combine with next func, return struct?
	getTh0(i) {
		let dx = this.ctrlPts[i + 1].x - this.ctrlPts[i].x;
		let dy = this.ctrlPts[i + 1].y - this.ctrlPts[i].y;
		return mod2pi(this.ths[i] - Math.atan2(dy, dx));
	}

	getTh1(i) {
		let dx = this.ctrlPts[i + 1].x - this.ctrlPts[i].x;
		let dy = this.ctrlPts[i + 1].y - this.ctrlPts[i].y;
		return mod2pi(Math.atan2(dy, dx) - this.ths[i + 1]);
	}

	/// Return an SVG path string.
	renderSvg() {
		let c = this.ctrlPts;
		if (c.length == 0) { return ""; }
		var path = `M${c[0].x} ${c[0].y}`;
		var cmd = " C";
		for (var i = 0; i < c.length - 1; i++) {
			let th0 = this.getTh0(i);
			let th1 = this.getTh1(i);
			let render = this.curve.render(th0, th1);
			let dx = c[i + 1].x - c[i].x;
			let dy = c[i + 1].y - c[i].y;
			for (var j = 0; j < render.length; j++) {
				let pt = render[j];
				let x = c[i].x + dx * pt.x - dy * pt.y;
				let y = c[i].y + dy * pt.x + dx * pt.y;
				path += `${cmd}${x} ${y}`;
				cmd = " ";
			}
			path += ` ${c[i + 1].x} ${c[i + 1].y}`;
		}
		return path;
	}
}
