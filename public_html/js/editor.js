/**
 * Copies the specified element to the target container
 * @param entry_id String, id of element to clone
 * @param target_id String, target container id
 */
function addEntry(entry_id, target_id) {
	let entry = document.getElementById(entry_id);
	let target = document.getElementById(target_id);
	return addEntryToElement(entry, target);
}

/**
 * Copies the specified element to the target container
 * @param entry  HTML DOM element of entry to be added
 * @param target HTML DOM element of container
 */
function addEntryToElement(entry, target) {
	if (!entry || !target) { return false; }
	if (!validateInputGroup(entry, true)) {
		document.forms[0].reportValidity();
		return false;
	}
	let clone = entry.cloneNode(true);
	// Clone doesn't handle selected options on <select> elements, so do it manually
	let a = entry.getElementsByTagName('SELECT');
	if (a.length > 0) {
		let b = clone.getElementsByTagName('SELECT');
		for (let i = 0; i < a.length; ++i) {
			for (let j = 0; j < a[i].options.length; ++j) {
				if (a[i].options[j].selected) {
					b[i].options[j].selected = true;
				}
			}
		}
	}
	clone.removeAttribute('id');
	Array.from(clone.children).forEach(child => {
		child.removeAttribute('id');
		child.children[0].classList.remove('no_validate');
	});
	// Assumes a specific HTML structure for the Add/Remove link's parent and container
	let remove = getRemoveEntryElement();
	clone.children[0].replaceChild(remove, clone.children[0].children[0]);
	target.appendChild(clone);
	// Reset form inputs on original element
	resetFormInputs(entry);
	return true;
}

function getRemoveEntryElement() {
	let a = document.createElement('A');
	a.href = 'javascript:;';
	a.title = 'Delete this entry';
	a.innerHTML = '[&minus;]';
	a.addEventListener('click', removeEntry);
	return a;
}

function removeEntry() {
	let entry = this.parentNode.parentNode;
	entry.remove();
}

/**
 * Refreshes the Encounter Entry input templates for Categories and Filters using current form data.
 */
function refreshDataElements() {
	buildCategoryOptions('select_entry_category');
	buildFilterEntryElements('entries_filters_container');
	buildRangeFilterCols();
}

/**
 * Updates new Encounter Entry <select> element options for Weight Category
 * @param target_id String, target container id
 */
function buildCategoryOptions(target_id) {
	let target = document.getElementById(target_id);
	if (!target) {
		return;
	}
	target.replaceChildren();
	let default_category = document.createElement('OPTION');
	default_category.value = -1;
	default_category.innerHTML = 'None';
	target.appendChild(default_category);
	let categories = getCategories();
	for (let i = 0; i < categories.length; ++i) {
		let cat = document.createElement('OPTION');
		cat.value = i;
		cat.innerHTML = categories[i].name;
		target.appendChild(cat);
	}
}

/**
 * Builds the FilterEntry <select> element templates used for new Encounter Entries
 * and places them in the target container, replacing any existing contents.
 * @param target_id String, target container id
 */
function buildFilterEntryElements(target_id) {
	let filters = getFilterEntries();
	let target = document.getElementById(target_id);
	if (!target || !filters || filters.size < 1) {
		return;
	}
	target.replaceChildren();
	Array.from(filters.values()).forEach(v => {
		try {
			let obj = new FilterEntry(v.name, v.values);
			let el = obj.getHtmlElement(null, 'filter_' + obj.name + '[]');
			if (el) {
				target.appendChild(el);
			}
		} catch (err) {
			console.log("Ignored invalid filter entry: " + err);
		}
	});
	return false;
}

function buildRangeFilterCols() {
	let filter_range_cols = document.getElementById('filter_range_cols');
	let range_cols = (filter_range_cols ? filter_range_cols.value.split("\n").filter(s => s.length > 0) : []);
	// Remove any non-matching range cols
	let old = document.getElementsByClassName('range_col');
	let existing_cols = [];
	if (old) {
		for (let i = old.length - 1; i >= 0; --i) {
			let found = false;
			if (range_cols.length > 0) {
				for (let j = 0; j < range_cols.length && !found; ++j) {
					let col_name = 'col-' + range_cols[j];
					if (old[i].classList.contains(col_name)) {
						found = true;
						existing_cols.push(col_name);
					}
				}
			}
			if (!found) {
				old[i].remove();
			}
		}
	}
	// Add any newly defined range cols
	if (range_cols.length > 0) {
		let header = document.getElementById('entries_header');
		let template = document.getElementById('entries_new');
		range_cols.forEach(col => {
			let col_name = 'col-' + col;
			if (existing_cols.indexOf(col_name) > -1) {
				return;
			}
			let th = document.createElement('TH');
			th.classList.add(col_name);
			th.classList.add('range_col');
			th.innerHTML = col.charAt(0).toLocaleUpperCase() + col.slice(1);
			header.insertBefore(th, header.lastElementChild);
			let td = document.createElement('TD');
			td.classList.add(col_name);
			td.classList.add('range_col');
			let input = document.createElement('INPUT');
			input.classList.add('no_validate');
			input.type = 'number';
			input.name = 'range_' + col + '[]';
			td.appendChild(input);
			template.insertBefore(td, template.lastElementChild);
		});
	}
}

