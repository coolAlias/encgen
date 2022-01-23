debug_mode = true;
/**
 * Class that excludes properties with the default value from JSON output.
 */
class MinJson {
	isDefault(key) {
		return false;
	}
	toJSON() {
		let json = {};
		for (let k in this) {
			if (!this.isDefault(k)) {
				json[k] = this[k];
			}
		}
		return json;
	}
}

/**
 * Object for encounter frequency categories
 * @property name   String, unique name for the weight category, e.g. "Very Rare"
 * @property weight Integer, weighted prevalence of this category (minimum = 1)
 */
class Category extends MinJson {
	constructor(name, weight = 1) {
		super();
		if (typeof name !== 'string' || name.length < 1) {
			throw new Error('Category.name must be a non-empty String');
		}
		if (!Number.isSafeInteger(weight) || weight < 1) {
			throw new Error('Category.weight must be an integer greater than 0');
		}
		this.name = name;
		this.weight = weight;
	}
	isDefault(key) {
		switch (key) {
		case 'weight': return this.weight === 1;
		}
		return false;
	}
}

/**
 * A filter entry defines a set of valid values, any number of which may be applied when generating an encounter table.
 * @property name   String, unique name for the filter grouping, e.g. "Climate"
 * @property values Array<String> containing all valid values for this filter entry
 */
class FilterEntry extends MinJson {
	constructor(name, values = []) {
		super();
		if (typeof name !== 'string' || name.length < 1) {
			throw new Error('FilterEntry.name must be a non-empty String');
		}
		this.name = name;
		if (Array.isArray(values)) {
			this.values = values.filter(s => typeof s === 'string' && s.length > 0);
		} else {
			this.values = [];
		}
	}
	/**
	 * @param id   String, desired element ID, if any
	 * @param name String, desired element name; defaults to the filter entry's name
	 * @param max_size Integer, maximum value for the select element's size attribute
	 * @return HTML <select> element for the provided filter entry, or false if not valid
	 */
	getHtmlElement(id, name, max_size = 5) {
		if (this.values.length < 1) {
			return false;
		}
		if (!Number.isSafeInteger(max_size)) {
			max_size = 5;
		}
		let div = document.createElement('DIV');
		div.classList.add('fleft');
		div.classList.add('container');
		let lab = document.createElement('LABEL');
		if (id) {
			lab.htmlFor = id;
		}
		lab.innerHTML = this.name;
		div.appendChild(lab);
		div.appendChild(document.createElement('BR'));
		let sel = document.createElement('SELECT');
		if (id) {
			sel.id = id;
		}
		sel.name = (name ? name : this.name);
		sel.setAttribute('multiple', true);
		sel.setAttribute('size', Math.min(this.values.length, max_size));
		for (let i = 0; i < this.values.length; ++i) {
			let v = this.values[i];
			let opt = document.createElement('OPTION');
			opt.value = i;
			opt.innerHTML = v;
			sel.appendChild(opt);
		};
		div.appendChild(sel);
		return div;
	}
}

/**
 * Creates a filter with the specified rules
 * @property name   String, key of the FilterEntry object
 * @property and    Boolean, true to require all values to match
 * @property not    Boolean, true to require entries to NOT match the selected values
 * @property values Array<Integer> of currently selected values, each corresponding to a FilterEntry#values array index
 */
