import Canvas from "./canvas";
import { centerPoint, toVector, toPoint, vectorx } from "./util"

/* Shape: a geometric primitive with a bbox */
export class Shape {
	static randomPoint(width, height) {
		return [~~(Math.random() * width), ~~(Math.random() * height)];
	}

	static create(cfg) {
		let ctors = cfg.shapeTypes;
		let index = Math.floor(Math.random() * ctors.length);
		let ctor = ctors[index];
		return new ctor(cfg.width, cfg.height).init();
	}

	constructor(w, h) {
		this.bbox = {};
		this.w = w;
		this.h = h;
	}

	init() { return this; }

	mutate(cfg) { return this; }

	/* get a new smaller canvas with this shape */
	rasterize(alpha) {
		let canvas = new Canvas(this.bbox.width, this.bbox.height);
		let ctx = canvas.ctx;
		ctx.fillStyle = "#000";
		ctx.globalAlpha = alpha;
		ctx.translate(-this.bbox.left, -this.bbox.top);
		this.render(ctx);
		return canvas;
	}

	render(ctx) { }

	serialize() { return { shape_type: 'Shape' } }

	static deserialize(serialization) {
		let ctor = ShapeMap[serialization.shape_type];
		let shape = new ctor();

		Object.keys(serialization).forEach(
			key => key != 'shape_type' && (shape[key] = serialization[key])
		);
		return shape;
	}
}

class Polygon extends Shape {
	constructor(w, h, count) {
		super(w, h);
		this.count = count;
	}

	init() {
		this.points = this._createPoints();
		this.computeBbox();
		return this;
	}

	render(ctx) {
		ctx.beginPath();
		this.points.forEach(([x, y], index) => {
			if (index) {
				ctx.lineTo(x, y);
			} else {
				ctx.moveTo(x, y);
			}
		});
		ctx.closePath();
		ctx.fill();
	}

	mutate(cfg) {
		let clone = new this.constructor(0, 0);
		clone.points = this.points.map(point => point.slice());

		let index = Math.floor(Math.random() * this.points.length);
		let point = clone.points[index];

		let angle = Math.random() * 2 * Math.PI;
		let radius = Math.random() * 20;
		point[0] += ~~(radius * Math.cos(angle));
		point[1] += ~~(radius * Math.sin(angle));

		return clone.computeBbox();
	}

	computeBbox() {
		let min = [
			this.points.reduce((v, p) => Math.min(v, p[0]), Infinity),
			this.points.reduce((v, p) => Math.min(v, p[1]), Infinity)
		];
		let max = [
			this.points.reduce((v, p) => Math.max(v, p[0]), -Infinity),
			this.points.reduce((v, p) => Math.max(v, p[1]), -Infinity)
		];

		this.bbox = {
			left: min[0],
			top: min[1],
			width: (max[0] - min[0]) || 1, /* fallback for deformed shapes */
			height: (max[1] - min[1]) || 1
		};

		return this;
	}

	_createPoints() {
		let first = Shape.randomPoint(this.w, this.h);
		let points = [first];

		for (let i = 1; i < this.count; i++) {
			let angle = Math.random() * 2 * Math.PI;
			let radius = Math.random() * 20;
			points.push([
				first[0] + ~~(radius * Math.cos(angle)),
				first[1] + ~~(radius * Math.sin(angle))
			]);
		}
		return points;
	}

	serialize() {
		let super_serialization = super.serialize();
		super_serialization.shape_type = 'Polygon';
		return {
			...super_serialization,
			points: this.points
		}
	}
}

class Line extends Polygon {
	constructor(w, h) {
		super(w, h, 2);
	}

	render(ctx) {
		ctx.beginPath()
		ctx.moveTo(this.points[0][0], this.points[0][1]);
		ctx.lineTo(this.points[1][0], this.points[1][1]);
		ctx.stroke();
		ctx.closePath()
	}

	serialize() {
		let super_serialization = super.serialize();
		super_serialization.shape_type = 'Line';
		return super_serialization;
	}
}

class Triangle extends Polygon {
	constructor(w, h) {
		super(w, h, 3);
	}

	serialize() {
		let super_serialization = super.serialize();
		super_serialization.shape_type = 'Triangle';
		return super_serialization;
	}
}

class Rectangle extends Polygon {
	constructor(w, h) {
		super(w, h, 4);
		this.angle = 0;
	}

	render(ctx) {
		ctx.save();
		let center = centerPoint(this.points[0], this.points[2]);
		ctx.translate(center[0], center[1]);
		ctx.rotate(this.angle);
		ctx.translate(-center[0], -center[1]);
		super.render(ctx);
		ctx.restore();
	}

	mutate(cfg) {
		let clone = new this.constructor(0, 0);
		clone.points = this.points.map(point => point.slice());

		let amount = ~~((Math.random() - 0.5) * 20);

		switch (Math.floor(Math.random() * 8)) {
			case 0: /* left */
				clone.points[0][0] += amount;
				clone.points[3][0] += amount;
				break;
			case 1: /* top */
				clone.points[0][1] += amount;
				clone.points[1][1] += amount;
				break;
			case 2: /* right */
				clone.points[1][0] += amount;
				clone.points[2][0] += amount;
				break;
			case 3: /* bottom */
				clone.points[2][1] += amount;
				clone.points[3][1] += amount;
				break;
			case 4:
			case 5:
			case 6:
			case 7:
				clone.angle = (amount / 20 + 0.5) * Math.PI;
				break;
		}

		return clone.computeBbox();
	}

