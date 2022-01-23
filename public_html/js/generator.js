const glob_categories = [];
const glob_filters = new Map();
const glob_range_filters = [];
const glob_entries = [];
glob_enc_tbl = null;

/**
 * @property name     String, see Category.name
 * @property weight   Integer, see Category.weight
 * @property entries  Array<Entry>, pre-filtered list of entries belonging to this category, possibly none
 * @property n        Integer, number of entries to select when EncTblGroup::getRandomEntries is called
 * @property range    Integer, total range based on selected entries; set when EncTblGroup::getRandomEntries is called
 * @property selected Array<EncTblEntry>, randomly generated list of n entries, set when EncTblGroup::getRandomEntries method
 */
class EncTblGroup {
	#dirty;
	/**
	 * @param category Category object used to set the name and weight
	 */
	constructor(category, entries = []) {
		this.name = category.name;
		this.weight = category.weight;
		this.entries = entries.sort((a, b) => a.name.localeCompare(b.name));
		this.n = 1;
		this.range = 1;
		this.#dirty = true;
		log('Created new group ' + this.name + ': ' + this.entries.reduce((sum, obj) => { return (sum ? sum + ', ' : '') + obj.name; }, ''));
	}
	#buildLookupTable() {
		this.lookup = [];
		for (let i = 0; i < this.entries.length; ++i) {
			for (let j = 0; j < this.entries[i].weight; ++j) {
				this.lookup.push(this.entries[i]);
			}
		}
		this.lastIndex = -1;
		this.#dirty = false;
	}
	/**
	 * Randomly selects up to this.n encounter entries and assigns them die ranges corresponding to their individual weight.
	 * Sets this.range to the actual total range of selected entries, which may differ from die_range (e.g. if die_range < this.n).
	 * @param die_range  Integer, total die range allocated for entries in this category; should generally be >= this.n
	 * @param duplicates Boolean, true to allow the same entry to be selected more than once
	 * @return Array<EncTblEntry> of EncTblGroup.n entries
	 */
	getRandomEntries(die_range, duplicates = false) {
		// Rebuild the lookup table if dirty
		if (this.#dirty) {
			this.#buildLookupTable();
		}
		let selected_weight = 0;
		this.selected = new Map();
		for (let i = 0; i < this.n; ++i) {
			let entry = this.#getRandomLookupEntry();
			if (!entry) {
				break;
			}
			selected_weight += entry.weight;
			if (this.selected.has(entry.name)) {
				let obj = this.selected.get(entry.name);
				obj.weight += entry.weight;
				this.selected.set(entry.name, obj);
			} else {
				let obj = new EncTblEntry(entry);
				this.selected.set(entry.name, obj);
				if (!duplicates) {
					this.#removeLastSelectedEntry();
				}
			}
		}
		// Convert to array
		this.selected = Array.from(this.selected.values());
		// Determine base encounter ranges
		let rtotal = 0;
		this.selected.forEach(e => {
			e.range = Math.ceil(die_range * (e.weight / selected_weight));
			rtotal += e.range;
			log('Set range of entry ' + e.name + ' to ' + e.range);
		});
		log('Total range for category ' + this.name + ': ' + rtotal + ' (' + die_range + ' expected)');
		// Trim excess encounter ranges while retaining the total number of entries if possible
		if (rtotal > die_range) {
			this.selected.sort((a, b) => a.range - b.range);
			for (let i = 0; rtotal > die_range && i < this.selected.length; ++i) {
				if (this.selected[i].range > 1) {
					this.selected[i].range = this.selected[i].range - 1;
					--rtotal;
					log('Reduced range of entry ' + this.selected[i].name + ' to ' + this.selected[i].range);
				}
			}
		}
		this.range = rtotal;
		return this.selected;
	}
	/**
	 * @return A random entry from the lookup table or null if none available
	 */
	#getRandomLookupEntry() {
		let n = this.lookup.length;
		if (n < 1) {
			return null;
		} else if (n === 1) {
			this.lastIndex = 0;
			return this.lookup[0];
		}
		this.lastIndex = getRandomIntInclusive(0, n - 1);
		return this.lookup[this.lastIndex];
	}
	/**
	 * Removes all entries for the last selected entry from the lookup table (to prevent duplicate results)
	 */
	#removeLastSelectedEntry() {
		if (this.lastIndex < 0) {
			return;
		}
		let entry = this.lookup[this.lastIndex];
		let first = this.lastIndex;
		let last = this.lastIndex;
		for (let i = first - 1; i > 0; --i) {
			if (this.lookup[i].name.localeCompare(entry.name) !== 0) {
				break;
			}
			first = i;
		}
		for (let i = last + 1; i < this.lookup.length; ++i) {
			if (this.lookup[i].name.localeCompare(entry.name) !== 0) {
				break;
			}
			last = i;
		}
		let n = 1 + last - first;
		this.lookup.splice(first, n);
		this.lastIndex = -1;
		this.#dirty = true;
		log('Removed ' + n + ' entries for ' + entry.name + ' from range [' + first + ', ' + last + ']' + '; this.lookup.length = ' +  this.lookup.length);
	}
}

