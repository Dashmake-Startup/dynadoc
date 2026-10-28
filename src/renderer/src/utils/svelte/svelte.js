import { s as state, a as active_reaction, D as DEV, t as tag, g as get, b as set_active_reaction, u as user_derived, c as set, d as update_version, e as source, l as label, i as increment, f as createSubscriber, o as on, h as active_effect, w as writable, j as set_active_effect, k as effect_root, r as render_effect, m as effect_tracking, n as get$1, p as transition_slide_display } from './index.js';
export { G as afterUpdate, F as beforeUpdate, q as createAttachmentKey, I as createContext, E as createEventDispatcher, T as createRawSnippet, x as derived, H as flushSync, v as fromAction, A as getAbortSignal, K as getAllContexts, J as getContext, L as hasContext, N as hydrate, O as mount, C as onDestroy, B as onMount, y as readable, z as readonly, M as setContext, S as settled, Q as tick, P as unmount, R as untrack } from './index.js';

/*
Adapted from https://github.com/mattdesl
Distributed under MIT License https://github.com/mattdesl/eases/blob/master/LICENSE.md
*/

/**
 * @param {number} t
 * @returns {number}
 */
function linear$1(t) {
	return t;
}

/**
 * @param {number} t
 * @returns {number}
 */
function backInOut(t) {
	const s = 1.70158 * 1.525;
	if ((t *= 2) < 1) return 0.5 * (t * t * ((s + 1) * t - s));
	return 0.5 * ((t -= 2) * t * ((s + 1) * t + s) + 2);
}

/**
 * @param {number} t
 * @returns {number}
 */
function backIn(t) {
	const s = 1.70158;
	return t * t * ((s + 1) * t - s);
}

/**
 * @param {number} t
 * @returns {number}
 */
function backOut(t) {
	const s = 1.70158;
	return --t * t * ((s + 1) * t + s) + 1;
}

/**
 * @param {number} t
 * @returns {number}
 */
function bounceOut(t) {
	const a = 4.0 / 11.0;
	const b = 8.0 / 11.0;
	const c = 9.0 / 10.0;
	const ca = 4356.0 / 361.0;
	const cb = 35442.0 / 1805.0;
	const cc = 16061.0 / 1805.0;
	const t2 = t * t;
	return t < a
		? 7.5625 * t2
		: t < b
			? 9.075 * t2 - 9.9 * t + 3.4
			: t < c
				? ca * t2 - cb * t + cc
				: 10.8 * t * t - 20.52 * t + 10.72;
}

/**
 * @param {number} t
 * @returns {number}
 */
function bounceInOut(t) {
	return t < 0.5 ? 0.5 * (1.0 - bounceOut(1.0 - t * 2.0)) : 0.5 * bounceOut(t * 2.0 - 1.0) + 0.5;
}

/**
 * @param {number} t
 * @returns {number}
 */
function bounceIn(t) {
	return 1.0 - bounceOut(1.0 - t);
}

/**
 * @param {number} t
 * @returns {number}
 */
function circInOut(t) {
	if ((t *= 2) < 1) return -0.5 * (Math.sqrt(1 - t * t) - 1);
	return 0.5 * (Math.sqrt(1 - (t -= 2) * t) + 1);
}

/**
 * @param {number} t
 * @returns {number}
 */
function circIn(t) {
	return 1.0 - Math.sqrt(1.0 - t * t);
}

/**
 * @param {number} t
 * @returns {number}
 */
function circOut(t) {
	return Math.sqrt(1 - --t * t);
}

/**
 * @param {number} t
 * @returns {number}
 */
function cubicInOut(t) {
	return t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
}

/**
 * @param {number} t
 * @returns {number}
 */
function cubicIn(t) {
	return t * t * t;
}

/**
 * @param {number} t
 * @returns {number}
 */
function cubicOut(t) {
	const f = t - 1.0;
	return f * f * f + 1.0;
}

/**
 * @param {number} t
 * @returns {number}
 */
function elasticInOut(t) {
	return t < 0.5
		? 0.5 * Math.sin(((+13.0 * Math.PI) / 2) * 2.0 * t) * Math.pow(2.0, 10.0 * (2.0 * t - 1.0))
		: 0.5 *
				Math.sin(((-13.0 * Math.PI) / 2) * (2.0 * t - 1.0 + 1.0)) *
				Math.pow(2.0, -10.0 * (2.0 * t - 1.0)) +
				1.0;
}

/**
 * @param {number} t
 * @returns {number}
 */
function elasticIn(t) {
	return Math.sin((13.0 * t * Math.PI) / 2) * Math.pow(2.0, 10.0 * (t - 1.0));
}

/**
 * @param {number} t
 * @returns {number}
 */
function elasticOut(t) {
	return Math.sin((-13.0 * (t + 1.0) * Math.PI) / 2) * Math.pow(2.0, -10.0 * t) + 1.0;
}

/**
 * @param {number} t
 * @returns {number}
 */
function expoInOut(t) {
	return t === 0.0 || t === 1.0
		? t
		: t < 0.5
			? +0.5 * Math.pow(2.0, 20.0 * t - 10.0)
			: -0.5 * Math.pow(2.0, 10.0 - t * 20.0) + 1.0;
}

/**
 * @param {number} t
 * @returns {number}
 */
function expoIn(t) {
	return t === 0.0 ? t : Math.pow(2.0, 10.0 * (t - 1.0));
}

/**
 * @param {number} t
 * @returns {number}
 */
function expoOut(t) {
	return t === 1.0 ? t : 1.0 - Math.pow(2.0, -10.0 * t);
}

/**
 * @param {number} t
 * @returns {number}
 */
function quadInOut(t) {
	t /= 0.5;
	if (t < 1) return 0.5 * t * t;
	t--;
	return -0.5 * (t * (t - 2) - 1);
}

/**
 * @param {number} t
 * @returns {number}
 */
function quadIn(t) {
	return t * t;
}

/**
 * @param {number} t
 * @returns {number}
 */
function quadOut(t) {
	return -t * (t - 2.0);
}

/**
 * @param {number} t
 * @returns {number}
 */