class Filter {
	/**
	 * @param filter FilterEntry object used to validate the values
	 * @param values Array<String> of currently selected FilterEntry values
	 */
	constructor(filter, and = false, not = false, values = []) {
		if (!(filter instanceof FilterEntry)) {
			throw new Error('Invalid argument type; expected FilterEntry');
		} else if (values.length < 1) {
			throw new Error('Filter requires at least one selected value');
		}
		this.filter = filter;
		this.name = filter.name;
		this.and = and;
		this.not = not;
		this.values = [];
		values.forEach(s => {
			let i = filter.values.indexOf(s);
			if (i > -1) {
				this.values.push(i);
			}
		});
	}
	/**
	 * Checks the entry against the filter rules
	 * @param entry Entry object
	 * @return Boolean, true if the entry has at least one selected value for this filter and all rules were passed
	 */
	apply(entry) {
		if (!(entry instanceof Entry)) {
			return false;
		}
		let matches = entry.filters.get(this.name);
		if (!matches || matches.length < 1) {
			log(entry.name + ' failed ' + this.name + ' filter: not applicable');
			return false;
		}
		if (this.not) {
			// NOT AND: Must not contain any of the selected entries
			// NOT OR: Must contain at least one entry that was not selected
			for (let i = 0; i < matches.length; ++i) {
				let index = this.values.indexOf(matches[i]);
				if (this.and) {
					if (index > -1) {
						log(entry.name + ' failed ' + this.name + ' filter(NOT AND): ' + matches + ' contained at least one of the selected values ' + this.values);
						return false;
					}
				} else if (index < 0) {
					log(entry.name + ' passed ' + this.name + ' filter(NOT OR): ' + matches + ' contained at least one entry NOT in the selected values ' + this.values);
					return true;
				}
			};
			if (this.and) {
				log(entry.name + ' passed ' + this.name + ' filter(NOT AND): ' + matches + ' did not contain any of the selected values ' + this.values);
			} else {
				log(entry.name + ' failed ' + this.name + ' filter(NOT OR): ' + matches + ' did not contain any entries NOT in the selected values ' + this.values);
			}
			return this.and;
		} else {
			// AND: Must contain all of the selected entries
			// OR: Must contain at least one selected entry
			for (let i = 0; i < this.values.length; ++i) {
				let index = matches.indexOf(this.values[i]);
				if (this.and) {
					if (index < 0) {
						log(entry.name + ' failed ' + this.name + ' filter(AND): ' + matches + ' did not contain all of the selected values ' + this.values);
						return false;
					}
				} else if (index > -1) {
					log(entry.name + ' passed ' + this.name + ' filter(OR): ' + matches + ' contained at least one entry in the selected values ' + this.values);
					return true;
				}
			};
			if (this.and) {
				log(entry.name + ' passed ' + this.name + ' filter(AND): ' + matches + ' contained all of the selected values ' + this.values);
			} else {
				log(entry.name + ' failed ' + this.name + ' filter(OR): ' + matches + ' did not contain any of the selected values ' + this.values);
			}
			return this.and;
		}
	}
	toText() {
		let txt_values = [];
		this.values.forEach(v => txt_values.push(this.filter.values[v]));
		if (this.and) {
			return this.name + ' containing ' + (this.not ? 'NO' : 'ALL') + ' values in [' + txt_values + ']';
		}
		return this.name + ' containing at least one value ' + (this.not ? 'NOT ' : '') + 'in [' + txt_values + ']';
	}
}

/**
 * A filter that includes or excludes entries based on a [min, max] range instead of specific values.
 * @property name   String, key of the Entry object property to check
 * @property min    Integer, the minimum acceptable value
 * @property max    Integer, the maximum acceptable value
 * @property not    Boolean, true to require entries to NOT match the defined range
 */
class FilterRange {
	constructor(name, min, max, not = false) {
		if (!Number.isSafeInteger(min)) {
			throw new Error('FilterRange.min must be an integer value');
		}
		if (!Number.isSafeInteger(max)) {
			throw new Error('FilterRange.max must be an integer value');
		}
		this.name = name;
		this.min = Math.min(min, max);
		this.max = Math.max(min, max);
		this.not = not;
	}
	/**
	 * Checks the entry against the filter rules
	 * @param entry Entry object to validate
	 * @return Boolean, true if the entry has the requested property and its value meets the range requirements
	 */
	apply(entry) {
		if (!(entry instanceof Entry)) {
			return false;
		} else if (!entry.hasOwnProperty(this.name)) {
			return false;
		}
		let value = entry[this.name];
		let in_range = (value >= this.min && value <= this.max);
		if (this.not) {
			in_range = !in_range;
		}
		log(entry.name + (in_range ? ' passed' : ' failed') + ' range filter(' + this.name + (this.not ? 'NOT ' : '') + ') between ' + this.min + ' and ' + this.max);
		return in_range;
	}
	toText() {
		return 'Range filter for Entry.' + this.name + (this.not ? ' NOT' : '') + ' between ' + this.min + ' and ' + this.max;
	}
}

/**
 *
 * @property name      String, unique name for the entry, e.g. "Goblin"
 * @property weight    Integer, individual encounter weight
 * @property weight_id Integer, encounter weight category id
 * @property ref_src   String, optional name of reference source, e.g. "HoB 1" or "www.monsters.com"
 * @property ref_page  String, optional reference page number, e.g. "140" or "/goblin"
 * @property filters   Map<String, Array<Integer>> of applicable FilterEntry value array indices keyed by FilterEntry name
 */
class Entry extends MinJson {
	constructor(name, weight = 1, weight_id = -1, ref_src = '', ref_page = '', filters = null) {
		super();
		if (typeof name !== 'string' || name.length < 1) {
			throw new Error('Entry.name must be a non-empty String');
		}
		if (!Number.isSafeInteger(weight) || weight < 1) {
			throw new Error('Entry.weight must be an integer greater than 0');
		}
		if (!Number.isSafeInteger(weight_id)) {
			throw new Error('Entry.weight_id must be an integer');
		}
		this.name = name;
		this.weight = weight;
		this.weight_id = weight_id;
		this.ref_src = (typeof ref_src === 'string' ? ref_src : '');
		this.ref_page = (typeof ref_page === 'string' ? ref_page : '');
		if (filters instanceof Map) {
			this.filters = filters;
		} else {
			this.filters = new Map();
		}
	}
	isDefault(key) {
		switch (key) {
		case 'filters': return this.filters.size === 0;
		case 'ref_src': return this.ref_src.length === 0;
		case 'ref_page': return this.ref_page.length === 0;
		case 'weight': return this.weight === 1;
		case 'weight_id': return this.weight_id < 0;
		}
		return false;
	}
}