class EncTblEntry {
	/**
	 * @param entry Entry object to possibly be encountered
	 * @param range Integer, this is generally modified dynamically when EncTblGroup#getRandomEntries is called
	 */
	constructor(entry, range = 1) {
		this.name = entry.name;
		this.weight = entry.weight;
		this.ref_src = entry.ref_src;
		this.ref_page = entry.ref_page;
		this.range = range;
		this.min = 1;
		this.max = this.min + this.range - 1;
	}
	/**
	 * @param lastEntry EncTblEntry, optional last entry that was processed
	 * @return String, entry's range in the format 'min - max' or 'min' if they are equal
	 */
	getRangeText(lastEntry = null) {
		if (lastEntry) {
			this.min = lastEntry.max + 1;
		}
		this.max = this.min + this.range - 1;
		return (this.min === this.max ? this.min : this.min + '-' + this.max);
	}
}

/**
 * Stores a generated table for convenient export
 * @property die_size      Integer, die size used to generate the table
 * @property filters       Array<Filter> of applied filters
 * @property range_filters Array<FilterRange> of applied range filters
 * @property include_meta Boolean, true to include metadata such as the die size, filter options, etc. when exported to JSON or other format
 */
class EncTblContainer {
	constructor(die_size, filters = [], range_filters = []) {
		this.die_size = die_size;
		this.entries = [];
		this.filters = filters;
		this.range_filters = range_filters;
		this.include_meta = true;
	}
	/**
	 * @param entries Array<EncTblEntry> of entries in this table
	 */
	setEntries(entries = []) {
		// Ensure all entry min/max range values are set relative to the others
		let lastEntry = null;
		entries.forEach(entry => {
			entry.getRangeText(lastEntry);
			lastEntry = entry;
		});
		this.entries = entries;
	}
	toCsv() {
		this.csv = true;
		return this.#getLines(",").join("\n");
	}
	toText() {
		this.csv = false;
		return this.#getLines("\t").join("\n");
	}
	#escTxt(txt) {
		if (this.csv) {
			txt = '' + txt; // force String type
			return '"' + txt.replace(/"/g, '""') + '"';
		}
		return txt;
	}
	#getLines(separator = "\t") {
		let lines = [];
		if (this.include_meta) {
			lines.push(this.#escTxt("RANDOM ENCOUNTER TABLE"));
			lines.push(this.#escTxt("Generated " + this.entries.length + " Encounters"));
			if (this.filters.length > 0) {
				lines.push(this.#escTxt("Filters:"));
				this.filters.forEach(obj => lines.push(this.#escTxt(obj.toText())));
			}
			if (this.range_filters.length > 0) {
				lines.push(this.#escTxt("Range Filters:"));
				this.range_filters.forEach(obj => lines.push(this.#escTxt(obj.toText())));
			}
		}
		lines.push(this.#escTxt("d" + this.die_size) + separator + this.#escTxt("Encounter") + separator + this.#escTxt("Source") + separator + this.#escTxt("Page"));
		this.entries.forEach(obj => {
			lines.push(this.#escTxt(obj.getRangeText(null)) + separator + this.#escTxt(obj.name) + separator + this.#escTxt(obj.ref_src) + separator + this.#escTxt(obj.ref_page));
		});
		return lines;
	}
}

function importData() {
	let data_box = document.getElementById('import_data_box');
	if (!data_box || data_box.value.length < 1) {
		alert('Please enter data in the box below before importing');
		return;
	}
	let data = [];
	try {
		data = JSON.parse(data_box.value, reviver);
	} catch (err) {
		alert('Import failed: invalid JSON format');
		return;
	}
	// Import categories
	if (data.categories) {
		// TODO this is a hacky way to clear the array since we declared it as a constant
		glob_categories.splice(0, glob_categories.length);
		data.categories.forEach(v => {
			try {
				let obj = new Category(v.name, v.weight);
				glob_categories.push(obj);
			} catch (err) {
				console.log("Ignored invalid weight category: " + err);
			}
		});
	}
	// Import filters
	let filters_container = document.getElementById('filters');
	if (data.filters) {
		glob_filters.clear();
		filters_container.replaceChildren();
		data.filters.forEach(v => {
			try {
				let obj = new FilterEntry(v.name, v.values);
				let el = obj.getHtmlElement('filter_' + obj.name, obj.name, 10);
				if (el) {
					// Add general-purpose filter options
					el.appendChild(document.createElement('BR'));
					let box = getdLabeledCheckbox('filter_and_' + obj.name, 'Match All', 'Encounter entries  must match all selected filters of this type if checked');
					el.appendChild(box);
					el.appendChild(document.createElement('BR'));
					box = getdLabeledCheckbox('filter_not_' + obj.name, 'Exclude Selected', 'Excludes encounter entries that match selected filters of this type if checked');
					el.appendChild(box);
					filters_container.appendChild(el);
					glob_filters.set(obj.name, obj);
				}
			} catch (err) {
				console.log("Ignored invalid filter entry: " + err);
			}
		});
	}
	// Import range filters
	let range_filters_container = document.getElementById('range_filters_container');
	let range_filters = document.getElementById('range_filters');
	if (data.range_filters) {
		glob_range_filters.splice(0, glob_range_filters.length);
		range_filters_container.classList.remove('hide');
		range_filters.replaceChildren();
		data.range_filters.forEach(col => {
			let el = getRangeFilterTableRow(col);
			if (el) {
				glob_range_filters.push(col);
				range_filters.appendChild(el);
			}
		});
	} else {
		range_filters_container.classList.add('hide');
	}
	// Import encounter entries
	if (data.entries) {
		// TODO this is a hacky way to clear the array since we declared it as a constant
		glob_entries.splice(0, glob_entries.length);
		let sources = new Map();
		let add_src_filter = (!glob_filters.has('Reference'));
		data.entries.forEach(v => {
			try {
				let obj = new Entry(v.name, v.weight, v.weight_id, v.ref_src, v.ref_page, v.filters);
				if (data.range_filters) {
					data.range_filters.forEach(col => {
						let value = parseInt(v[col]);
						if (value === value) {
							obj[col] = value;
						}
					});
				}
				glob_entries.push(obj);
				if (add_src_filter && obj.ref_src !== '') {
					sources.set(obj.ref_src, 1);
				}
			} catch (err) {
				console.log("Ignored invalid entry: " + err);
			}
		});
		if (sources.size > 1) {
			let values = Array.from(sources.keys());
			let obj = new FilterEntry('Reference', values);
			let el = obj.getHtmlElement('filter_' + obj.name, obj.name);
			if (el) {
				filters_container.appendChild(el);
				glob_filters.set(obj.name, obj);
			}
		}
	}
	if (typeof err === 'undefined') {
		alert('Data imported successfully');
	} else {
		alert('One or more errors were detected - see console for details');
	}
}

/**
 * Builds a labeled checkbox <input> element
 * @param name  String, name to assign to the checkbox input
 * @param label String, label text for the checkbox's enclosing label element
 * @param title String, title for the label element
 * @return HTML element
 */
function getdLabeledCheckbox(name, label, title) {
	let container = document.createElement('LABEL');
	container.title = title;
	let input = document.createElement('INPUT');
	input.type = 'checkbox';
	input.id = name;
	input.name = name;
	container.appendChild(input);
	let span = document.createElement('SPAN');
	span.innerHTML = '&nbsp;' + label;
	container.appendChild(span);
	return container;
}

function getRangeFilterTableRow(col) {
	let tr = document.createElement('TR');
	let td = document.createElement('TD');
	td.innerHTML = col;
	tr.appendChild(td);
	['min','max'].forEach(v => {
		td = document.createElement('TD');
		createRangeFilterInput(td, col, v, false);
		tr.appendChild(td);
	});
	td = document.createElement('TD');
	let input = document.createElement('INPUT');
	input.type = 'checkbox';
	input.id = col + '_range_not';
	input.name = input.id;
	td.appendChild(input);
	tr.appendChild(td);
	return tr;
}

function createRangeFilterInput(container, col, suffix, add_label = false) {
	let input = document.createElement('INPUT');
	input.id = col + '_range_' + suffix;
	input.name = input.id;
	input.type = 'number';
	if (add_label) {
		let label = document.createElement('LABEL');
		label.htmlFor = input.id;
		let prefix = col.charAt(0).toLocaleUpperCase() + col.slice(1);
		label.innerHTML = prefix + ' ' + suffix.charAt(0).toLocaleUpperCase() + suffix.slice(1);
		container.appendChild(label);
		container.appendChild(document.createElement('BR'));
	}
	container.appendChild(input);
}

function generateEncounterTable() {
	let die_size = parseInt(document.getElementById('die_size').value);
	let num_entries = parseInt(document.getElementById('num_entries').value);
	let allow_duplicates = document.getElementById('allow_duplicates').checked;
	let include_ungrouped = document.getElementById('include_ungrouped').checked;
	glob_enc_tbl = new EncTblContainer(die_size);
	// Apply filters to a copy of the encounter list
	let entries = glob_entries;
	log('Starting list length: ' + entries.length);
	let option_container = document.getElementById('enc_opt_container');
	option_container.replaceChildren();
	glob_filters.forEach((obj, key) => {
		let sel = document.getElementById('filter_' + key);
		let values = [];
		for (let i = 0; i < sel.options.length; ++i) {
			if (sel.options[i].selected) {
				values.push(obj.values[sel.options[i].value]);
			}
		}
		if (values.length > 0) {
			let and = document.getElementById('filter_and_' + key).checked;
			let not = document.getElementById('filter_not_' + key).checked;
			let filter = new Filter(obj, and, not, values);
			glob_enc_tbl.filters.push(filter);
			entries = entries.filter(v => filter.apply(v));
			let p = document.createElement('SPAN');
			p.innerHTML = filter.toText();
			option_container.appendChild(p);
			option_container.appendChild(document.createElement('BR'));
		}
	});
	// Apply range filters
	glob_range_filters.forEach(col => {
		let min = parseInt(document.getElementById(col + '_range_min').value);
		let max = parseInt(document.getElementById(col + '_range_max').value);
		let not = document.getElementById(col + '_range_not').checked;
		if (min === min && max === max) {
			let filter = new FilterRange(col, min, max, not);
			glob_enc_tbl.range_filters.push(filter);
			entries = entries.filter(v => filter.apply(v));
			let p = document.createElement('SPAN');
			p.innerHTML = filter.toText();
			option_container.appendChild(p);
			option_container.appendChild(document.createElement('BR'));
		}
	});
	log('Filtered list length: ' + entries.length);
	// Group remaining entries by encounter weight category
	let total_weight = 0;
	let groups = new Map();
	for (let i = 0; i < glob_categories.length; ++i) {
		let group_entries = entries.filter(v => v.weight_id === i);
		if (group_entries.length > 0) {
			let group = new EncTblGroup(glob_categories[i], group_entries);
			groups.set(group.name, group);
			total_weight += group.weight;
		}
	};
	if (groups.size > 0) {
		// Capture any ungrouped entries
		if (include_ungrouped) {
			let group_entries = entries.filter(v => v.weight_id < 0);
			if (group_entries.length > 0) {
				let cat = new Category("Default", 1);
				let group = new EncTblGroup(cat, group_entries);
				groups.set(group.name, group);
				total_weight += group.weight;
			}
		}
		// Determine number of encounter entries expected from each group based on the their weight
		let total_n = 0;
		let unused = 0;
		groups.forEach((group, key) => {
			let n = Math.ceil(num_entries * group.weight / total_weight);
			group.n = Math.min(group.n, group.entries.length);
			total_n += group.n;
			unused += group.entries.length - group.n;
			log('Set n to ' + group.n + ' for group ' + group.name + ' [n = ceil(' + num_entries + ' * ' + group.weight + ' / ' + total_weight + '), maximum = ' + group.entries.length + ']');
		});
		// Pad encounter groups if possible until requested number of entries if filled
		if (total_n < num_entries && unused > 0) {
			let remainder = num_entries - total_n;
			log('Attempting to fill ' + remainder + ' entries; unused = ' + unused);
			for (const group of groups.values()) {
				let r = num_entries - total_n;
				let diff = group.entries.length - group.n;
				if (r > 0 && diff > 0) {
					let n = Math.ceil(remainder * diff / unused);
					n = Math.min(r, n, diff);
					group.n = group.n + n;
					total_n += n;
					log('Added ' + n + ' entries to group ' + group.name + ' [group.n = ' + group.n + '; group.entries.length = ' + group.entries.length + ']');
				}
			}
		}
		// Remove excess encounter numbers, if any
		while (total_n > num_entries) {
			let group = getRandomGroup(groups, total_weight);
			if (group) {
				--total_n;
				group.n = group.n - 1;
				log('Subtracted 1 n from group ' + group.name + '; remaining n = ' + group.n);
				if (group.n < 1) {
					log('n < 1, removing group ' + group.name);
					groups.delete(group.name);
					total_weight -= group.weight;
				}
			}
			// Probably not necessary but why not
			if (groups.size < 1 || total_weight < 1) {
				break;
			}
		}
		log('Final number of entries to be selected: ' + total_n);
	} else if (entries.length > 0) {
		total_weight = entries.reduce((sum, obj) => { return sum + obj.weight; }, 0);
		let cat = new Category("Default", total_weight);
		let group = new EncTblGroup(cat, entries);
		group.n = num_entries;
		group.range = die_size;
		groups.set(group.name, group);
	}
	log('Total weight: ' + total_weight);
	// Generate random entries for each group
	let total_die_size = 0;
	let tbl_entries = [];
	groups.forEach((group, key) => {
		let range = Math.ceil(die_size * (group.weight / total_weight));
		let selected = group.getRandomEntries(range, allow_duplicates);
		total_die_size += group.range;
		tbl_entries.push(...selected);
	});
	log("Expected die size: " + die_size + " vs Actual: " + total_die_size);
	// Sort encounter entries by range (DESC) and alphabetically (ASC)
	tbl_entries.sort((a, b) => {
		if (a.range === b.range) {
			return a.name.localeCompare(b.name);
		}
		return b.range - a.range;
	});
	// Trim excess range if any
	if (total_die_size > die_size) {
		// Remove from least likely encounters first
		for (let i = tbl_entries.length - 1; i > 0 && total_die_size > die_size; --i) {
			if (tbl_entries[i].range > 1) {
				tbl_entries[i].range = tbl_entries[i].range - 1;
				--total_die_size;
				log('Reduced range by 1 for ' + tbl_entries[i].name);
			}
		}
	}
	// Display results
	if (tbl_entries.length > 0) {
		glob_enc_tbl.setEntries(tbl_entries);
		document.getElementById('tbl_n').innerHTML = tbl_entries.length;
		document.getElementById('tbl_die_size').innerHTML = 'd' + die_size;
		displayEncounterTable(tbl_entries);
	} else {
		glob_enc_tbl = null;
	}
}

function getRandomGroup(groups, total_weight) {
	let n = getRandomIntInclusive(1, total_weight);
	let w = 1;
	for (const [key, obj] of groups) {
		if (n < (obj.weight + w)) {
			return obj;
		}
		w += obj.weight;
	}
}

/**
 * @param entries Array<EncTblEntry> of entries to add to the table
 */
function displayEncounterTable(entries) {
	document.getElementById('enc_tbl_container').classList.remove('hide');
	let body = document.getElementById('enc_tbl_entries');
	body.replaceChildren();
	let template = document.getElementById('row_template');
	let lastEntry = null;
	entries.forEach(entry => {
		let row = template.cloneNode(true);
		row.removeAttribute('id');
		row.children[0].innerHTML = entry.getRangeText(lastEntry);
		row.children[1].innerHTML = entry.name;
		row.children[2].innerHTML = entry.ref_src;
		row.children[3].innerHTML = entry.ref_page;
		body.appendChild(row);
		lastEntry = entry;
	});
}

function exportData() {
	if (!glob_enc_tbl || glob_enc_tbl.entries.length < 1) {
		return;
	}
	let check_meta = document.getElementById('include_meta');
	glob_enc_tbl.include_meta = (check_meta && check_meta.checked);
	let sel_format = document.getElementById('export_format');
	let format = 'csv';
	if (sel_format && sel_format.selectedIndex > -1) {
		format = sel_format.options[sel_format.selectedIndex].value;
	}
	let data_box = document.getElementById('export_data_box');
	let output = null;
	switch (format) {
	case 'csv':
		output = glob_enc_tbl.toCsv();
		break;
	default: // fall back to 'txt' for invalid options
		output = glob_enc_tbl.toText();
		break;
	}
	if (data_box && output) {
		data_box.value = output;
	}
}

window.addEventListener('load', function(event) {
	document.getElementById('generate_table').addEventListener('click', generateEncounterTable);
	document.getElementById('export_data').addEventListener('click', exportData);
	document.getElementById('import_data').addEventListener('click', importData);
});