/**
 * @return Array<Category> based on user inputs
 */
function getCategories() {
	let names = document.getElementsByName('categories_name[]');
	let weights = document.getElementsByName('categories_weight[]');
	if (names.length !== weights.length) {
		throw new Error('Invalid input data for weight categories');
	}
	let categories = [];
	for (let i = 0; i < names.length; ++i) {
		if (names[i].classList.contains('no_validate')) {
			continue; // do not process templates until added
		}
		try {
			let weight = (weights[i].value === undefined ? 1 : parseInt(weights[i].value));
			let obj = new Category(names[i].value, weight);
			categories.push(obj);
		} catch (err) {
			console.log(err);
		}
	}
	return categories;
}

/**
 * @return Map<String, FilterEntry> based on user inputs, keyed by the filter entry's name
 */
function getFilterEntries() {
	let names = document.getElementsByName('filters_name[]');
	let values = document.getElementsByName('filters_values[]');
	if (names.length !== values.length) {
		throw new Error('Invalid input data for filters');
	}
	let filters = new Map();
	for (let i = 0; i < names.length; ++i) {
		if (names[i].classList.contains('no_validate')) {
			continue; // do not process templates until added
		}
		try {
			let entries = values[i].value.split("\n");
			let obj = new FilterEntry(names[i].value, entries);
			filters.set(obj.name, obj);
		} catch (err) {
			console.log(err);
		}
	}
	return filters;
}

/**
 * @param filters Map<String, FilterEntry> of existing filters
 * @return Array<Entry> based on user inputs
 */
function getEntries(filters) {
	let names = document.getElementsByName('entries_name[]');
	let weights = document.getElementsByName('entries_weight[]');
	let weight_ids = document.getElementsByName('entries_category[]');
	let sources = document.getElementsByName('entries_ref_src[]');
	let pages = document.getElementsByName('entries_ref_page[]');
	let filter_range_cols = document.getElementById('filter_range_cols');
	let range_cols = (filter_range_cols ? filter_range_cols.value.split("\n").filter(s => s.length > 0) : []);
	let range_filters = new Map();
	range_cols.forEach(col => {
		let ranges = document.getElementsByName('range_' + col + '[]');
		if (!ranges || ranges.length !== names.length) {
			throw new Error('Invalid input data for encounter entries - missing Range Filter column ' + col);
		}
		range_filters.set(col, ranges);
	});
	if (names.length !== weights.length || weights.length !== weight_ids.length || weight_ids.length !== sources.length || sources.length !== pages.length) {
		throw new Error('Invalid input data for encounter entries');
	}
	let entries_filters = new Map();
	if (filters instanceof Map) {
		Array.from(filters.keys()).forEach(k => {
			let name = 'filter_' + k + '[]';
			let inputs = document.getElementsByName(name);
			if (!inputs || inputs.length !== names.length) {
				throw new Error('Invalid input data for encounter entries filter: ' + k);
			}
			entries_filters.set(k, inputs);
		});
	}
	let entries = [];
	for (let i = 0; i < names.length; ++i) {
		if (names[i].classList.contains('no_validate')) {
			continue; // do not process templates until added
		}
		try {
			let weight = parseInt(weights[i].value);
			if (weight !== weight) {
				weight = undefined;
			}
			let weight_id = parseInt(weight_ids[i].value);
			if (weight_id !== weight_id) {
				weight_id = undefined;
			}
			let ref_src = sources[i].value;
			let ref_page = pages[i].value;
			let entry_filters = new Map();
			entries_filters.forEach(function(values, key) {
				let selected = [];
				Array.from(values[i].selectedOptions).forEach(v => {
					let parsed = parseInt(v.value);
					let val = (parsed === parsed ? parsed : v.value);
					selected.push(val);
				});
				if (selected.length > 0) {
					entry_filters.set(key, selected);
				}
			});
			let obj = new Entry(names[i].value, weight, weight_id, ref_src, ref_page, entry_filters);
			range_filters.forEach(function(values, key) {
				let value = parseInt(values[i].value);
				if (value === value) {
					obj[key] = value;
				}
			});
			entries.push(obj);
		} catch (err) {
			console.log(err);
		}
	}
	return entries;
}