	_createPoints() {
		let p1 = Shape.randomPoint(this.w, this.h);
		let p2 = Shape.randomPoint(this.w, this.h);

		let left = Math.min(p1[0], p2[0]);
		let right = Math.max(p1[0], p2[0]);
		let top = Math.min(p1[1], p2[1]);
		let bottom = Math.max(p1[1], p2[1]);

		return [
			[left, top],
			[right, top],
			[right, bottom],
			[left, bottom]
		];
	}

	serialize() {
		let super_serialization = super.serialize();
		super_serialization['shape_type'] = 'Rectangle';
		return {
			...super_serialization,
			angle: this.angle
		}
	}
}

class Ellipse extends Shape {
	constructor(w, h) {
		super(w, h);
	}

	init() {
		this.center = Shape.randomPoint(this.w, this.h);
		this.rx = 1 + ~~(Math.random() * 20);
		this.ry = 1 + ~~(Math.random() * 20);
		this.computeBbox();
		return this;
	}

	render(ctx) {
		ctx.beginPath();
		ctx.ellipse(this.center[0], this.center[1], this.rx, this.ry, 0, 0, 2 * Math.PI, false);
		ctx.fill();
		ctx.closePath()
	}

	mutate(cfg) {
		let clone = new this.constructor(0, 0);
		clone.center = this.center.slice();
		clone.rx = this.rx;
		clone.ry = this.ry;

		switch (Math.floor(Math.random() * 3)) {
			case 0:
				let angle = Math.random() * 2 * Math.PI;
				let radius = Math.random() * 20;
				clone.center[0] += ~~(radius * Math.cos(angle));
				clone.center[1] += ~~(radius * Math.sin(angle));
				break;

			case 1:
				clone.rx += (Math.random() - 0.5) * 20;
				clone.rx = Math.max(1, ~~clone.rx);
				break;

			case 2:
				clone.ry += (Math.random() - 0.5) * 20;
				clone.ry = Math.max(1, ~~clone.ry);
				break;
		}

		return clone.computeBbox();
	}

	computeBbox() {
		this.bbox = {
			left: this.center[0] - this.rx,
			top: this.center[1] - this.ry,
			width: 2 * this.rx,
			height: 2 * this.ry
		}
		return this;
	}

	serialize() {
		let super_serialization = super.serialize();
		super_serialization.shape_type = 'Ellipse';
		return {
			...super_serialization,
			center: this.center,
			rx: this.rx,
			ry: this.ry
		}
	}
}

class Bezier extends Polygon {
	constructor(w, h) {
		super(w, h, 4);
	}

	render(ctx) {
		ctx.beginPath()
		ctx.moveTo(this.points[0][0], this.points[0][1]);
		ctx.bezierCurveTo(
			this.points[1][0], this.points[1][1],
			this.points[2][0], this.points[2][1],
			this.points[3][0], this.points[3][1]
		);
		ctx.stroke();
		ctx.closePath()
	}

	serialize() {
		let super_serialization = super.serialize();
		super_serialization.shape_type = 'Bezier';
		return super_serialization;
	}
}

class Heart extends Triangle {
	init() {
		this.points = this._createPoints();
		this.computeBbox();
		this.center = this._createCenterPoint();
		return this;
	}

	render(ctx) {
		let v = toVector(this.center, this.points[0]);
		let p1down = toPoint(this.points[1], v);
		let p2down = toPoint(this.points[2], v);
		ctx.beginPath()
		ctx.moveTo(this.points[0][0], this.points[0][1]);
		ctx.bezierCurveTo(
			p1down[0], p1down[1],
			this.points[1][0], this.points[1][1],
			this.center[0], this.center[1]
		);
		ctx.moveTo(this.points[0][0], this.points[0][1]);
		ctx.bezierCurveTo(
			p2down[0], p2down[1],
			this.points[2][0], this.points[2][1],
			this.center[0], this.center[1]
		);
		ctx.fill();
		ctx.closePath()
	}

	mutate(cfg) {
		let clone = new this.constructor(0, 0);
		clone.points = this.points.map(point => point.slice());

		let index = Math.floor(Math.random() * this.points.length);
		let point = clone.points[index];

		let angle = Math.random() * 2 * Math.PI;
		let radius = Math.random() * 20;
		point[0] += ~~(radius * Math.cos(angle));
		point[1] += ~~(radius * Math.sin(angle));
		clone.center = clone._createCenterPoint();

		return clone.computeBbox();
	}

	// _createCenterPoint(){
	// 	let ax = toVector(this.points[0], this.points[1]);
	// 	let ay = toVector(this.points[0], this.points[2]);
	//
	// 	return toPoint(
	// 		this.points[0],
	// 		vectorx(ax, Math.random()),
	// 		vectorx(ay, Math.random())
	// 	);
	// }

	_createCenterPoint() {
		return centerPoint(...this.points)
	}

	serialize() {
		let super_serialization = super.serialize();
		super_serialization.shape_type = 'Heart';
		return {
			...super_serialization,
			center: this.center
		}
	}
}

export const ShapeMap = {
	Ellipse: Ellipse,
	Rectangle: Rectangle,
	Triangle: Triangle,
	Bezier: Bezier,
	Line: Line,
	Heart: Heart
};