function quartInOut(t) {
	return t < 0.5 ? +8.0 * Math.pow(t, 4.0) : -8.0 * Math.pow(t - 1.0, 4.0) + 1.0;
}

/**
 * @param {number} t
 * @returns {number}
 */
function quartIn(t) {
	return Math.pow(t, 4.0);
}

/**
 * @param {number} t
 * @returns {number}
 */
function quartOut(t) {
	return Math.pow(t - 1.0, 3.0) * (1.0 - t) + 1.0;
}

/**
 * @param {number} t
 * @returns {number}
 */
function quintInOut(t) {
	if ((t *= 2) < 1) return 0.5 * t * t * t * t * t;
	return 0.5 * ((t -= 2) * t * t * t * t + 2);
}

/**
 * @param {number} t
 * @returns {number}
 */
function quintIn(t) {
	return t * t * t * t * t;
}

/**
 * @param {number} t
 * @returns {number}
 */
function quintOut(t) {
	return --t * t * t * t * t + 1;
}

/**
 * @param {number} t
 * @returns {number}
 */
function sineInOut(t) {
	return -0.5 * (Math.cos(Math.PI * t) - 1);
}

/**
 * @param {number} t
 * @returns {number}
 */
function sineIn(t) {
	const v = Math.cos(t * Math.PI * 0.5);
	if (Math.abs(v) < 1e-14) return 1;
	else return 1 - v;
}

/**
 * @param {number} t
 * @returns {number}
 */
function sineOut(t) {
	return Math.sin((t * Math.PI) / 2);
}

/** @import { FlipParams, AnimationConfig } from './public.js' */

/**
 * The flip function calculates the start and end position of an element and animates between them, translating the x and y values.
 * `flip` stands for [First, Last, Invert, Play](https://aerotwist.com/blog/flip-your-animations/).
 *
 * @param {Element} node
 * @param {{ from: DOMRect; to: DOMRect }} fromTo
 * @param {FlipParams} params
 * @returns {AnimationConfig}
 */
function flip(node, { from, to }, params = {}) {
	var { delay = 0, duration = (d) => Math.sqrt(d) * 120, easing = cubicOut } = params;

	var style = getComputedStyle(node);

	// find the transform origin, expressed as a pair of values between 0 and 1
	var transform = style.transform === 'none' ? '' : style.transform;
	var [ox, oy] = style.transformOrigin.split(' ').map(parseFloat);
	ox /= node.clientWidth;
	oy /= node.clientHeight;

	// calculate effect of parent transforms and zoom
	var zoom = get_zoom(node); // https://drafts.csswg.org/css-viewport/#effective-zoom
	var sx = node.clientWidth / to.width / zoom;
	var sy = node.clientHeight / to.height / zoom;

	// find the starting position of the transform origin
	var fx = from.left + from.width * ox;
	var fy = from.top + from.height * oy;

	// find the ending position of the transform origin
	var tx = to.left + to.width * ox;
	var ty = to.top + to.height * oy;

	// find the translation at the start of the transform
	var dx = (fx - tx) * sx;
	var dy = (fy - ty) * sy;

	// find the relative scale at the start of the transform
	var dsx = from.width / to.width;
	var dsy = from.height / to.height;

	return {
		delay,
		duration: typeof duration === 'function' ? duration(Math.sqrt(dx * dx + dy * dy)) : duration,
		easing,
		css: (t, u) => {
			var x = u * dx;
			var y = u * dy;
			var sx = t + u * dsx;
			var sy = t + u * dsy;

			return `transform: ${transform} translate(${x}px, ${y}px) scale(${sx}, ${sy});`;
		}
	};
}

/**
 * @param {Element} element
 */
function get_zoom(element) {
	if ('currentCSSZoom' in element) {
		return /** @type {number} */ (element.currentCSSZoom);
	}

	/** @type {Element | null} */
	var current = element;
	var zoom = 1;

	while (current !== null) {
		zoom *= +getComputedStyle(current).zoom;
		current = /** @type {Element | null} */ (current.parentElement);
	}

	return zoom;
}

/** @import { Source } from '#client' */

var inited$1 = false;

/**
 * A reactive version of the built-in [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) object.
 * Reading the date (whether with methods like `date.getTime()` or `date.toString()`, or via things like [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat))
 * in an [effect](https://svelte.dev/docs/svelte/$effect) or [derived](https://svelte.dev/docs/svelte/$derived)
 * will cause it to be re-evaluated when the value of the date changes.
 *
 * ```svelte
 * <script>
 * 	import { SvelteDate } from 'svelte/reactivity';
 *
 * 	const date = new SvelteDate();
 *
 * 	const formatter = new Intl.DateTimeFormat(undefined, {
 * 	  hour: 'numeric',
 * 	  minute: 'numeric',
 * 	  second: 'numeric'
 * 	});
 *
 * 	$effect(() => {
 * 		const interval = setInterval(() => {
 * 			date.setTime(Date.now());
 * 		}, 1000);
 *
 * 		return () => {
 * 			clearInterval(interval);
 * 		};
 * 	});
 * </script>
 *
 * <p>The time is {formatter.format(date)}</p>
 * ```
 */
class SvelteDate extends Date {
	#time = state(super.getTime());

	/** @type {Map<keyof Date, Source<unknown>>} */
	#deriveds = new Map();

	#reaction = active_reaction;

