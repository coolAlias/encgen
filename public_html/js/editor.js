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
	buildFilterElements('entries_filters_container');
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
 * Builds the Filter <select> element templates used for new Encounter Entries
 * and places them in the target container, replacing any existing contents.
 * @param target_id String, target container id
 */
function buildFilterElements(target_id) {
	let filters = getFilters();
	let target = document.getElementById(target_id);
	if (!target || !filters || filters.size < 1) {
		return;
	}
	target.replaceChildren();
	Array.from(filters.values()).forEach(v => {
		try {
			let obj = new Filter(v.name, v.values);
			let el = obj.getHtmlElement(null, 'filter_' + obj.name + '[]');
			if (el) {
				target.appendChild(el);
			}
		} catch (err) {
			console.log("Ignored invalid filter: " + err);
		}
	});
	return false;
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
 * @return Map<String, Filter> based on user inputs, keyed by the filter's name
 */
function getFilters() {
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
			let obj = new Filter(names[i].value, entries);
			filters.set(obj.name, obj);
		} catch (err) {
			console.log(err);
		}
	}
	return filters;
}

/**
 * @param filters Map<String, Filter> of existing filters
 * @return Array<Entry> based on user inputs
 */
function getEntries(filters) {
	let names = document.getElementsByName('entries_name[]');
	let weights = document.getElementsByName('entries_weight[]');
	let weight_ids = document.getElementsByName('entries_category[]');
	let sources = document.getElementsByName('entries_ref_src[]');
	let pages = document.getElementsByName('entries_ref_page[]');
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
	try {
		for (let i = 0; i < names.length; ++i) {
			if (names[i].classList.contains('no_validate')) {
				continue; // do not process templates until added
			}
			try {
				let weight = parseInt(weights[i].value);
				if (weight === NaN) {
					weight = undefined;
				}
				let weight_id = parseInt(weight_ids[i].value);
				if (weight_id === NaN) {
					weight_id = undefined;
				}
				let ref_src = sources[i].value;
				let ref_page = pages[i].value;
				let entry_filters = new Map();
				entries_filters.forEach(function(values, key) {
					let selected = [];
					Array.from(values[i].selectedOptions).forEach(v => {
						let parsed = parseInt(v.value);
						let val = (parsed === NaN ? v.value : parsed);
						selected.push(val);
					});
					if (selected.length > 0) {
						entry_filters.set(key, selected);
					}
				});
				let obj = new Entry(names[i].value, weight, weight_id, ref_src, ref_page, entry_filters);
				entries.push(obj);
			} catch (err) {
				console.log(err);
			}
		}
	} catch (err) {
		console.log(err);
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
	let filters = getFilters();
	let entries = getEntries(filters);
	let data = new Object();
	if (categories.length > 0) {
		data.categories = categories;
	}
	if (filters.size > 0) {
		data.filters = Array.from(filters.values());
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
				console.log("Ignored invalid filter: " + err);
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
				let obj = new Filter(v.name, v.values);
				template.children[1].children[0].value = obj.name;
				template.children[2].children[0].value = obj.values.join("\n");
				addEntryToElement(template, table);
			} catch (err) {
				console.log("Ignored invalid filter: " + err);
			}
		});
		buildFilterElements('entries_filters_container');
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
				template.children[1].children[0].value = obj.name;
				template.children[2].children[0].value = obj.weight;
				if (select_weight_category) {
					for (let i = 0; i < select_weight_category.options.length; ++i) {
						// Non-strict comparison
						if (v.weight_id == select_weight_category.options[i].value) {
							select_weight_category.selectedIndex = i;
							break;
						}
					}
				}
				template.children[3].children[0].value = obj.ref_src;
				template.children[4].children[0].value = obj.ref_page;
				if (obj.filters.size > 0) {
					let selects = template.children[5].getElementsByTagName('SELECT');
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

window.addEventListener("load", function(event) {
	document.getElementById('btn_validate').addEventListener('click', function(e) {
		let f = document.getElementById('data_form');
		if (validateForm(f)) {
			alert('No input errors were detected');
		} else {
			alert('One or more errors were detected - see form inputs');
		}
	});
});