function exportData() {
	let _form = document.getElementById('data_form');
	if (!validateForm(_form)) {
		_form.reportValidity();
		return;
	}
	let categories = getCategories();
	let filters = getFilterEntries();
	let entries = getEntries(filters);
	let data = new Object();
	if (categories.length > 0) {
		data.categories = categories;
	}
	if (filters.size > 0) {
		data.filters = Array.from(filters.values());
	}
	// Range filters
	let filter_range_cols = document.getElementById('filter_range_cols');
	let range_cols = (filter_range_cols ? filter_range_cols.value.split("\n").filter(s => s.length > 0) : []);
	if (range_cols.length > 0) {
		data.range_filters = range_cols;
	}
	if (entries.length > 0) {
		data.entries = entries;
	}
	// Paste data into export box
	let data_box = document.getElementById('data_box');
	if (data_box) {
		data_box.value = JSON.stringify(data, replacer);
	}
}

function importData() {
	let data_box = document.getElementById('data_box');
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
		let table = document.getElementById('categories');
		let template = document.getElementById('categories_new');
		table.replaceChildren();
		table.appendChild(template);
		let i = 0;
		data.categories.forEach(v => {
			try {
				let obj = new Category(v.name, v.weight);
				template.children[1].children[0].value = obj.name;
				template.children[2].children[0].value = obj.weight;
				addEntryToElement(template, table);
			} catch (err) {
				console.log("Ignored invalid encounter weight category: " + err);
			}
		});
		buildCategoryOptions('select_entry_category');
	}
	// Import filters
	if (data.filters) {
		let table = document.getElementById('filters');
		let template = document.getElementById('filters_new');
		table.replaceChildren();
		table.appendChild(template);
		data.filters.forEach(v => {
			try {
				let obj = new FilterEntry(v.name, v.values);
				template.children[1].children[0].value = obj.name;
				template.children[2].children[0].value = obj.values.join("\n");
				addEntryToElement(template, table);
			} catch (err) {
				console.log("Ignored invalid filter entry: " + err);
			}
		});
		buildFilterEntryElements('entries_filters_container');
	}
	// Import range filters
	if (data.range_filters) {
		let filter_range_cols = document.getElementById('filter_range_cols');
		filter_range_cols.value = data.range_filters.join("\n");
		buildRangeFilterCols();
	} else {
		// Ensure any already-imported range filters are processed
		let filter_range_cols = document.getElementById('filter_range_cols');
		data.range_filters = (filter_range_cols ? filter_range_cols.value.split("\n").filter(s => s.length > 0) : []);
	}
	// Import encounter entries
	if (data.entries) {
		let table = document.getElementById('entries');
		let template = document.getElementById('entries_new');
		let select_weight_category = document.getElementById('select_entry_category');
		table.replaceChildren();
		table.appendChild(template);
		data.entries.forEach(v => {
			try {
				let obj = new Entry(v.name, v.weight, v.weight_id, v.ref_src, v.ref_page, v.filters);
				let j = 1;
				template.children[j++].children[0].value = obj.name;
				template.children[j++].children[0].value = obj.weight;
				if (select_weight_category) {
					for (let i = 0; i < select_weight_category.options.length; ++i) {
						// Non-strict comparison
						if (v.weight_id == select_weight_category.options[i].value) {
							select_weight_category.selectedIndex = i;
							break;
						}
					}
				}
				template.children[j++].children[0].value = obj.ref_src;
				template.children[j++].children[0].value = obj.ref_page;
				if (data.range_filters) {
					data.range_filters.forEach(col => {
						obj[col] = v[col];
						template.children[j++].children[0].value = obj[col];
					});
				}
				if (obj.filters.size > 0) {
					let selects = template.children[j++].getElementsByTagName('SELECT');
					for (let i = 0; i < selects.length; ++i) {
						let n = 'filter_'.length;
						let filter_key = selects[i].name.substr(n, selects[i].name.length - (n + 2));
						let filter_values = obj.filters.get(filter_key);
						if (filter_values) {
							filter_values.forEach(val => {
								selects[i].options[val].selected = true;
							});
						}
					}
				}
				addEntryToElement(template, table);
			} catch (err) {
				console.log("Ignored invalid filter: " + err);
			}
		});
	}
	if (typeof err === 'undefined') {
		let _form = document.getElementById('data_form');
		if (validateForm(_form)) {
			alert('Data imported successfully');
		} else {
			alert('Data imported successfully but one or more input errors were detected');
		}
	} else {
		alert('One or more errors were detected - see console for details');
	}
}

window.addEventListener('load', function(event) {
	document.getElementById('export_data').addEventListener('click', exportData);
	document.getElementById('import_data').addEventListener('click', importData);
	document.getElementById('btn_refresh_data').addEventListener('click', refreshDataElements);
	document.getElementById('btn_validate').addEventListener('click', function(e) {
		let f = document.getElementById('data_form');
		if (validateForm(f)) {
			alert('No input errors were detected');
		} else {
			alert('One or more errors were detected - see form inputs');
		}
	});
});
