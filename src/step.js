import * as util from "./util";
import State from "./state";
import { Shape } from "./shape";

/* Step: a Shape, color and alpha */
export default class Step {
	constructor(shape, cfg) {
		this.shape = shape;
		this.cfg = cfg;
		this.alpha = cfg ? cfg.alpha : 1.;

		/* these two are computed during the .compute() call */
		this.color = "#000";
		this.distance = Infinity;
	}

	/* apply this step to a state to get a new state. call only after .compute */
	apply(state) {
		let newCanvas = state.canvas.clone().drawStep(this);
		return new State(state.target, newCanvas, this.distance);
	}

	/* find optimal color and compute the resulting distance */
	compute(state) {
		let pixels = state.canvas.node.width * state.canvas.node.height;
		let offset = this.shape.bbox;

		let imageData = {
			shape: this.shape.rasterize(this.alpha).getImageData(),
			current: state.canvas.getImageData(),
			target: state.target.getImageData()
		};

		let { color, differenceChange } = util.computeColorAndDifferenceChange(offset, imageData, this.alpha);
		this.color = color;
		let currentDifference = util.distanceToDifference(state.distance, pixels);
		// if (-differenceChange > currentDifference) debugger;
		this.distance = util.differenceToDistance(currentDifference + differenceChange, pixels);

		return Promise.resolve(this);
	}

	/* return a slightly mutated step */
	mutate() {
		let newShape = this.shape.mutate(this.cfg);
		let mutated = new this.constructor(newShape, this.cfg);
		if (this.cfg.mutateAlpha) {
			let mutatedAlpha = this.alpha + (Math.random() - 0.5) * 0.08;
			mutated.alpha = util.clamp(mutatedAlpha, .1, 1);
		}
		return mutated;
	}

	serialize() {
		return {
			alpha: this.alpha,
			color: this.color,
			shape: this.shape.serialize()
		}
	}

	static deserialize(json) {
		let step = new Step();
		step.shape = Shape.deserialize(json.shape);
		step.color = json.color;
		step.alpha = json.alpha;
		return step;
	}
}