function getRandomIntInclusive(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Logs a message to the console if the global var 'debug_mode' is true
 */
function log(message) {
	if (typeof debug_mode !== 'undefined' && debug_mode) {
		console.log(message);
	}
}

/**
 * JSON.stringify replacer function that handles Map objects
 */
function replacer(key, value) {
	if (value instanceof Map) {
		return {
			dataType: 'Map',
			value: Array.from(value.entries()),
		};
	}
	return value;
}

/**
 * JSON.stringify reviver function that handles Map objects
 */
function reviver(key, value) {
	if (typeof value === 'object' && value !== null) {
		if (value.dataType === 'Map') {
			return new Map(value.value);
		}
	}
	return value;
}

/**
 * Resets child <input>, <select>, and <textarea> elements
 * @param entry Parent element
 */
function resetFormInputs(entry) {
	let inputs = entry.getElementsByTagName('INPUT');
	for (let i = 0; i < inputs.length; ++i) {
		let def = inputs[i].getAttribute('data-default');
		inputs[i].value = def;
	}
	let selects = entry.getElementsByTagName('SELECT');
	for (let i = 0; i < selects.length; ++i) {
		let def = selects[i].getAttribute('data-default');
		selects[i].selectedIndex = (def === null ? -1 : def);
	}
	let texts = entry.getElementsByTagName('TEXTAREA');
	for (let i = 0; i < texts.length; ++i) {
		let def = texts[i].getAttribute('data-default');
		texts[i].value = def;
	}
}

/**
 * Checks validity of all child <input>, <select>, and <textarea> elements
 * @param entry Parent element
 * @param force Boolean, true to validate elements with the 'no_validate' tag
 * @return false if validateInput() returns false for any of input element
 */
function validateInputGroup(entry, force = false) {
	let is_valid = true;
	let inputs = entry.getElementsByTagName('INPUT');
	Array.from(inputs).forEach(e => {
		if (!validateInput(e, force)) {
			is_valid = false;
		}
	});
	let selects = entry.getElementsByTagName('SELECT');
	Array.from(selects).forEach(e => {
		if (!validateInput(e, force)) {
			is_valid = false;
		}
	});
	let texts = entry.getElementsByTagName('TEXTAREA');
	Array.from(texts).forEach(e => {
		if (!validateInput(e, force)) {
			is_valid = false;
		}
	});
	return is_valid;
}

/**
 * @param entry Form element to validate
 * @param force Boolean, true to validate elements with the 'no_validate' tag
 */
function validateForm(entry, force = false) {
	let is_valid = true;
	Array.from(entry.elements).forEach(e => {
		if (!validateInput(e, force)) {
			is_valid = false;
		}
	});
	return is_valid;
}

/**
 * Checks the validity of a single <input>, <select>, or <textarea> element, updating the class list accordingly
 * @param input HTML element to validate
 * @param force Boolean, true to validate elements with the 'no_validate' tag
 * @return true if valid or no validation required
 */
function validateInput(input, force = false) {
	if (!force && input.classList.contains('no_validate')) {
		input.classList.remove('error');
		return true;
	} else if (input.checkValidity()) {
		input.classList.remove('error');
		return true;
	} else {
		input.classList.add('error');
		return false;
	}
}

/**
 * Displays the content associated with the selected tab and hides content associated with any other tabs in the group.
 * Assumptions:
 *  - a single parent element contains all tabs in any given group
 *  - each tab is a clickable element (e.g. <a>) inside a parent element (e.g. <div> or <li>)
 * @param container_id String, the id of the content container to be displayed for the tab; URL hash will be set to this value
 */
function selectTab(container_id) {
	const prefix = 'tab-';
	let tab = document.getElementById(prefix + container_id);
	let container = document.getElementById(container_id);
	if (container && tab) {
		Array.from(tab.parentNode.children).forEach(function(e) {
			e.classList.remove("tab_selected");
			let el = document.getElementById(e.id.substr(prefix.length));
			if (el) {
				el.classList.add('hide');
			}
		});
		container.classList.remove('hide');
		tab.classList.add("tab_selected");
		history.replaceState(undefined, undefined, '#'+container_id);
	}
	return false;
}

window.addEventListener("load", function(event) {
	document.getElementById('copy_data_box').addEventListener('click', function(e) {
		let target = document.getElementById(this.htmlFor);
		navigator.clipboard.writeText(target.value).then(function() {
			console.log('Copying to clipboard was successful.');
		}, function(err) {
			console.error('Failed to copy text: ', err);
		});
	});
	if (document.location.hash) {
		let hash = document.location.hash.substr(1, document.location.hash.length);
		selectTab(hash);
	}
});