	/** @param {any[]} params */
	constructor(...params) {
		// @ts-ignore
		super(...params);

		if (DEV) {
			tag(this.#time, 'SvelteDate.#time');
		}

		if (!inited$1) this.#init();
	}

	#init() {
		inited$1 = true;

		var proto = SvelteDate.prototype;
		var date_proto = Date.prototype;

		var methods = /** @type {Array<keyof Date & string>} */ (
			Object.getOwnPropertyNames(date_proto)
		);

		for (const method of methods) {
			if (method.startsWith('get') || method.startsWith('to') || method === 'valueOf') {
				// @ts-ignore
				proto[method] = function (...args) {
					// don't memoize if there are arguments
					// @ts-ignore
					if (args.length > 0) {
						get(this.#time);
						// @ts-ignore
						return date_proto[method].apply(this, args);
					}

					var d = this.#deriveds.get(method);

					if (d === undefined) {
						// lazily create the derived, but as though it were being
						// created at the same time as the class instance
						const reaction = active_reaction;
						set_active_reaction(this.#reaction);

						d = user_derived(() => {
							get(this.#time);
							// @ts-ignore
							return date_proto[method].apply(this, args);
						});

						this.#deriveds.set(method, d);

						set_active_reaction(reaction);
					}

					return get(d);
				};
			}

			if (method.startsWith('set')) {
				// @ts-ignore
				proto[method] = function (...args) {
					// @ts-ignore
					var result = date_proto[method].apply(this, args);
					set(this.#time, date_proto.getTime.call(this));
					return result;
				};
			}
		}
	}
}

/** @import { Source } from '#client' */

var read_methods = ['forEach', 'isDisjointFrom', 'isSubsetOf', 'isSupersetOf'];
var set_like_methods = ['difference', 'intersection', 'symmetricDifference', 'union'];

var inited = false;

/**
 * A reactive version of the built-in [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) object.
 * Reading contents of the set (by iterating, or by reading `set.size` or calling `set.has(...)` as in the [example](https://svelte.dev/playground/53438b51194b4882bcc18cddf9f96f15) below) in an [effect](https://svelte.dev/docs/svelte/$effect) or [derived](https://svelte.dev/docs/svelte/$derived)
 * will cause it to be re-evaluated as necessary when the set is updated.
 *
 * Note that values in a reactive set are _not_ made [deeply reactive](https://svelte.dev/docs/svelte/$state#Deep-state).
 *
 * ```svelte
 * <script>
 * 	import { SvelteSet } from 'svelte/reactivity';
 * 	let monkeys = new SvelteSet();
 *
 * 	function toggle(monkey) {
 * 		if (monkeys.has(monkey)) {
 * 			monkeys.delete(monkey);
 * 		} else {
 * 			monkeys.add(monkey);
 * 		}
 * 	}
 * </script>
 *
 * {#each ['🙈', '🙉', '🙊'] as monkey}
 * 	<button onclick={() => toggle(monkey)}>{monkey}</button>
 * {/each}
 *
 * <button onclick={() => monkeys.clear()}>clear</button>
 *
 * {#if monkeys.has('🙈')}<p>see no evil</p>{/if}
 * {#if monkeys.has('🙉')}<p>hear no evil</p>{/if}
 * {#if monkeys.has('🙊')}<p>speak no evil</p>{/if}
 * ```
 *
 * @template T
 * @extends {Set<T>}
 */
class SvelteSet extends Set {
	/** @type {Map<T, Source<boolean>>} */
	#sources = new Map();
	#version = state(0);
	#size = state(0);
	#update_version = update_version || -1;

	/**
	 * @param {Iterable<T> | null | undefined} [value]
	 */
	constructor(value) {
		super();

		if (DEV) {
			// If the value is invalid then the native exception will fire here
			value = new Set(value);

			tag(this.#version, 'SvelteSet version');
			tag(this.#size, 'SvelteSet.size');
		}

		if (value) {
			for (var element of value) {
				super.add(element);
			}
			this.#size.v = super.size;
		}

		if (!inited) this.#init();
	}

	/**
	 * If the source is being created inside the same reaction as the SvelteSet instance,
	 * we use `state` so that it will not be a dependency of the reaction. Otherwise we
	 * use `source` so it will be.
	 *
	 * @template T
	 * @param {T} value
	 * @returns {Source<T>}
	 */
	#source(value) {
		return update_version === this.#update_version ? state(value) : source(value);
	}

	// We init as part of the first instance so that we can treeshake this class
	#init() {
		inited = true;

		var proto = SvelteSet.prototype;
		var set_proto = Set.prototype;

		for (const method of read_methods) {
			// @ts-ignore
			proto[method] = function (...v) {
				get(this.#version);
				// @ts-ignore
				return set_proto[method].apply(this, v);
			};
		}

		for (const method of set_like_methods) {
			// @ts-ignore
			proto[method] = function (...v) {
				get(this.#version);
				// @ts-ignore
				var set = /** @type {Set<T>} */ (set_proto[method].apply(this, v));
				return new SvelteSet(set);
			};
		}
	}

	/** @param {T} value */
	has(value) {
		var has = super.has(value);
		var sources = this.#sources;
		var s = sources.get(value);

		if (s === undefined) {
			if (!has) {
				// If the value doesn't exist, track the version in case it's added later
				// but don't create sources willy-nilly to track all possible values
				get(this.#version);
				return false;
			}

			s = this.#source(true);

			if (DEV) {
				tag(s, `SvelteSet has(${label(value)})`);
			}

			sources.set(value, s);
		}

		get(s);
		return has;
	}

	/** @param {T} value */
	add(value) {
		if (!super.has(value)) {
			super.add(value);
			set(this.#size, super.size);
			increment(this.#version);
		}

		return this;
	}

	/** @param {T} value */
	delete(value) {
		var deleted = super.delete(value);
		var sources = this.#sources;
		var s = sources.get(value);

		if (s !== undefined) {
			sources.delete(value);
			set(s, false);
		}

		if (deleted) {
			set(this.#size, super.size);
			increment(this.#version);
		}

		return deleted;
	}

	clear() {
		if (super.size === 0) {
			return;
		}
		// Clear first, so we get nice console.log outputs with $inspect
		super.clear();
		var sources = this.#sources;

		for (var s of sources.values()) {
			set(s, false);
		}

		sources.clear();
		set(this.#size, 0);
		increment(this.#version);
	}

	keys() {
		return this.values();
	}

	values() {
		get(this.#version);
		return super.values();
	}

	entries() {
		get(this.#version);
		return super.entries();
	}

	[Symbol.iterator]() {
		return this.keys();
	}

	get size() {
		return get(this.#size);
	}
}

/** @import { Source } from '#client' */

/**
 * A reactive version of the built-in [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) object.
 * Reading contents of the map (by iterating, or by reading `map.size` or calling `map.get(...)` or `map.has(...)` as in the [tic-tac-toe example](https://svelte.dev/playground/0b0ff4aa49c9443f9b47fe5203c78293) below) in an [effect](https://svelte.dev/docs/svelte/$effect) or [derived](https://svelte.dev/docs/svelte/$derived)
 * will cause it to be re-evaluated as necessary when the map is updated.
 *
 * Note that values in a reactive map are _not_ made [deeply reactive](https://svelte.dev/docs/svelte/$state#Deep-state).
 *
 * ```svelte
 * <script>
 * 	import { SvelteMap } from 'svelte/reactivity';
 * 	import { result } from './game.js';
 *
 * 	let board = new SvelteMap();
 * 	let player = $state('x');
 * 	let winner = $derived(result(board));
 *
 * 	function reset() {
 * 		player = 'x';
 * 		board.clear();
 * 	}
 * </script>
 *
 * <div class="board">
 * 	{#each Array(9), i}
 * 		<button
 * 			disabled={board.has(i) || winner}
 * 			onclick={() => {
 * 				board.set(i, player);
 * 				player = player === 'x' ? 'o' : 'x';
 * 			}}
 * 		>{board.get(i)}</button>
 * 	{/each}
 * </div>
 *
 * {#if winner}
 * 	<p>{winner} wins!</p>
 * 	<button onclick={reset}>reset</button>
 * {:else}
 * 	<p>{player} is next</p>
 * {/if}
 * ```
 *
 * @template K
 * @template V
 * @extends {Map<K, V>}
 */
class SvelteMap extends Map {
	/** @type {Map<K, Source<number>>} */
	#sources = new Map();
	#version = state(0);
	#size = state(0);
	#update_version = update_version || -1;

	/**
	 * @param {Iterable<readonly [K, V]> | null | undefined} [value]
	 */
	constructor(value) {
		super();

		if (DEV) {
			// If the value is invalid then the native exception will fire here
			value = new Map(value);

			tag(this.#version, 'SvelteMap version');
			tag(this.#size, 'SvelteMap.size');
		}

		if (value) {
			for (var [key, v] of value) {
				super.set(key, v);
			}
			this.#size.v = super.size;
		}
	}

	/**
	 * If the source is being created inside the same reaction as the SvelteMap instance,
	 * we use `state` so that it will not be a dependency of the reaction. Otherwise we
	 * use `source` so it will be.
	 *
	 * @template T
	 * @param {T} value
	 * @returns {Source<T>}
	 */
	#source(value) {
		return update_version === this.#update_version ? state(value) : source(value);
	}

	/** @param {K} key */
	has(key) {
		var sources = this.#sources;
		var s = sources.get(key);

		if (s === undefined) {
			var ret = super.get(key);
			if (ret !== undefined) {
				s = this.#source(0);

				if (DEV) {
					tag(s, `SvelteMap get(${label(key)})`);
				}

				sources.set(key, s);
			} else {
				// We should always track the version in case
				// the Set ever gets this value in the future.
				get(this.#version);
				return false;
			}
		}

		get(s);
		return true;
	}

	/**
	 * @param {(value: V, key: K, map: Map<K, V>) => void} callbackfn
	 * @param {any} [this_arg]
	 */
	forEach(callbackfn, this_arg) {
		this.#read_all();
		super.forEach(callbackfn, this_arg);
	}

	/** @param {K} key */
	get(key) {
		var sources = this.#sources;
		var s = sources.get(key);

		if (s === undefined) {
			var ret = super.get(key);
			if (ret !== undefined) {
				s = this.#source(0);

				if (DEV) {
					tag(s, `SvelteMap get(${label(key)})`);
				}

				sources.set(key, s);
			} else {
				// We should always track the version in case
				// the Set ever gets this value in the future.
				get(this.#version);
				return undefined;
			}
		}

		get(s);
		return super.get(key);
	}

	/**
	 * @param {K} key
	 * @param {V} value
	 * */
	set(key, value) {
		var sources = this.#sources;
		var s = sources.get(key);
		var prev_res = super.get(key);
		var res = super.set(key, value);
		var version = this.#version;

		if (s === undefined) {
			s = this.#source(0);

			if (DEV) {
				tag(s, `SvelteMap get(${label(key)})`);
			}

			sources.set(key, s);
			set(this.#size, super.size);
			increment(version);
		} else if (prev_res !== value) {
			increment(s);

			// if not every reaction of s is a reaction of version we need to also include version
			var v_reactions = version.reactions === null ? null : new Set(version.reactions);
			var needs_version_increase =
				v_reactions === null ||
				!s.reactions?.every((r) =>
					/** @type {NonNullable<typeof v_reactions>} */ (v_reactions).has(r)
				);
			if (needs_version_increase) {
				increment(version);
			}
		}

		return res;
	}

	/** @param {K} key */
	delete(key) {
		var sources = this.#sources;
		var s = sources.get(key);
		var res = super.delete(key);

		if (s !== undefined) {
			sources.delete(key);
			set(this.#size, super.size);
			set(s, -1);
			increment(this.#version);
		}

		return res;
	}

	clear() {
		if (super.size === 0) {
			return;
		}
		// Clear first, so we get nice console.log outputs with $inspect
		super.clear();
		var sources = this.#sources;
		set(this.#size, 0);
		for (var s of sources.values()) {
			set(s, -1);
		}
		increment(this.#version);
		sources.clear();
	}

	#read_all() {
		get(this.#version);

		var sources = this.#sources;
		if (this.#size.v !== sources.size) {
			for (var key of super.keys()) {
				if (!sources.has(key)) {
					var s = this.#source(0);
					if (DEV) {
						tag(s, `SvelteMap get(${label(key)})`);
					}

					sources.set(key, s);
				}
			}
		}

		for ([, s] of this.#sources) {
			get(s);
		}
	}

	keys() {
		get(this.#version);
		return super.keys();
	}

	values() {
		this.#read_all();
		return super.values();
	}

	entries() {
		this.#read_all();
		return super.entries();
	}

	[Symbol.iterator]() {
		return this.entries();
	}

	get size() {
		get(this.#size);
		return super.size;
	}
}

const REPLACE = Symbol();

/**
 * A reactive version of the built-in [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) object.
 * Reading its contents (by iterating, or by calling `params.get(...)` or `params.getAll(...)` as in the [example](https://svelte.dev/playground/b3926c86c5384bab9f2cf993bc08c1c8) below) in an [effect](https://svelte.dev/docs/svelte/$effect) or [derived](https://svelte.dev/docs/svelte/$derived)
 * will cause it to be re-evaluated as necessary when the params are updated.
 *
 * ```svelte
 * <script>
 * 	import { SvelteURLSearchParams } from 'svelte/reactivity';
 *
 * 	const params = new SvelteURLSearchParams('message=hello');
 *
 * 	let key = $state('key');
 * 	let value = $state('value');
 * </script>
 *
 * <input bind:value={key} />
 * <input bind:value={value} />
 * <button onclick={() => params.append(key, value)}>append</button>
 *
 * <p>?{params.toString()}</p>
 *
 * {#each params as [key, value]}
 * 	<p>{key}: {value}</p>
 * {/each}
 * ```
 */
class SvelteURLSearchParams extends URLSearchParams {
	#version = DEV ? tag(state(0), 'SvelteURLSearchParams version') : state(0);
	#url = get_current_url();

	#updating = false;

	#update_url() {
		if (!this.#url || this.#updating) return;
		this.#updating = true;

		const search = this.toString();
		this.#url.search = search && `?${search}`;

		this.#updating = false;
	}

	/**
	 * @param {URLSearchParams} params
	 * @internal
	 */
	[REPLACE](params) {
		if (this.#updating) return;
		this.#updating = true;

		for (const key of [...super.keys()]) {
			super.delete(key);
		}

		for (const [key, value] of params) {
			super.append(key, value);
		}

		increment(this.#version);
		this.#updating = false;
	}

	/**
	 * @param {string} name
	 * @param {string} value
	 * @returns {void}
	 */
	append(name, value) {
		super.append(name, value);
		this.#update_url();
		increment(this.#version);
	}

	/**
	 * @param {string} name
	 * @param {string=} value
	 * @returns {void}
	 */
	delete(name, value) {
		var has_value = super.has(name, value);
		super.delete(name, value);
		if (has_value) {
			this.#update_url();
			increment(this.#version);
		}
	}

	/**
	 * @param {string} name
	 * @returns {string|null}
	 */
	get(name) {
		get(this.#version);
		return super.get(name);
	}

	/**
	 * @param {string} name
	 * @returns {string[]}
	 */
	getAll(name) {
		get(this.#version);
		return super.getAll(name);
	}

	/**
	 * @param {string} name
	 * @param {string=} value
	 * @returns {boolean}
	 */
	has(name, value) {
		get(this.#version);
		return super.has(name, value);
	}

	keys() {
		get(this.#version);
		return super.keys();
	}

	/**
	 * @param {string} name
	 * @param {string} value
	 * @returns {void}
	 */
	set(name, value) {
		var previous = super.getAll(name).join('');
		super.set(name, value);
		// can't use has(name, value), because for something like https://svelte.dev?foo=1&bar=2&foo=3
		// if you set `foo` to 1, then foo=3 gets deleted whilst `has("foo", "1")` returns true
		if (previous !== super.getAll(name).join('')) {
			this.#update_url();
			increment(this.#version);
		}
	}

	sort() {
		super.sort();
		this.#update_url();
		increment(this.#version);
	}

	toString() {
		get(this.#version);
		return super.toString();
	}

	values() {
		get(this.#version);
		return super.values();
	}

	entries() {
		get(this.#version);
		return super.entries();
	}

	[Symbol.iterator]() {
		return this.entries();
	}

	get size() {
		get(this.#version);
		return super.size;
	}
}

/** @type {SvelteURL | null} */
let current_url = null;

function get_current_url() {
	// ideally we'd just export `current_url` directly, but it seems Vitest doesn't respect live bindings
	return current_url;
}

/**
 * A reactive version of the built-in [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL) object.
 * Reading properties of the URL (such as `url.href` or `url.pathname`) in an [effect](https://svelte.dev/docs/svelte/$effect) or [derived](https://svelte.dev/docs/svelte/$derived)
 * will cause it to be re-evaluated as necessary when the URL changes.
 *
 * The `searchParams` property is an instance of [SvelteURLSearchParams](https://svelte.dev/docs/svelte/svelte-reactivity#SvelteURLSearchParams).
 *
 * [Example](https://svelte.dev/playground/5a694758901b448c83dc40dc31c71f2a):
 *
 * ```svelte
 * <script>
 * 	import { SvelteURL } from 'svelte/reactivity';
 *
 * 	const url = new SvelteURL('https://example.com/path');
 * </script>
 *
 * <!-- changes to these... -->
 * <input bind:value={url.protocol} />
 * <input bind:value={url.hostname} />
 * <input bind:value={url.pathname} />
 *
 * <hr />
 *
 * <!-- will update `href` and vice versa -->
 * <input bind:value={url.href} size="65" />
 * ```
 */
class SvelteURL extends URL {
	#protocol = state(super.protocol);
	#username = state(super.username);
	#password = state(super.password);
	#hostname = state(super.hostname);
	#port = state(super.port);
	#pathname = state(super.pathname);
	#hash = state(super.hash);
	#search = state(super.search);
	#searchParams;

	/**
	 * @param {string | URL} url
	 * @param {string | URL} [base]
	 */
	constructor(url, base) {
		url = new URL(url, base);
		super(url);

		if (DEV) {
			tag(this.#protocol, 'SvelteURL.protocol');
			tag(this.#username, 'SvelteURL.username');
			tag(this.#password, 'SvelteURL.password');
			tag(this.#hostname, 'SvelteURL.hostname');
			tag(this.#port, 'SvelteURL.port');
			tag(this.#pathname, 'SvelteURL.pathname');
			tag(this.#hash, 'SvelteURL.hash');
			tag(this.#search, 'SvelteURL.search');
		}

		current_url = this;
		this.#searchParams = new SvelteURLSearchParams(url.searchParams);
		current_url = null;
	}

	get hash() {
		return get(this.#hash);
	}

	set hash(value) {
		super.hash = value;
		set(this.#hash, super.hash);
	}

	get host() {
		get(this.#hostname);
		get(this.#port);
		return super.host;
	}

	set host(value) {
		super.host = value;
		set(this.#hostname, super.hostname);
		set(this.#port, super.port);
	}

	get hostname() {
		return get(this.#hostname);
	}

	set hostname(value) {
		super.hostname = value;
		set(this.#hostname, super.hostname);
	}

	get href() {
		get(this.#protocol);
		get(this.#username);
		get(this.#password);
		get(this.#hostname);
		get(this.#port);
		get(this.#pathname);
		get(this.#hash);
		get(this.#search);
		return super.href;
	}

	set href(value) {
		super.href = value;
		set(this.#protocol, super.protocol);
		set(this.#username, super.username);
		set(this.#password, super.password);
		set(this.#hostname, super.hostname);
		set(this.#port, super.port);
		set(this.#pathname, super.pathname);
		set(this.#hash, super.hash);
		set(this.#search, super.search);
		this.#searchParams[REPLACE](super.searchParams);
	}

	get password() {
		return get(this.#password);
	}

	set password(value) {
		super.password = value;
		set(this.#password, super.password);
	}

	get pathname() {
		return get(this.#pathname);
	}

	set pathname(value) {
		super.pathname = value;
		set(this.#pathname, super.pathname);
	}

	get port() {
		return get(this.#port);
	}

	set port(value) {
		super.port = value;
		set(this.#port, super.port);
	}

	get protocol() {
		return get(this.#protocol);
	}

	set protocol(value) {
		super.protocol = value;
		set(this.#protocol, super.protocol);
	}

	get search() {
		return get(this.#search);
	}

	set search(value) {
		super.search = value;
		set(this.#search, value);
		this.#searchParams[REPLACE](super.searchParams);
	}

	get username() {
		return get(this.#username);
	}

	set username(value) {
		super.username = value;
		set(this.#username, super.username);
	}

	get origin() {
		get(this.#protocol);
		get(this.#hostname);
		get(this.#port);
		return super.origin;
	}

	get searchParams() {
		return this.#searchParams;
	}

	toString() {
		return this.href;
	}

	toJSON() {
		return this.href;
	}
}

/**
 * @template T
 */
class ReactiveValue {
	#fn;
	#subscribe;

	/**
	 *
	 * @param {() => T} fn
	 * @param {(update: () => void) => void} onsubscribe
	 */
	constructor(fn, onsubscribe) {
		this.#fn = fn;
		this.#subscribe = createSubscriber(onsubscribe);
	}

	get current() {
		this.#subscribe();
		return this.#fn();
	}
}

const parenthesis_regex = /\(.+\)/;

// these keywords are valid media queries but they need to be without parenthesis
//
// eg: new MediaQuery('screen')
//
// however because of the auto-parenthesis logic in the constructor since there's no parentehesis
// in the media query they'll be surrounded by parenthesis
//
// however we can check if the media query is only composed of these keywords
// and skip the auto-parenthesis
//
// https://github.com/sveltejs/svelte/issues/15930
const non_parenthesized_keywords = new Set(['all', 'print', 'screen', 'and', 'or', 'not', 'only']);

/**
 * Creates a media query and provides a `current` property that reflects whether or not it matches.
 *
 * Use it carefully — during server-side rendering, there is no way to know what the correct value should be, potentially causing content to change upon hydration.
 * If you can use the media query in CSS to achieve the same effect, do that.
 *
 * ```svelte
 * <script>
 * 	import { MediaQuery } from 'svelte/reactivity';
 *
 * 	const large = new MediaQuery('min-width: 800px');
 * </script>
 *
 * <h1>{large.current ? 'large screen' : 'small screen'}</h1>
 * ```
 * @extends {ReactiveValue<boolean>}
 * @since 5.7.0
 */
class MediaQuery extends ReactiveValue {
	/**
	 * @param {string} query A media query string
	 * @param {boolean} [fallback] Fallback value for the server
	 */
	constructor(query, fallback) {
		let final_query =
			parenthesis_regex.test(query) ||
			// we need to use `some` here because technically this `window.matchMedia('random,screen')` still returns true
			query.split(/[\s,]+/).some((keyword) => non_parenthesized_keywords.has(keyword.trim()))
				? query
				: `(${query})`;
		const q = window.matchMedia(final_query);
		super(
			() => q.matches,
			(update) => on(q, 'change', update)
		);
	}
}

/** @import { Readable, Writable } from './public.js' */

/**
 * @template V
 * @overload
 * @param {() => V} get
 * @param {(v: V) => void} set
 * @returns {Writable<V>}
 */
/**
 * @template V
 * @overload
 * @param {() => V} get
 * @returns {Readable<V>}
 */
/**
 * Create a store from a function that returns state, and (to make a writable store), an
 * optional second function that sets state.
 *
 * ```ts
 * import { toStore } from 'svelte/store';
 *
 * let count = $state(0);
 *
 * const store = toStore(() => count, (v) => (count = v));
 * ```
 * @template V
 * @param {() => V} get
 * @param {(v: V) => void} [set]
 * @returns {Writable<V> | Readable<V>}
 */
function toStore(get, set) {
	var effect = active_effect;
	var reaction = active_reaction;
	var init_value = get();

	const store = writable(init_value, (set) => {
		// If the value has changed before we call subscribe, then
		// we need to treat the value as already having run
		var ran = init_value !== get();

		// TODO do we need a different implementation on the server?
		var teardown;
		// Apply the reaction and effect at the time of toStore being called
		var previous_reaction = active_reaction;
		var previous_effect = active_effect;
		set_active_reaction(reaction);
		set_active_effect(effect);

		try {
			teardown = effect_root(() => {
				render_effect(() => {
					const value = get();
					if (ran) set(value);
				});
			});
		} finally {
			set_active_reaction(previous_reaction);
			set_active_effect(previous_effect);
		}

		ran = true;

		return teardown;
	});

	if (set) {
		return {
			set,
			update: (fn) => set(fn(get())),
			subscribe: store.subscribe
		};
	}

	return {
		subscribe: store.subscribe
	};
}

/**
 * @template V
 * @overload
 * @param {Writable<V>} store
 * @returns {{ current: V }}
 */
/**
 * @template V
 * @overload
 * @param {Readable<V>} store
 * @returns {{ readonly current: V }}
 */
/**
 * Convert a store to an object with a reactive `current` property. If `store`
 * is a readable store, `current` will be a readonly property.
 *
 * ```ts
 * import { fromStore, get, writable } from 'svelte/store';
 *
 * const store = writable(0);
 *
 * const count = fromStore(store);
 *
 * count.current; // 0;
 * store.set(1);
 * count.current; // 1
 *
 * count.current += 1;
 * get(store); // 2
 * ```
 * @template V
 * @param {Writable<V> | Readable<V>} store
 */
function fromStore(store) {
	let value = /** @type {V} */ (undefined);

	const subscribe = createSubscriber((update) => {
		let ran = false;

		const unsubscribe = store.subscribe((v) => {
			value = v;
			if (ran) update();
		});

		ran = true;

		return unsubscribe;
	});

	function current() {
		if (effect_tracking()) {
			subscribe();
			return value;
		}

		return get$1(store);
	}

	if ('set' in store) {
		return {
			get current() {
				return current();
			},
			set current(v) {
				store.set(v);
			}
		};
	}

	return {
		get current() {
			return current();
		}
	};
}

/** @import { BlurParams, CrossfadeParams, DrawParams, FadeParams, FlyParams, ScaleParams, SlideParams, TransitionConfig } from './public' */


/** @param {number} x */
const linear = (x) => x;

/** @param {number} t */
function cubic_out(t) {
	const f = t - 1.0;
	return f * f * f + 1.0;
}

/**
 * @param {number} t
 * @returns {number}
 */
function cubic_in_out(t) {
	return t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
}

/** @param {number | string} value
 * @returns {[number, string]}
 */
function split_css_unit(value) {
	const split = typeof value === 'string' && value.match(/^\s*(-?[\d.]+)([^\s]*)\s*$/);
	return split ? [parseFloat(split[1]), split[2] || 'px'] : [/** @type {number} */ (value), 'px'];
}

/**
 * Animates a `blur` filter alongside an element's opacity.
 *
 * @param {Element} node
 * @param {BlurParams} [params]
 * @returns {TransitionConfig}
 */
function blur(
	node,
	{ delay = 0, duration = 400, easing = cubic_in_out, amount = 5, opacity = 0 } = {}
) {
	const style = getComputedStyle(node);
	const target_opacity = +style.opacity;
	const f = style.filter === 'none' ? '' : style.filter;
	const od = target_opacity * (1 - opacity);
	const [value, unit] = split_css_unit(amount);
	return {
		delay,
		duration,
		easing,
		css: (_t, u) => `opacity: ${target_opacity - od * u}; filter: ${f} blur(${u * value}${unit});`
	};
}

/**
 * Animates the opacity of an element from 0 to the current opacity for `in` transitions and from the current opacity to 0 for `out` transitions.
 *
 * @param {Element} node
 * @param {FadeParams} [params]
 * @returns {TransitionConfig}
 */
function fade(node, { delay = 0, duration = 400, easing = linear } = {}) {
	const o = +getComputedStyle(node).opacity;
	return {
		delay,
		duration,
		easing,
		css: (t) => `opacity: ${t * o}`
	};
}

/**
 * Animates the x and y positions and the opacity of an element. `in` transitions animate from the provided values, passed as parameters to the element's default values. `out` transitions animate from the element's default values to the provided values.
 *
 * @param {Element} node
 * @param {FlyParams} [params]
 * @returns {TransitionConfig}
 */
function fly(
	node,
	{ delay = 0, duration = 400, easing = cubic_out, x = 0, y = 0, opacity = 0 } = {}
) {
	const style = getComputedStyle(node);
	const target_opacity = +style.opacity;
	const transform = style.transform === 'none' ? '' : style.transform;
	const od = target_opacity * (1 - opacity);
	const [x_value, x_unit] = split_css_unit(x);
	const [y_value, y_unit] = split_css_unit(y);
	return {
		delay,
		duration,
		easing,
		css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x_value}${x_unit}, ${(1 - t) * y_value}${y_unit});
			opacity: ${target_opacity - od * u}`
	};
}

var slide_warning = false;

/**
 * Slides an element in and out.
 *
 * @param {Element} node
 * @param {SlideParams} [params]
 * @returns {TransitionConfig}
 */
function slide(node, { delay = 0, duration = 400, easing = cubic_out, axis = 'y' } = {}) {
	const style = getComputedStyle(node);

	if (DEV && !slide_warning && /(contents|inline|table)/.test(style.display)) {
		slide_warning = true;
		Promise.resolve().then(() => (slide_warning = false));
		transition_slide_display(style.display);
	}

	const opacity = +style.opacity;
	const primary_property = axis === 'y' ? 'height' : 'width';
	const primary_property_value = parseFloat(style[primary_property]);
	const secondary_properties = axis === 'y' ? ['top', 'bottom'] : ['left', 'right'];
	const capitalized_secondary_properties = secondary_properties.map(
		(e) => /** @type {'Left' | 'Right' | 'Top' | 'Bottom'} */ (`${e[0].toUpperCase()}${e.slice(1)}`)
	);
	const padding_start_value = parseFloat(style[`padding${capitalized_secondary_properties[0]}`]);
	const padding_end_value = parseFloat(style[`padding${capitalized_secondary_properties[1]}`]);
	const margin_start_value = parseFloat(style[`margin${capitalized_secondary_properties[0]}`]);
	const margin_end_value = parseFloat(style[`margin${capitalized_secondary_properties[1]}`]);
	const border_width_start_value = parseFloat(
		style[`border${capitalized_secondary_properties[0]}Width`]
	);
	const border_width_end_value = parseFloat(
		style[`border${capitalized_secondary_properties[1]}Width`]
	);
	return {
		delay,
		duration,
		easing,
		css: (t) =>
			'overflow: hidden;' +
			`opacity: ${Math.min(t * 20, 1) * opacity};` +
			`${primary_property}: ${t * primary_property_value}px;` +
			`padding-${secondary_properties[0]}: ${t * padding_start_value}px;` +
			`padding-${secondary_properties[1]}: ${t * padding_end_value}px;` +
			`margin-${secondary_properties[0]}: ${t * margin_start_value}px;` +
			`margin-${secondary_properties[1]}: ${t * margin_end_value}px;` +
			`border-${secondary_properties[0]}-width: ${t * border_width_start_value}px;` +
			`border-${secondary_properties[1]}-width: ${t * border_width_end_value}px;` +
			`min-${primary_property}: 0`
	};
}

/**
 * Animates the opacity and scale of an element. `in` transitions animate from the provided values, passed as parameters, to an element's current (default) values. `out` transitions animate from an element's default values to the provided values.
 *
 * @param {Element} node
 * @param {ScaleParams} [params]
 * @returns {TransitionConfig}
 */
function scale(
	node,
	{ delay = 0, duration = 400, easing = cubic_out, start = 0, opacity = 0 } = {}
) {
	const style = getComputedStyle(node);
	const target_opacity = +style.opacity;
	const transform = style.transform === 'none' ? '' : style.transform;
	const sd = 1 - start;
	const od = target_opacity * (1 - opacity);
	return {
		delay,
		duration,
		easing,
		css: (_t, u) => `
			transform: ${transform} scale(${1 - sd * u});
			opacity: ${target_opacity - od * u}
		`
	};
}

/**
 * Animates the stroke of an SVG element, like a snake in a tube. `in` transitions begin with the path invisible and draw the path to the screen over time. `out` transitions start in a visible state and gradually erase the path. `draw` only works with elements that have a `getTotalLength` method, like `<path>` and `<polyline>`.
 *
 * @param {SVGElement & { getTotalLength(): number }} node
 * @param {DrawParams} [params]
 * @returns {TransitionConfig}
 */
function draw(node, { delay = 0, speed, duration, easing = cubic_in_out } = {}) {
	let len = node.getTotalLength();
	const style = getComputedStyle(node);
	if (style.strokeLinecap !== 'butt') {
		len += parseInt(style.strokeWidth);
	}
	if (duration === undefined) {
		if (speed === undefined) {
			duration = 800;
		} else {
			duration = len / speed;
		}
	} else if (typeof duration === 'function') {
		duration = duration(len);
	}
	return {
		delay,
		duration,
		easing,
		css: (_, u) => `
			stroke-dasharray: ${len};
			stroke-dashoffset: ${u * len};
		`
	};
}

/**
 * @template T
 * @template S
 * @param {T} tar
 * @param {S} src
 * @returns {T & S}
 */
function assign(tar, src) {
	// @ts-ignore
	for (const k in src) tar[k] = src[k];
	return /** @type {T & S} */ (tar);
}

/**
 * The `crossfade` function creates a pair of [transitions](https://svelte.dev/docs/svelte/transition) called `send` and `receive`. When an element is 'sent', it looks for a corresponding element being 'received', and generates a transition that transforms the element to its counterpart's position and fades it out. When an element is 'received', the reverse happens. If there is no counterpart, the `fallback` transition is used.
 *
 * @param {CrossfadeParams & {
 * 	fallback?: (node: Element, params: CrossfadeParams, intro: boolean) => TransitionConfig;
 * }} params
 * @returns {[(node: any, params: CrossfadeParams & { key: any; }) => () => TransitionConfig, (node: any, params: CrossfadeParams & { key: any; }) => () => TransitionConfig]}
 */
function crossfade({ fallback, ...defaults }) {
	/** @type {Map<any, Element>} */
	const to_receive = new Map();
	/** @type {Map<any, Element>} */
	const to_send = new Map();

	/**
	 * @param {Element} from_node
	 * @param {Element} node
	 * @param {CrossfadeParams} params
	 * @returns {TransitionConfig}
	 */
	function crossfade(from_node, node, params) {
		const {
			delay = 0,
			duration = /** @param {number} d */ (d) => Math.sqrt(d) * 30,
			easing = cubic_out
		} = assign(assign({}, defaults), params);
		const from = from_node.getBoundingClientRect();
		const to = node.getBoundingClientRect();
		const dx = from.left - to.left;
		const dy = from.top - to.top;
		const dw = from.width / to.width;
		const dh = from.height / to.height;
		const d = Math.sqrt(dx * dx + dy * dy);
		const style = getComputedStyle(node);
		const transform = style.transform === 'none' ? '' : style.transform;
		const opacity = +style.opacity;
		return {
			delay,
			duration: typeof duration === 'function' ? duration(d) : duration,
			easing,
			css: (t, u) => `
			   opacity: ${t * opacity};
			   transform-origin: top left;
			   transform: ${transform} translate(${u * dx}px,${u * dy}px) scale(${t + (1 - t) * dw}, ${
						t + (1 - t) * dh
					});
		   `
		};
	}

	/**
	 * @param {Map<any, Element>} items
	 * @param {Map<any, Element>} counterparts
	 * @param {boolean} intro
	 * @returns {(node: any, params: CrossfadeParams & { key: any; }) => () => TransitionConfig}
	 */
	function transition(items, counterparts, intro) {
		// @ts-expect-error TODO improve typings (are the public types wrong?)
		return (node, params) => {
			items.set(params.key, node);
			return () => {
				if (counterparts.has(params.key)) {
					const other_node = counterparts.get(params.key);
					counterparts.delete(params.key);
					return crossfade(/** @type {Element} */ (other_node), node, params);
				}
				// if the node is disappearing altogether
				// (i.e. wasn't claimed by the other list)
				// then we need to supply an outro
				items.delete(params.key);
				return fallback && fallback(node, params, intro);
			};
		};
	}
	return [transition(to_send, to_receive, false), transition(to_receive, to_send, true)];
}

export { MediaQuery, SvelteDate, SvelteMap, SvelteSet, SvelteURL, SvelteURLSearchParams, backIn, backInOut, backOut, blur, bounceIn, bounceInOut, bounceOut, circIn, circInOut, circOut, createSubscriber, crossfade, cubicIn, cubicInOut, cubicOut, draw, elasticIn, elasticInOut, elasticOut, expoIn, expoInOut, expoOut, fade, flip, fly, fromStore, get$1 as get, linear$1 as linear, on, quadIn, quadInOut, quadOut, quartIn, quartInOut, quartOut, quintIn, quintInOut, quintOut, scale, sineIn, sineInOut, sineOut, slide, toStore, writable };
